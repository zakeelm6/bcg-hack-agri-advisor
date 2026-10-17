"""The farmer's Activities, kept on the server so the engine can use them: real watering instead of a guess, real spending for the Copilot."""
from datetime import date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import models as m
from ..schemas import requests as rq
from .common import as_dict, now_iso

RECENT_WATERING_DAYS = 2   # after the farmer recorded watering, the engine waits this long before advising it again


def _to_out(a: m.Activity) -> dict:
    return {"client_id": a.client_id, "type": a.type, "date": a.date, "note": a.note, "cost": a.cost, "zone": a.zone_code, "amount_mm": a.amount_mm}


def save(db: Session, b: rq.ActivityBody) -> dict:
    try:
        d = date.fromisoformat(b.date)
    except ValueError:
        raise HTTPException(422, "date must be an ISO date (YYYY-MM-DD)")
    if d > date.today() + timedelta(days=1):
        raise HTTPException(422, "the date cannot be in the future")
    if b.zone and db.scalars(select(m.Zone).where(m.Zone.field_id == 1, m.Zone.code == b.zone)).first() is None:
        raise HTTPException(404, "unknown zone")
    row = db.scalars(select(m.Activity).where(m.Activity.client_id == b.client_id)).first()
    if row is None:
        row = m.Activity(client_id=b.client_id, field_id=1, created_at=now_iso())
        db.add(row)
    row.type, row.date, row.note, row.cost, row.zone_code, row.amount_mm = b.type, b.date, b.note, b.cost, b.zone, b.amount_mm
    db.commit()
    from .advice import refresh_advice   # a watering changes what is advised
    refresh_advice(db)
    return _to_out(row)


def remove(db: Session, client_id: str) -> bool:
    row = db.scalars(select(m.Activity).where(m.Activity.client_id == client_id)).first()
    if row is None:
        return False                      # already gone (undo sent twice): fine
    db.delete(row)
    db.commit()
    from .advice import refresh_advice
    refresh_advice(db)
    return True


def listing(db: Session) -> list[dict]:
    rows = db.scalars(select(m.Activity).order_by(m.Activity.date.desc(), m.Activity.id.desc())).all()
    return [_to_out(r) for r in rows]


def recent_waterings(db: Session, today: date | None = None) -> list[dict]:
    """Irrigation entries of the last days, in the form the engine takes: {date, zone, mm}. Entries dated after today are ignored."""
    today = today or datetime.utcnow().date()
    since = (today - timedelta(days=RECENT_WATERING_DAYS)).isoformat()
    rows = db.scalars(select(m.Activity).where(m.Activity.type == "irrigation", m.Activity.date >= since, m.Activity.date <= today.isoformat())).all()
    return [{"date": r.date, "zone": r.zone_code, "mm": r.amount_mm} for r in rows]


def spending(db: Session) -> dict:
    """What the farmer recorded spending: total, number of entries and the biggest one. Numbers only, for the Copilot's facts."""
    rows = [a for a in db.scalars(select(m.Activity)).all() if a.cost]
    if not rows:
        return {"total": 0, "n": 0, "top_note": None, "top_cost": None}
    top = max(rows, key=lambda a: a.cost)
    total = sum(a.cost for a in rows)
    return {"total": round(total, 2), "n": len(rows), "top_note": (top.note or "")[:60] or None, "top_cost": round(top.cost, 2)}
