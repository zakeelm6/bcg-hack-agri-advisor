import os
import tempfile

# One clean database for the whole test run, chosen BEFORE the app is imported (the settings are read at import). Without this the
# tests used backend/farm_advisor.db, the development database, and depended on whatever was left in it.
os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "tests.db")
os.environ.pop("FA_DATABASE_URL", None)

import pytest  # noqa: E402

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
    except Exception:   # the schema may not exist yet in a test that never started the app
        pass


@pytest.fixture(autouse=True, scope="session")
def no_satellite_downloads():
    """The tests never start a real satellite download."""
    import os
    os.environ["FA_SATELLITE_JOBS"] = "0"
    yield


@pytest.fixture(autouse=True, scope="session")
def no_live_weather():
    """The tests never call the real weather service: its forecast changes every day and would make results depend on it.
    Without a forecast the engine uses the labelled fallback (dry, a little rain on day three)."""
    from app.processing import geo
    original = geo._fetch
    def offline(*a, **k):
        raise OSError("weather service switched off in tests")
    geo._fetch = offline
    yield
    geo._fetch = original
