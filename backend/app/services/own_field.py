"""The farmer's own field: where it is, how big, and its satellite pictures made on demand.

At first the app only has a demo parcel (the one the Sentinel-2 download script was run for). When the farmer gives their position and
the size of their field, this module moves the engine to it: the field becomes a square of that area centred on the position (or on the
outline they drew), cut into four zones (A B / C D) like the demo, the weather follows the new position at once, and a background job
downloads the Sentinel-2 pixels of that square (free catalog, only the field's pixels). Until the job has finished the zones have no
vigor and the engine says so; if it cannot run, or fails, it says that too and the advice rests on weather, sensors and soil tests.
Not done yet: the outline is only used for the centre and the size: pixels outside it are not masked.
"""
import json
import math
import os
import subprocess
import sys
import threading
from datetime import date
from importlib.util import find_spec

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.config import BACKEND_DIR
from ..db import models as m
from ..db.session import session_scope
from . import satellite_layer
from .common import as_dict

OWN_DIR = os.path.join(BACKEND_DIR, "data", "own")          # ndvi.json (pixels per date), land.png and land.json (the picture)
SIDE_MIN_M, SIDE_MAX_M = 90.0, 400.0                          # nine to forty pixels of 10 m on a side
MOVE_TOLERANCE_M = 100.0                                      # a new position closer than this is the same place
JOB_TIMEOUT_S = 900
_lock = threading.Lock()


def side_for(area_ha: float) -> float:
    return float(max(SIDE_MIN_M, min(SIDE_MAX_M, round(math.sqrt(area_ha * 10_000)))))


def distance_m(lat1, lon1, lat2, lon2) -> float:
    return math.hypot((lat1 - lat2) * 110540.0, (lon1 - lon2) * 111320.0 * math.cos(math.radians(lat1)))


def centroid(boundary: list[list[float]]) -> tuple[float, float]:
    return sum(p[0] for p in boundary) / len(boundary), sum(p[1] for p in boundary) / len(boundary)


def jobs_enabled() -> bool:
    return os.environ.get("FA_SATELLITE_JOBS", "1") != "0"


def satellite_python() -> str | None:
    """The interpreter that has the geospatial libraries: FA_SAT_PYTHON, backend/.venv-sat, or this one if it has rasterio."""
    p = os.environ.get("FA_SAT_PYTHON")
    if p and os.path.exists(p):
        return p
    p = os.path.join(BACKEND_DIR, ".venv-sat", "bin", "python")
    if os.path.exists(p):
        return p
    return sys.executable if find_spec("rasterio") and find_spec("pystac_client") else None


def _picture_meta() -> dict | None:
    try:
        with open(os.path.join(OWN_DIR, "land.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def picture_path() -> str | None:
    p = os.path.join(OWN_DIR, "land.png")
    return p if os.path.exists(p) else None


def describe(db: Session) -> dict:
    f = db.get(m.Field, 1)
    return {"source": f.source, "satellite_status": f.satellite_status, "satellite_note": f.satellite_note, "lat": f.lat, "lon": f.lon,
            "area_ha": f.area_ha, "side_m": f.side_m, "boundary": json.loads(f.boundary) if f.boundary else None,
            "picture": _picture_meta() if f.source == "own" and picture_path() else None}


def activate(db: Session):
    """At start-up: read the pixels of the farmer's field when there is one."""
    f = db.get(m.Field, 1)
    satellite_layer.use_cache(os.path.join(OWN_DIR, "ndvi.json") if f.source == "own" else None)
    if f.source == "own" and f.satellite_status == "pending":   # the server stopped in the middle of a download
        f.satellite_status, f.satellite_note = "failed", "The download was interrupted when the server stopped. Try again."
        db.commit()


def needs_move(f: m.Field, lat: float, lon: float, area_ha: float | None, boundary) -> bool:
    if f.source != "own":
        return True
    if distance_m(f.lat, f.lon, lat, lon) > MOVE_TOLERANCE_M:
        return True
    if area_ha and f.area_ha and abs(area_ha - f.area_ha) / f.area_ha > 0.05:
        return True
    return bool(boundary) and json.dumps(boundary) != f.boundary


def set_field(db: Session, lat: float, lon: float, area_ha: float | None = None, boundary: list[list[float]] | None = None) -> dict:
    """Move the engine to the farmer's own field. Returns describe(). Starts the satellite download when it can."""
    f = db.get(m.Field, 1)
    if boundary and len(boundary) >= 3:
        lat, lon = centroid(boundary)
    area = round(area_ha or f.area_ha or 1.0, 2)
    side = side_for(area)
    f.source, f.lat, f.lon, f.area_ha, f.side_m = "own", lat, lon, area, side
    f.boundary = json.dumps(boundary) if boundary else None
    zones = db.scalars(select(m.Zone).where(m.Zone.field_id == 1)).all()
    for z in zones:                                            # the demo zones' vigor belongs to the demo parcel: forget it
        z.area_ha, z.ndvi, z.ndvi_hist, z.ndvi_source = round(area / len(zones), 3), None, "[]", "none"
    db.execute(delete(m.NdviObs).where(m.NdviObs.field_id == 1))
    db.execute(delete(m.Cache).where(m.Cache.key.like("wx:%")))   # the weather follows the new position
    db.execute(delete(m.Task).where(m.Task.status == "open"))
    for name in ("land.png", "land.json", "ndvi.json"):          # nothing of a former field survives
        try:
            os.remove(os.path.join(OWN_DIR, name))
        except OSError:
            pass
    satellite_layer.use_cache(os.path.join(OWN_DIR, "ndvi.json"))
    py = satellite_python() if jobs_enabled() else None
    if py is None:
        f.satellite_status = "none"
        f.satellite_note = ("The satellite download is switched off on this server." if not jobs_enabled()
                            else "The satellite download is not set up on this server (it needs the geospatial libraries: see backend/requirements-sat.txt).")
    else:
        f.satellite_status, f.satellite_note = "pending", "Getting the Sentinel-2 pictures of your field. This takes a few minutes."
    db.commit()
    if py is not None:
        start_job(py, lat, lon, side)
    return describe(db)


def retry(db: Session) -> dict:
    f = db.get(m.Field, 1)
    py = satellite_python() if jobs_enabled() else None
    if f.source != "own" or py is None or f.satellite_status == "pending":
        return describe(db)
    f.satellite_status, f.satellite_note = "pending", "Getting the Sentinel-2 pictures of your field. This takes a few minutes."
    db.commit()
    start_job(py, f.lat, f.lon, f.side_m or side_for(f.area_ha))
    return describe(db)


def start_job(py: str, lat: float, lon: float, side: float):
    threading.Thread(target=_run_job, args=(py, lat, lon, side), daemon=True).start()


def _run_job(py: str, lat: float, lon: float, side: float):
    """Download in a separate process (it needs libraries the API does not), then read the result into the database."""
    ok, note = False, None
    with _lock:
        try:
            os.makedirs(OWN_DIR, exist_ok=True)
            r = subprocess.run([py, os.path.join(BACKEND_DIR, "scripts", "fetch_satellite.py"), "--lat", str(lat), "--lon", str(lon), "--side", str(side),
                                "--out-dir", OWN_DIR], capture_output=True, text=True, timeout=JOB_TIMEOUT_S, cwd=BACKEND_DIR)
            ok = r.returncode == 0
            if not ok:
                note = ((r.stdout + r.stderr).strip().splitlines() or ["The download failed."])[-1][:200]
        except subprocess.TimeoutExpired:
            note = "The download took too long. Try again later."
        except Exception as e:  # never let a job kill the server
            note = f"The download could not start ({type(e).__name__})."
    finish_job(lat, lon, ok, note)


def finish_job(lat: float, lon: float, ok: bool, note: str | None = None):
    with session_scope() as db:
        f = db.get(m.Field, 1)
        if f.source != "own" or abs(f.lat - lat) > 1e-6 or abs(f.lon - lon) > 1e-6:
            return                                            # the farmer moved the field meanwhile: this result is for the old one
        if ok:
            applied = apply_cache(db)
            f.satellite_status = "ready" if applied else "failed"
            f.satellite_note = None if applied else "No clear satellite picture of your field in the last months (clouds). Try again in a few days."
        else:
            f.satellite_status, f.satellite_note = "failed", note or "The download failed."
        db.commit()
        from .advice import refresh_advice
        refresh_advice(db)


def apply_cache(db: Session) -> dict:
    """Read the downloaded pixels: zone vigor (the last four clear dates) and the vigor-over-time series. Returns {zone: latest date}."""
    try:
        with open(os.path.join(OWN_DIR, "ndvi.json"), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    db.execute(delete(m.NdviObs).where(m.NdviObs.field_id == 1))
    for r in data.get("rows", []):
        for code, v in r.get("zones", {}).items():
            if v is not None:
                db.add(m.NdviObs(field_id=1, date=r["date"], zone_code=code, ndvi=v, clear_share=r.get("clear_pixel_share")))
    updated = {}
    for z in db.scalars(select(m.Zone).where(m.Zone.field_id == 1)).all():
        series = [(r["date"], r["zones"].get(z.code)) for r in data.get("rows", []) if r.get("zones", {}).get(z.code) is not None][-4:]
        if series:
            hist = [round(v, 3) for _, v in series]
            z.ndvi, z.ndvi_hist, z.ndvi_source = hist[-1], json.dumps(hist), f"sentinel-2 {series[-1][0]}"
            updated[z.code] = series[-1][0]
    db.commit()
    return updated
