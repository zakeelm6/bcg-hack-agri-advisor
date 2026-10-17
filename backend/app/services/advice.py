"""Turns the data into tasks and alerts (through the engine) and builds the state the app displays."""
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import models as m
from ..db.scope import fid
from ..processing import engine, geo, season
from . import activities, field as fld
from .satellite_layer import anomalies_available
from .common import as_dict, clean_lang, now_iso

TASK_FIELDS = ("type", "title", "what", "when_text", "when_date", "why", "cost", "confidence", "conf_reason", "plan_b", "x", "y", "qty", "unit")


def _measured_on(detail: list, soil: dict, today: date) -> dict:
    """The day of the last moisture reading of each zone (a sensor reading or a soil sample): water given after it is not in it."""
    out = {d["zone_code"]: date.fromisoformat(str(d["updated_at"])[:10]) for d in detail if d.get("updated_at")}
    for code, t in soil.items():
        if t.get("moisture") is not None and t["age_days"] <= engine.MANUAL_MOISTURE_MAX_AGE_DAYS:
            out[code] = today - timedelta(days=t["age_days"])
    return out


def refresh_advice(db: Session, force_weather: bool = False) -> dict:
    """Recompute tasks and alerts from current data. Keeps the status of tasks that still apply."""
    field, zones = fld.get_field(db), fld.get_zones(db)
    detail: list = []
    weather = geo.get_weather(db, field["lat"], field["lon"], force=force_weather)
    layers = fld.layer_inputs(db, detail, weather=weather)
    soil = fld.latest_soil(db)
    est, tasks, alerts = engine.build_advice(field, zones, layers["sensors"], weather, soil=soil,
                                             bad_sensors=layers["bad_sensors"], offsets=layers["offsets"], anomalies=layers["anomalies"],
                                             water_balance=layers["water_balance"], waterings=activities.recent_waterings(db),
                                             measured_on=_measured_on(detail, soil, date.fromisoformat(weather["days"][0]["date"])))
    now = now_iso()
    keys = [t["key"] for t in tasks]
    for t in tasks:
        row = db.scalars(select(m.Task).where(m.Task.field_id == fid(db), m.Task.key == t["key"])).first()
        if row is None:
            row = m.Task(key=t["key"], field_id=fid(db))
            db.add(row)
        elif row.status in ("done", "skipped") and row.when_date < t["when_date"]:
            row.status = "open"   # the same need came back on a later day: it is a new occasion, not the answer already given
        row.zone_code, row.updated_at = t["zone"], now
        for k in TASK_FIELDS:
            setattr(row, k, t.get(k))   # qty and unit exist for irrigation and fertilizer only
        v = season.verify_task(t, est, weather, soil, layers["bad_sensors"])   # independent re-check; an escalated task stays visible
        row.verify_status, row.verify_detail = v["status"], v["detail"]
    stale = delete(m.Task).where(m.Task.field_id == fid(db), m.Task.status == "open")
    db.execute(stale.where(m.Task.key.notin_(keys)) if keys else stale)
    for a in alerts:
        row = db.scalars(select(m.Alert).where(m.Alert.field_id == fid(db), m.Alert.key == a["key"])).first()
        if row is None:
            db.add(m.Alert(field_id=fid(db), key=a["key"], kind=a["kind"], title=a["title"], body=a["body"], ts=now))
        else:
            row.title, row.body = a["title"], a["body"]
    db.execute(delete(m.Alert).where(m.Alert.field_id == fid(db), m.Alert.key.notin_([a["key"] for a in alerts])))
    db.commit()
    return weather


def build_state(db: Session, lang: str = "en", refresh: bool = False) -> dict:
    lang = clean_lang(lang)
    weather = refresh_advice(db, force_weather=True) if refresh else None
    field, zones = fld.get_field(db), fld.get_zones(db)
    if weather is None:
        weather = geo.get_weather(db, field["lat"], field["lon"])
    sensor_detail = []
    layers = fld.layer_inputs(db, sensor_detail, weather=weather)
    sensors = layers["sensors"]
    soil = fld.latest_soil(db)
    est, tasks_l, alerts_l = engine.build_advice(field, zones, sensors, weather, soil=soil, lang=lang,
                                                 bad_sensors=layers["bad_sensors"], offsets=layers["offsets"], anomalies=layers["anomalies"],
                                                 water_balance=layers["water_balance"], waterings=activities.recent_waterings(db),
                                                 measured_on=_measured_on(sensor_detail, soil, date.fromisoformat(weather["days"][0]["date"])))
    has_sensor = {d["zone_code"] for d in sensor_detail}
    for z in zones:
        e = est[z["code"]]
        z.update({"moisture": e["moisture"], "moisture_source": e["source"], "confidence": e["confidence"], "conf_reason": e["reason"],
                  "has_sensor": z["code"] in has_sensor, "sensor_quality": next((d["quality"] for d in sensor_detail if d["zone_code"] == z["code"]), None),
                  "offset": layers["offsets"].get(z["code"]), "soil_test": soil.get(z["code"])})
    tasks = [as_dict(t) for t in db.scalars(select(m.Task).where(m.Task.field_id == fid(db)).order_by(m.Task.when_date, m.Task.id))]
    alerts = [as_dict(a) for a in db.scalars(select(m.Alert).where(m.Alert.field_id == fid(db)).order_by(m.Alert.unread.desc(), m.Alert.id))]
    if lang != "en":   # same tasks, same numbers, wording in the farmer's language (stored rows are English)
        loc = {t["key"]: t for t in tasks_l}
        for t in tasks:
            lt = loc.get(t["key"])
            if lt:
                for k in ("title", "what", "when_text", "why", "cost", "conf_reason", "plan_b"):
                    t[k] = lt[k]
                t["verify_detail"] = season.verify_task(lt, est, weather, soil, layers["bad_sensors"], lang=lang)["detail"]
        loc_a = {a["key"]: a for a in alerts_l}
        for a in alerts:
            la = loc_a.get(a["key"])
            if la:
                a["title"], a["body"] = la["title"], la["body"]
    return {"field": field, "zones": zones, "sensors": sensor_detail, "tasks": tasks, "alerts": alerts, "weather": weather,
            "soil_tests": sorted(soil.values(), key=lambda t: t["zone_code"]),
            "generated_at": datetime.utcnow().isoformat(timespec="seconds"),
            "data_notes": {"vigor": zones[0]["ndvi_source"] if zones else "none", "sensors": "none" if layers["setup"]["has_sensors"] == "none" else "simulated", "setup": layers["setup"],
                           "anomalies": "sentinel-2 pixels" if layers["anomalies"] is not None and anomalies_available(field) else "not available"}}
