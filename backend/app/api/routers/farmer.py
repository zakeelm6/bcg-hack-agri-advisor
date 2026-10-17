from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import requests as rq
from ...schemas.responses import FarmerOut
from ...services import farmer

router = APIRouter()


@router.get("/api/farmer", response_model=FarmerOut)
def get_farmer(db: Session = Depends(get_db)):
    p = farmer.get(db)
    return {"saved": p is not None, "profile": p}


@router.post("/api/farmer", response_model=FarmerOut)
def save_farmer(b: rq.FarmerBody, db: Session = Depends(get_db)):
    return farmer.save(db, b)
