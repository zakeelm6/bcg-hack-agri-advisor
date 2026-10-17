from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import requests as rq
from ...schemas.responses import Ok
from ...services import tasks

router = APIRouter()


@router.post("/api/sensors/{sensor_id}/readings", response_model=Ok)
def add_reading(sensor_id: int, r: rq.Reading, db: Session = Depends(get_db)):
    tasks.add_reading(db, sensor_id, r)
    return {"ok": True}


@router.post("/api/tasks/{task_id}/status", response_model=Ok)
def task_status(task_id: int, b: rq.StatusBody, db: Session = Depends(get_db)):
    tasks.set_status(db, task_id, b.status)
    return {"ok": True}


@router.post("/api/observations", response_model=Ok)
def add_observation(o: rq.Observation, db: Session = Depends(get_db)):
    tasks.add_observation(db, o)
    return {"ok": True}


@router.post("/api/soil-tests", response_model=Ok)
def add_soil_test(t: rq.SoilTest, db: Session = Depends(get_db)):
    tasks.add_soil_test(db, t)
    return {"ok": True}
