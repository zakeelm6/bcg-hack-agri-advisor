"""Turns the data into tasks and alerts (through the engine) and builds the state the app displays."""
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import models as m
from ..processing import engine, geo
from . import field as fld
from .satellite_layer import anomalies_available
from .common import as_dict, clean_lang, now_iso

TASK_FIELDS = ("type", "title", "what", "when_text", "when_date", "why", "cost", "confidence", "conf_reason", "plan_b", "x", "y")


def refresh_advice(db: Session, force_weather: bool = False) -> dict:
    """Recompute tasks and alerts from current data. Keeps the status of tasks that still apply."""
    field, zones = fld.get_field(db), fld.get_zones(db)
    layers = fld.layer_inputs(db)
    weather = geo.get_weather(db, field["lat"], field["lon"], force=force_weather)
    _, tasks, alerts = engine.build_advice(field, zones, layers["sensors"], weather, soil=fld.latest_soil(db),
                                           bad_sensors=layers["bad_sensors"], offsets=layers["offsets"], anomalies=layers["anomalies"])
    now = now_iso()
    keys = [t["key"] for t in tasks]
    for t in tasks:
        row = db.scalars(select(m.Task).where(m.Task.key == t["key"])).first()
        if row is None:
            row = m.Task(key=t["key"], field_id=1)
            db.add(row)
        row.zone_code, row.updated_at = t["zone"], now
        for k in TASK_FIELDS:
            setattr(row, k, t[k])
    stale = delete(m.Task).where(m.Task.status == "open")
    db.execute(stale.where(m.Task.key.notin_(keys)) if keys else stale)
    for a in alerts:
        row = db.scalars(select(m.Alert).where(m.Alert.key == a["key"])).first()
        if row is None:
            db.add(m.Alert(key=a["key"], kind=a["kind"], title=a["title"], body=a["body"], ts=now))
        else:
            row.title, row.body = a["title"], a["body"]
    db.execute(delete(m.Alert).where(m.Alert.key.notin_([a["key"] for a in alerts])))
    db.commit()
    return weather


def build_state(db: Session, lang: str = "en", refresh: bool = False) -> dict:
    lang = clean_lang(lang)
    weather = refresh_advice(db, force_weather=True) if refresh else None
    field, zones = fld.get_field(db), fld.get_zones(db)
    sensor_detail = []
    layers = fld.layer_inputs(db, sensor_detail)
    sensors = layers["sensors"]
    if weather is None:
        weather = geo.get_weather(db, field["lat"], field["lon"])
    soil = fld.latest_soil(db)
    est, tasks_l, alerts_l = engine.build_advice(field, zones, sensors, weather, soil=soil, lang=lang,
                                                 bad_sensors=layers["bad_sensors"], offsets=layers["offsets"], anomalies=layers["anomalies"])
    has_sensor = {d["zone_code"] for d in sensor_detail}
    for z in zones:
        e = est[z["code"]]
        z.update({"moisture": e["moisture"], "moisture_source": e["source"], "confidence": e["confidence"], "conf_reason": e["reason"],
                  "has_sensor": z["code"] in has_sensor, "sensor_quality": next((d["quality"] for d in sensor_detail if d["zone_code"] == z["code"]), None),
                  "offset": layers["offsets"].get(z["code"]), "soil_test": soil.get(z["code"])})
    tasks = [as_dict(t) for t in db.scalars(select(m.Task).where(m.Task.field_id == 1).order_by(m.Task.when_date, m.Task.id))]
    alerts = [as_dict(a) for a in db.scalars(select(m.Alert).order_by(m.Alert.unread.desc(), m.Alert.id))]
    if lang != "en":   # same tasks, same numbers, wording in the farmer's language (stored rows are English)
        loc = {t["key"]: t for t in tasks_l}
        for t in tasks:
            lt = loc.get(t["key"])
            if lt:
                for k in ("title", "what", "when_text", "why", "cost", "conf_reason", "plan_b"):
                    t[k] = lt[k]
        loc_a = {a["key"]: a for a in alerts_l}
        for a in alerts:
            la = loc_a.get(a["key"])
            if la:
                a["title"], a["body"] = la["title"], la["body"]
    return {"field": field, "zones": zones, "sensors": sensor_detail, "tasks": tasks, "alerts": alerts, "weather": weather,
            "soil_tests": sorted(soil.values(), key=lambda t: t["zone_code"]),
            "generated_at": datetime.utcnow().isoformat(timespec="seconds"),
            "data_notes": {"vigor": zones[0]["ndvi_source"] if zones else "none", "sensors": "simulated",
                           "anomalies": "sentinel-2 pixels" if layers["anomalies"] is not None and anomalies_available() else "not available"}}
