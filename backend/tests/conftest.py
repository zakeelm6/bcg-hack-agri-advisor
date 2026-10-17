import pytest

from app.core.ratelimit import copilot_brake, geo_brake, voice_brake


@pytest.fixture(autouse=True)
def fresh_brakes():
    """The rate limits are per process: without this the many Copilot calls of a full test run would hit the real limit."""
    for b in (copilot_brake, voice_brake, geo_brake):
        b._calls.clear()
    yield


@pytest.fixture(autouse=True)
def demo_field_restored():
    """A test that gives the farmer's position moves the engine to an own field; the next test must find the demo parcel again."""
    yield
    import json
    from sqlalchemy import select
    from app.db import models as m, session_scope
    from app.db.seed import SEED_ZONES
    from app.services import satellite_layer
    try:
        with session_scope() as db:
            f = db.get(m.Field, 1)
            if f is None or f.source == "demo":
                return
            f.source, f.satellite_status, f.satellite_note, f.side_m, f.boundary = "demo", "ready", None, None, None
            f.lat, f.lon, f.area_ha, f.crop = 33.27, -7.58, 2.4, "Potato"
            for z in db.scalars(select(m.Zone).where(m.Zone.field_id == 1)):
                hist = next(h for code, _c, _r, h in SEED_ZONES if code == z.code)
                z.area_ha, z.ndvi, z.ndvi_hist, z.ndvi_source = 0.6, hist[-1], json.dumps(hist), "simulated"
            db.commit()
            satellite_layer.use_cache(None)
    except Exception:   # the schema may not exist yet in a test that never started the app
        pass


@pytest.fixture(autouse=True, scope="session")
def no_satellite_downloads():
    """The tests never start a real satellite download."""
    import os
    os.environ["FA_SATELLITE_JOBS"] = "0"
    yield
