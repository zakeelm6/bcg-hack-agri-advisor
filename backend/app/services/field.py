"""Reads of the field, its zones, sensors and soil tests (the inputs of the decision engine)."""
import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import models as m
from ..db.scope import fid
from ..processing import geo
from .common import as_dict


def get_field(db: Session) -> dict:
    return as_dict(db.get(m.Field, fid(db)))


def get_zones(db: Session) -> list[dict]:
    zones = [as_dict(z) for z in db.scalars(select(m.Zone).where(m.Zone.field_id == fid(db)).order_by(m.Zone.code))]
    for z in zones:
        z["ndvi_hist"] = json.loads(z["ndvi_hist"])
    return zones


def latest_sensors(db: Session, bad: dict | None = None):
    """Latest reliable reading per sensor -> ({zone_code: moisture}, detail list).
    A sensor whose recent readings are flagged gives no number to the engine; `bad` (if given) receives {zone: [flags]}."""
    from .sensors import qc_sensor, sensor_quality   # local import: sensors.py imports the engine inputs too
    out, detail = {}, []
    for s in db.scalars(select(m.Sensor).where(m.Sensor.field_id == fid(db))):
        rows = qc_sensor(db, s)
        if not rows:
            continue
        q = sensor_quality(rows)
        last = rows[-1]
        d = {**as_dict(s), "moisture": last.moisture, "updated_at": last.ts, "simulated": bool(s.simulated),
             "quality": q["quality"], "flags": q["flags"], "flag_text": q.get("flag_text", []), "good_share": q["good_share"]}
        if q["quality"] in ("high", "medium") and q.get("latest_good") is not None:
            out[s.zone_code] = q["latest_good"].moisture
            d["moisture"] = q["latest_good"].moisture
            d["updated_at"] = q["latest_good"].ts
        elif bad is not None:
            bad[s.zone_code] = q["flags"] or ["no recent reliable reading"]
        detail.append(d)
    db.commit()   # flags written by the quality checks
    return out, detail


def latest_soil(db: Session) -> dict:
    """Latest soil test per zone, with its age in days. Used by the engine and shown in the app."""
    out = {}
    for r in db.scalars(select(m.SoilTest).where(m.SoilTest.field_id == fid(db)).order_by(m.SoilTest.ts, m.SoilTest.id)):
        age = max(0, (datetime.utcnow() - datetime.fromisoformat(r.ts)).days)
        out[r.zone_code] = {**as_dict(r), "age_days": age}   # later rows overwrite earlier ones
    return out


def engine_inputs(db: Session):
    """(field, zones, sensors, weather, soil): everything the engine needs to decide."""
    field, zones = get_field(db), get_zones(db)
    sensors, _ = latest_sensors(db)
    return field, zones, sensors, geo.get_weather(db, field["lat"], field["lon"]), latest_soil(db)


def layer_inputs(db: Session, sensor_detail_out: list | None = None) -> dict:
    """Phase 2 inputs for the engine: {sensors, bad_sensors, offsets, anomalies}."""
    from .satellite_layer import anomalies_for_engine
    from .sensors import stored_offsets
    bad = {}
    sensors, detail = latest_sensors(db, bad)
    if sensor_detail_out is not None:
        sensor_detail_out.extend(detail)
    return {"sensors": sensors, "bad_sensors": bad, "offsets": stored_offsets(db), "anomalies": anomalies_for_engine(get_field(db))}
