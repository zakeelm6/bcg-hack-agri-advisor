"""The farmer's profile (onboarding answers) and how it reaches the engine.

What the engine can use today: crop (for the harvest reference yield), sowing date, field area (split evenly over the four zones).
What it cannot use yet: the position. The satellite data and the picture belong to the parcel that was downloaded
(scripts/fetch_satellite.py); moving the field without new imagery would show one place and compute on another, so the
position is stored but the field stays where its data is. The answer says so.
"""
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import models as m
from ..db.scope import fid
from ..schemas import requests as rq
from . import own_field
from .common import ar_fallback, as_dict, now_iso

# app keys -> the crop names the engine knows (YIELD_T_HA); anything else is kept as typed, capitalised
CROP_KEYS = {"tomatoes": "Tomato", "potatoes": "Potato", "onions": "Onion", "wheat": "Wheat", "olives": "Olive", "citrus": "Citrus", "maize": "Maize", "melons": "Melon"}

NOT_APPLIED = {
    "en": {"pos": "Position: a town name is not enough to place your field. Use \"Use my location\" so the satellite can look at it.",
           "irr": "Irrigation method and main worry: stored, not used by the rules yet."},
    "fr": {"pos": "Position : un nom de ville ne suffit pas pour placer votre champ. Utilisez « Utiliser ma position » pour que le satellite puisse le regarder.",
           "irr": "Méthode d'irrigation et préoccupation : enregistrées, pas encore utilisées par les règles."},
    "ar": {"pos": "الموقع: اسم المدينة لا يكفي لتحديد حقلك. استعمل «استعمل موقعي» ليتمكن القمر الصناعي من رؤيته.",
           "irr": "طريقة السقي والهمّ الرئيسي: محفوظان، ولا تستخدمهما القواعد بعد."},
}


def get(db: Session) -> dict | None:
    f = db.get(m.Farmer, fid(db))
    return as_dict(f) if f else None


def save(db: Session, b: rq.FarmerBody) -> dict:
    row = db.get(m.Farmer, fid(db))
    if row is None:
        row = m.Farmer(id=fid(db))
        db.add(row)
    for k in ("location", "crop", "planted_on", "area_ha", "irrigation", "challenge", "lat", "lon", "lang"):
        setattr(row, k, getattr(b, k))
    row.updated_at = now_iso()
    lang = ar_fallback(b.lang) if ar_fallback(b.lang) in NOT_APPLIED else "en"
    field = db.get(m.Field, fid(db))
    applied, not_applied = {}, []
    if b.crop:
        key = b.crop.strip().lower()
        field.crop = CROP_KEYS.get(key, b.crop.strip()[:1].upper() + b.crop.strip()[1:])
        applied["crop"] = field.crop
    if b.planted_on:
        field.sowing_date = b.planted_on
        applied["sowing_date"] = b.planted_on
    if b.lat is not None and b.lon is not None:
        boundary = [p[:2] for p in b.boundary if len(p) >= 2] if b.boundary else None
        if own_field.needs_move(field, b.lat, b.lon, b.area_ha, boundary):
            info = own_field.set_field(db, b.lat, b.lon, b.area_ha, boundary)
            applied["position"] = {"lat": info["lat"], "lon": info["lon"], "satellite": info["satellite_status"]}
        else:
            applied["position"] = {"lat": field.lat, "lon": field.lon, "satellite": field.satellite_status}
    elif b.location:
        not_applied.append(NOT_APPLIED[lang]["pos"])   # a town name alone cannot place a field
    if b.area_ha:
        if field.area_ha != round(b.area_ha, 2) or "position" not in applied:   # the field of a farmer who gave a position was sized above
            field.area_ha = round(b.area_ha, 2)
            zones = db.scalars(select(m.Zone).where(m.Zone.field_id == fid(db))).all()
            for z in zones:
                z.area_ha = round(b.area_ha / len(zones), 3)
        applied["area_ha"] = field.area_ha
    if b.irrigation or b.challenge:
        not_applied.append(NOT_APPLIED[lang]["irr"])
    db.execute(delete(m.Task).where(m.Task.field_id == fid(db), m.Task.status == "open"))   # the advice is rebuilt on the new field facts
    db.commit()
    from .advice import refresh_advice
    refresh_advice(db)
    return {"saved": True, "profile": as_dict(row), "applied": applied, "not_applied": not_applied}
