from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import requests as rq
from ...schemas.responses import BriefingOut, FarmerOut, SeasonOut
from ...services import farmer, season_service

router = APIRouter()


@router.get("/api/farmer", response_model=FarmerOut)
def get_farmer(lang: str = "en", db: Session = Depends(get_db)):
    """The profile, the questions still unanswered (`needs_input`) and the assumptions the plan makes instead."""
    return farmer.status(db, lang)


@router.get("/api/season", response_model=SeasonOut)
def season_plan(lang: str = "en", db: Session = Depends(get_db)):
    """Deterministic season plan: stages, irrigation rhythm, nitrogen splits, inspections, harvest window, with its assumptions."""
    return season_service.plan(db, lang)


@router.get("/api/briefing", response_model=BriefingOut)
def daily_briefing(lang: str = "en", db: Session = Depends(get_db)):
    """One paragraph for the day, to read aloud: stage, today's tasks, weather, next step, escalations."""
    return season_service.briefing(db, lang)


@router.post("/api/farmer", response_model=FarmerOut)
def save_farmer(b: rq.FarmerBody, db: Session = Depends(get_db)):
    return farmer.save(db, b)
