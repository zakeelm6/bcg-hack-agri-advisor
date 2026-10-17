"""Whose request is this? One phone, one farmer, one field.

The app makes a random token on first launch and sends it as the `X-Device` header on every request. Only its SHA-256 is kept.
The first request of a new token registers the phone and gives it a field of its own (a copy of the demo field); after that every
read and write is limited to that field. A request without a token uses the shared demo field (id 1), unless the server is set to
`FA_REQUIRE_DEVICE=1`, as a public server should be. There is no login: the token is the only proof, keep it on the phone.
"""
import hashlib
import re

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.ratelimit import device_brake
from . import models as m
from .seed import seed_field

TOKEN = re.compile(r"[A-Za-z0-9_-]{22,128}")   # 128 random bits or more, URL-safe


def fid(db: Session) -> int:
    """The field of the request this session serves (1, the shared demo field, outside a request)."""
    return db.info.get("field_id", 1)


def _now() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat(timespec="seconds")


def resolve(db: Session, token: str | None) -> int:
    """The field id of this phone. Registers a new phone (creating its field) the first time its token is seen."""
    if not token:
        if settings.require_device:
            raise HTTPException(401, "this server needs a device token (X-Device header)")
        return 1
    if not TOKEN.fullmatch(token):
        raise HTTPException(401, "bad device token")
    h = hashlib.sha256(token.encode()).hexdigest()
    dev = db.get(m.Device, h)
    if dev is not None:
        if dev.last_seen[:13] != _now()[:13]:   # once an hour is enough
            dev.last_seen = _now()
            db.commit()
        return dev.field_id
    if db.scalar(select(func.count()).select_from(m.Device)) >= settings.max_devices:
        raise HTTPException(503, "this server cannot register more phones")
    if not device_brake.allow():
        raise HTTPException(429, "too many new phones, wait a minute")
    field_id = seed_field(db)
    db.add(m.Device(token_hash=h, field_id=field_id, created_at=_now(), last_seen=_now()))
    db.commit()
    db.info["field_id"] = field_id
    from ..services.advice import refresh_advice   # a new phone has advice at once (imported here: services import this module)
    refresh_advice(db)
    return field_id
