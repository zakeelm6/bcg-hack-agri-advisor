"""Reads of the field, its zones, sensors and soil tests (the inputs of the decision engine)."""
import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import models as m
from ..processing import geo
from .common import as_dict


def get_field(db: Session) -> dict:
    return as_dict(db.get(m.Field, 1))


def get_zones(db: Session) -> list[dict]:
    zones = [as_dict(z) for z in db.scalars(select(m.Zone).where(m.Zone.field_id == 1).order_by(m.Zone.code))]
    for z in zones:
        z["ndvi_hist"] = json.loads(z["ndvi_hist"])
    return zones


def latest_sensors(db: Session):
    """Latest reading per sensor -> ({zone_code: moisture}, detail list)."""
    out, detail = {}, []
    for s in db.scalars(select(m.Sensor).where(m.Sensor.field_id == 1)):
        r = db.scalars(select(m.Reading).where(m.Reading.sensor_id == s.id).order_by(m.Reading.ts.desc(), m.Reading.id.desc()).limit(1)).first()
        if r:
            out[s.zone_code] = r.moisture
            detail.append({**as_dict(s), "moisture": r.moisture, "updated_at": r.ts, "simulated": bool(s.simulated)})
    return out, detail


def latest_soil(db: Session) -> dict:
    """Latest soil test per zone, with its age in days. Used by the engine and shown in the app."""
    out = {}
    for r in db.scalars(select(m.SoilTest).where(m.SoilTest.field_id == 1).order_by(m.SoilTest.ts, m.SoilTest.id)):
        age = max(0, (datetime.utcnow() - datetime.fromisoformat(r.ts)).days)
        out[r.zone_code] = {**as_dict(r), "age_days": age}   # later rows overwrite earlier ones
    return out


def engine_inputs(db: Session):
    """(field, zones, sensors, weather, soil): everything the engine needs to decide."""
    field, zones = get_field(db), get_zones(db)
    sensors, _ = latest_sensors(db)
    return field, zones, sensors, geo.get_weather(db, field["lat"], field["lon"]), latest_soil(db)
