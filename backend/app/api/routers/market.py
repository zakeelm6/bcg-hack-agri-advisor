from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas.responses import Ok, OffersOut
from ...services import market

router = APIRouter()


@router.get("/api/offers", response_model=OffersOut)
def offers(db: Session = Depends(get_db)):
    return market.offers(db)


@router.post("/api/listings", response_model=Ok)
def create_listing(db: Session = Depends(get_db)):
    market.create_listing(db)
    return {"ok": True}


@router.post("/api/offers/{offer_id}/accept", response_model=Ok)
def accept_offer(offer_id: int, db: Session = Depends(get_db)):
    market.accept_offer(db, offer_id)
    return {"ok": True}
