from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from ...core.ratelimit import geo_brake
from ...schemas.responses import PlaceOut
from ...services import places

router = APIRouter()


@router.get("/api/geo/place", response_model=PlaceOut)
async def place(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180), lang: str = "en"):
    """Town name at a position (cached). `place` is null when the name service does not answer."""
    if not geo_brake.allow():
        raise HTTPException(429, "too many requests, wait a minute")
    return {"place": await run_in_threadpool(places.place_at, lat, lon, lang)}
