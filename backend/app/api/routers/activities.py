from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import requests as rq
from ...schemas.responses import ActivitiesOut, ActivityOut, Ok
from ...services import activities

router = APIRouter()


@router.get("/api/activities", response_model=ActivitiesOut)
def list_activities(db: Session = Depends(get_db)):
    return {"activities": activities.listing(db)}


@router.post("/api/activities", response_model=ActivityOut)
def save_activity(b: rq.ActivityBody, db: Session = Depends(get_db)):
    """Create or update the entry with this `client_id`. Recorded watering makes the engine wait before advising it again."""
    return activities.save(db, b)


@router.delete("/api/activities/{client_id}", response_model=Ok)
def delete_activity(client_id: str, db: Session = Depends(get_db)):
    activities.remove(db, client_id)
    return {"ok": True}
