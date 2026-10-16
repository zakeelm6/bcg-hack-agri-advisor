"""Harvest forecast, listing and (simulated) buyer offers."""
from fastapi import HTTPException
from sqlalchemy import case, select, update
from sqlalchemy.orm import Session

from ..db import models as m
from ..processing import engine
from . import field as fld
from .common import as_dict, clean_lang, now_iso


def forecast(db: Session, lang: str = "en") -> dict:
    field, zones = fld.get_field(db), fld.get_zones(db)
    listing = db.scalars(select(m.Listing).order_by(m.Listing.id.desc()).limit(1)).first()
    f = engine.harvest_forecast(field, zones, lang=clean_lang(lang))
    f["listing"] = as_dict(listing) if listing else None
    return f


def offers(db: Session) -> dict:
    rows = [as_dict(o) for o in db.scalars(select(m.Offer).order_by(m.Offer.price_mad_kg.desc()))]
    return {"simulated": True, "offers": rows}


def create_listing(db: Session):
    f = engine.harvest_forecast(fld.get_field(db), fld.get_zones(db))
    db.add(m.Listing(field_id=1, status="published", qty_min_t=f["qty_min_t"], qty_max_t=f["qty_max_t"], created_at=now_iso()))
    db.commit()


def accept_offer(db: Session, offer_id: int):
    if db.get(m.Offer, offer_id) is None:
        raise HTTPException(404, "unknown offer")
    db.execute(update(m.Offer).values(status=case((m.Offer.id == offer_id, "accepted"), else_="declined")))
    db.commit()
