"""Sensor layer in the backend (Phase 2): quality flags on every reading, and the gap learned between a plot and the shared sensor.

Rules: a reading is never deleted, it is flagged; a flagged reading never enters a dose; a zone without a sensor gets
    moisture_zone = moisture_sentinel + delta_zone
only after enough soil samples taught us delta_zone, with its spread as the confidence.
"""
import json
import statistics
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import models as m
from ..processing.sensors import FLAG_DESCRIPTIONS, Node, QCConfig, Reading, SoilTexture, run_qc
from ..processing.sensors.sentinel import PlotOffset
from .common import now_iso

QC_WINDOW = 200                 # readings re-checked when a new one arrives (series checks need context)
RECENT_HOURS = 48               # a sensor counts as "live" when its latest good reading is this recent
QUALITY_WINDOW = 5              # the last readings that decide whether a sensor is reliable right now
PAIR_WINDOW_HOURS = 12          # a soil sample and a sentinel reading this close in time form a calibration pair
DEMO_NODE = Node(node_id="demo", latitude=0.0, longitude=0.0, texture=SoilTexture.LOAM)   # texture unknown: loam is the middle case


def _ts(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _to_layer(rows: list[m.Reading], irrigations: list[tuple[datetime, float]]) -> list[Reading]:
    """Our rows (moisture, temp) become the layer's Reading. Irrigation counted as water arriving, so a legitimate rise is not flagged."""
    out = []
    for r in rows:
        t = _ts(r.ts)
        water = sum(mm for when, mm in irrigations if when <= t <= when + timedelta(hours=24))
        out.append(Reading(node_id=str(r.sensor_id), timestamp=t, vwc_shallow=r.moisture, temp_shallow=r.temp_c,
                           rainfall_mm=water if water else None))
    return out


def _irrigations(db: Session, zone_code: str) -> list[tuple[datetime, float]]:
    """Irrigation tasks the farmer reported done (follow-up observation), with their depth, for the rain-consistency check."""
    out = []
    tasks = {t.id: t for t in db.scalars(select(m.Task).where(m.Task.type == "irrigate", m.Task.zone_code == zone_code))}
    if not tasks:
        return out
    for o in db.scalars(select(m.Observation).where(m.Observation.task_id.in_(list(tasks)))):
        try:
            mm = float(tasks[o.task_id].title.split(",")[1].split()[0])
        except (IndexError, ValueError):
            mm = 10.0
        out.append((_ts(o.ts), mm))
    return out


def qc_sensor(db: Session, sensor: m.Sensor) -> list[m.Reading]:
    """Run the quality checks over the recent readings of one sensor and store the flags. Returns the rows, oldest first."""
    rows = list(db.scalars(select(m.Reading).where(m.Reading.sensor_id == sensor.id).order_by(m.Reading.ts.desc(), m.Reading.id.desc()).limit(QC_WINDOW)))
    rows.reverse()
    if not rows:
        return rows
    layer = _to_layer(rows, _irrigations(db, sensor.zone_code))
    run_qc(layer, DEMO_NODE, QCConfig())
    for row, lr in zip(rows, layer):
        flags = json.dumps(sorted(set(lr.flags)))
        if row.flags != flags:
            row.flags = flags
    return rows


def sensor_quality(rows: list[m.Reading]) -> dict:
    """Is this sensor reliable right now? Looks at the last few readings: high, medium, low or insufficient."""
    recent = rows[-QUALITY_WINDOW:]
    if not recent:
        return {"quality": "insufficient", "flags": [], "good_share": 0.0}
    good = [r for r in recent if r.flags in ("[]", None, "")]
    share = len(good) / len(recent)
    flags = sorted({f for r in recent for f in json.loads(r.flags or "[]")})
    latest_good = good[-1] if good else None
    stale = latest_good is None or _ts(latest_good.ts) < datetime.utcnow() - timedelta(hours=RECENT_HOURS)
    q = "high" if share >= 0.9 else "medium" if share >= 0.5 else "low" if share > 0 else "insufficient"
    if stale:
        q = "insufficient"
    return {"quality": q, "flags": flags, "flag_text": [FLAG_DESCRIPTIONS.get(f, f) for f in flags], "good_share": round(share, 2),
            "latest_good": latest_good}


def learn_offsets(db: Session) -> dict:
    """For each zone without a sensor: pair its soil-sample moistures with the nearest good sentinel reading in time,
    learn delta (mean gap) and sdrd (spread). Stored in plot_offsets; returned as {zone: {sentinel, delta, sdrd, n}}."""
    zones = list(db.scalars(select(m.Zone).where(m.Zone.field_id == 1)))
    sensors = {s.zone_code: s for s in db.scalars(select(m.Sensor).where(m.Sensor.field_id == 1))}
    by_code = {z.code: z for z in zones}
    good_readings = {}
    for zc, s in sensors.items():
        rows = db.scalars(select(m.Reading).where(m.Reading.sensor_id == s.id, m.Reading.flags == "[]").order_by(m.Reading.ts)).all()
        good_readings[zc] = [(_ts(r.ts), r.moisture) for r in rows]
    out = {}
    for z in zones:
        if z.code in sensors or not sensors:
            continue
        sentinel = min(sensors, key=lambda c: abs(by_code[c].col - z.col) + abs(by_code[c].row - z.row))   # nearest shared sensor
        samples = db.scalars(select(m.SoilTest).where(m.SoilTest.field_id == 1, m.SoilTest.zone_code == z.code, m.SoilTest.moisture.isnot(None)).order_by(m.SoilTest.ts)).all()
        diffs = []
        for st in samples:
            t = _ts(st.ts)
            near = [(abs((rt - t).total_seconds()), v) for rt, v in good_readings.get(sentinel, []) if abs(rt - t) <= timedelta(hours=PAIR_WINDOW_HOURS)]
            if near:
                diffs.append(st.moisture - min(near)[1])
        row = db.scalars(select(m.PlotOffset).where(m.PlotOffset.field_id == 1, m.PlotOffset.zone_code == z.code)).first()
        if len(diffs) < 2:
            if row is not None:
                db.delete(row)
            continue
        off = PlotOffset(plot_id=z.code, delta=round(statistics.mean(diffs), 4), sdrd=round(statistics.stdev(diffs), 4), n_samples=len(diffs))
        if row is None:
            row = m.PlotOffset(field_id=1, zone_code=z.code)
            db.add(row)
        row.sentinel_zone, row.delta, row.sdrd, row.n_samples, row.learned_at = sentinel, off.delta, off.sdrd, off.n_samples, now_iso()
        out[z.code] = {"sentinel": sentinel, "delta": off.delta, "sdrd": off.sdrd, "n": off.n_samples, "transferable": off.is_transferable}
    db.commit()
    return out


def stored_offsets(db: Session) -> dict:
    return {r.zone_code: {"sentinel": r.sentinel_zone, "delta": r.delta, "sdrd": r.sdrd, "n": r.n_samples, "transferable": r.sdrd < 0.03}
            for r in db.scalars(select(m.PlotOffset).where(m.PlotOffset.field_id == 1))}
