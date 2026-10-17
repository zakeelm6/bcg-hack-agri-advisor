"""Writes: task status, follow-up observations, soil tests and sensor readings."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db import models as m
from ..db.scope import fid
from ..schemas import requests as rq
from .advice import refresh_advice
from .common import now_iso
from .sensors import learn_offsets, qc_sensor


def set_status(db: Session, task_id: int, status: str):
    if status not in ("open", "done", "skipped"):
        raise HTTPException(422, "status must be open, done or skipped")
    task = db.get(m.Task, task_id)
    if task is None or task.field_id != fid(db):
        raise HTTPException(404, "unknown task")
    task.status = status
    db.commit()


def add_observation(db: Session, o: rq.Observation):
    if o.photo and len(o.photo) > settings.max_photo_chars:
        raise HTTPException(413, "photo too large")
    if o.task_id is not None:
        task = db.get(m.Task, o.task_id)
        if task is None or task.field_id != fid(db):
            raise HTTPException(404, "unknown task")
    db.add(m.Observation(task_id=o.task_id, result=o.result, note=o.note, photo=o.photo, yield_kg=o.yield_kg, ts=now_iso()))
    db.commit()


def add_soil_test(db: Session, t: rq.SoilTest):
    if t.ph is None and t.om_pct is None and t.moisture is None:
        raise HTTPException(422, "enter at least one value")
    if t.ph is not None and not 3.0 <= t.ph <= 10.0:
        raise HTTPException(422, "pH must be between 3 and 10")
    if t.om_pct is not None and not 0.0 <= t.om_pct <= 15.0:
        raise HTTPException(422, "organic matter must be between 0 and 15 %")
    if t.moisture is not None and not 0.03 <= t.moisture <= 0.6:
        raise HTTPException(422, "moisture must be between 3 and 60 %")
    if db.scalars(select(m.Zone).where(m.Zone.field_id == fid(db), m.Zone.code == t.zone_code)).first() is None:
        raise HTTPException(404, "unknown zone")
    db.add(m.SoilTest(field_id=fid(db), zone_code=t.zone_code, ph=t.ph, om_pct=t.om_pct, moisture=t.moisture, ts=now_iso()))
    db.commit()
    learn_offsets(db)   # one more sample may teach the gap between this zone and the shared sensor
    refresh_advice(db)


def add_reading(db: Session, sensor_id: int, r: rq.Reading):
    """A reading is stored even when it is physically wrong: the quality checks flag it (C01, C02...) and the engine ignores
    flagged readings. Only values that cannot be a moisture fraction at all are refused."""
    if not -0.2 <= r.moisture <= 1.5:
        raise HTTPException(422, "moisture must be a fraction (about 0 to 0.6)")
    sensor = db.get(m.Sensor, sensor_id)
    if sensor is None or sensor.field_id != fid(db):
        raise HTTPException(404, "unknown sensor")
    db.add(m.Reading(sensor_id=sensor_id, ts=now_iso(), moisture=r.moisture, temp_c=r.temp_c))
    db.commit()
    qc_sensor(db, sensor)
    db.commit()
    refresh_advice(db)
