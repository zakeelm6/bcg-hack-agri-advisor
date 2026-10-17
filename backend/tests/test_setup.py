"""Setup (Phase 4b): a farmer without sensors is served by satellite, weather and a water balance; the setup is kept across saves."""
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["FA_DB"] = os.path.join(_tmp, "setup.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.processing import engine  # noqa: E402

ZONES = [{"code": c, "col": col, "row": row, "area_ha": 0.6, "ndvi": 0.8, "ndvi_hist": [0.8, 0.8, 0.8, 0.8]} for c, col, row in [("A", 0, 0), ("B", 1, 0), ("C", 0, 1), ("D", 1, 1)]]
PAST = [{"date": f"2026-10-{d:02d}", "rain": r, "et0": 4.0} for d, r in zip(range(9, 16), [0, 0, 12, 0, 0, 0, 0])]


def test_water_balance_is_bounded_and_explained_in_four_languages():
    wb = engine.water_balance_moisture(PAST)
    assert wb and 0.08 <= wb[0] <= 0.40 and wb[1] == 12.0 and wb[2] == 7
    assert engine.water_balance_moisture([]) is None
    for lang in ("en", "fr", "ar", "ary"):
        est = engine.estimate_moisture(ZONES, {}, lang=lang, water_balance=wb)
        assert all(e["source"] == "water_balance" and e["confidence"] == "Low" and e["moisture"] == wb[0] and "12" in e["reason"] for e in est.values())
    none = engine.estimate_moisture(ZONES, {})
    assert all(e["moisture"] is None for e in none.values())


def test_no_sensors_setup_hides_the_demo_sensors_and_uses_the_water_balance():
    with TestClient(app) as c:
        s0 = c.get("/api/state").json()
        assert len(s0["sensors"]) == 2 and s0["data_notes"]["sensors"] == "simulated"
        r = c.post("/api/farmer", json={"has_sensors": "none", "connection": "sometimes", "advisor_phone": "+212600000000", "mode": "simple"}).json()
        assert r["saved"]
        s = c.get("/api/state?refresh=true").json()
        assert s["sensors"] == [] and s["data_notes"]["sensors"] == "none" and s["data_notes"]["setup"]["has_sensors"] == "none"
        # no zone gets a number from a sensor any more: water balance (Low), or the farmer's own soil sample and estimates around it
        assert all(z["moisture_source"] not in ("sensor", "offset", "sensor_flagged") for z in s["zones"])
        assert any(z["moisture_source"] == "water_balance" for z in s["zones"]) or any(z["moisture_source"] == "sample" for z in s["zones"])
        assert all(not z["has_sensor"] for z in s["zones"])
        # the setup survives an onboarding save that does not mention it
        c.post("/api/farmer", json={"crop": "tomatoes", "lang": "fr"})
        p = c.get("/api/farmer").json()["profile"]
        assert p["has_sensors"] == "none" and p["connection"] == "sometimes" and p["advisor_phone"] == "+212600000000" and p["mode"] == "simple"
        # back to shared sensors: the demo sensors return
        c.post("/api/farmer", json={"has_sensors": "shared"})
        assert len(c.get("/api/state?refresh=true").json()["sensors"]) == 2
        assert c.post("/api/farmer", json={"has_sensors": "maybe"}).status_code == 422
