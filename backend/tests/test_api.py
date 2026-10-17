import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["FA_DB"] = os.path.join(_tmp, "test.db")   # must be set before the app is imported

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db import models as m, session_scope  # noqa: E402


def client():
    return TestClient(app)


def test_state_has_zones_tasks_and_notes():
    with client() as c:
        d = c.get("/api/state").json()
        assert [z["code"] for z in d["zones"]] == list("ABCD")
        assert d["data_notes"]["sensors"] == "simulated"
        assert all("confidence" in z for z in d["zones"])


def test_ndvi_series_is_empty_until_real_data_is_loaded():
    with client() as c:
        j = c.get("/api/ndvi-series").json()
        assert j["real"] is False and j["points"] == []


def test_ndvi_series_returns_stored_points_sorted_by_date():
    with client() as c:
        with session_scope() as db:
            for d, v in [("2026-10-02", 0.52), ("2026-09-12", 0.575), ("2026-10-12", 0.621)]:
                db.add(m.NdviObs(field_id=1, date=d, zone_code="D", ndvi=v, clear_share=1.0))
            for z in db.query(m.Zone).all():
                z.ndvi_source = "sentinel-2 2026-10-12"
            db.commit()
        j = c.get("/api/ndvi-series").json()
        assert j["real"] is True
        assert [p["date"] for p in j["points"]] == ["2026-09-12", "2026-10-02", "2026-10-12"]


def test_soil_test_validation():
    with client() as c:
        assert c.post("/api/soil-tests", json={"zone_code": "D", "ph": 14}).status_code == 422
        assert c.post("/api/soil-tests", json={"zone_code": "D"}).status_code == 422
        assert c.post("/api/soil-tests", json={"zone_code": "Z", "ph": 6}).status_code == 404
        assert c.post("/api/soil-tests", json={"zone_code": "D", "ph": 6.4, "om_pct": 2.0}).status_code == 200


def test_sync_reports_each_action_separately():
    with client() as c:
        r = c.post("/api/sync", json={"actions": [
            {"type": "soil_test", "payload": {"zone_code": "C", "ph": 6.5}},
            {"type": "task_status", "payload": {"task_id": 99999, "status": "done"}},
            {"type": "bogus", "payload": {}}]}).json()["results"]
        assert [x["ok"] for x in r] == [True, False, False]


def test_sensor_reading_is_flagged_not_refused_and_latest_good_wins():
    """Phase 2: an impossible value is stored with a quality flag (never deleted) and does not become the sensor's moisture."""
    with client() as c:
        assert c.post("/api/sensors/1/readings", json={"moisture": 3.0}).status_code == 422      # not a fraction at all
        assert c.post("/api/sensors/1/readings", json={"moisture": 0.9}).status_code == 200      # stored, flagged C02
        c.post("/api/sensors/1/readings", json={"moisture": 0.12})
        c.post("/api/sensors/1/readings", json={"moisture": 0.30})
        a = next(s for s in c.get("/api/state").json()["sensors"] if s["id"] == 1)
        assert a["moisture"] == 0.30
        assert "C02" in a["flags"]
        with session_scope() as db:
            rows = db.query(m.Reading).filter(m.Reading.sensor_id == 1).order_by(m.Reading.id).all()
            assert any(r.moisture == 0.9 and "C02" in r.flags for r in rows)      # still there, flagged


def test_offers_carry_the_harvest_value_computed_on_the_server():
    """The app displays the value of the harvest at each price; it never multiplies numbers itself."""
    with client() as c:
        f = c.get("/api/forecast").json()
        j = c.get("/api/offers").json()
        assert j["simulated"] is True
        mid_kg = (f["qty_min_t"] + f["qty_max_t"]) / 2 * 1000
        assert j["harvest_mid_t"] == round(mid_kg / 1000, 1)
        for o in j["offers"]:
            assert o["est_value_mad"] % 1000 == 0
            assert abs(o["est_value_mad"] - mid_kg * o["price_mad_kg"]) <= 500


def test_farmer_profile_reaches_the_engine_and_says_what_it_could_not_use():
    with client() as c:
        assert c.get("/api/farmer").json()["saved"] in (False, True)
        r = c.post("/api/farmer", json={"location": "Berrechid", "crop": "tomatoes", "planted_on": "2026-09-01", "area_ha": 3.2, "irrigation": "drip", "challenge": "water", "lat": 33.2, "lon": -7.5, "lang": "fr"}).json()
        assert r["saved"] and r["applied"] == {"crop": "Tomato", "sowing_date": "2026-09-01", "area_ha": 3.2}
        assert len(r["not_applied"]) == 2 and "Position" in r["not_applied"][0]
        s = c.get("/api/state").json()
        assert s["field"]["crop"] == "Tomato" and s["field"]["area_ha"] == 3.2 and s["field"]["sowing_date"] == "2026-09-01"
        assert abs(sum(z["area_ha"] for z in s["zones"]) - 3.2) < 0.01
        assert c.get("/api/forecast").json()["crop"] == "Tomato"
        assert c.get("/api/farmer").json()["profile"]["location"] == "Berrechid"
        assert c.post("/api/farmer", json={"area_ha": -1}).status_code == 422
        # replay through the offline queue works too
        j = c.post("/api/sync", json={"actions": [{"type": "farmer", "payload": {"crop": "wheat"}}]}).json()
        assert j["results"][0]["ok"] and c.get("/api/state").json()["field"]["crop"] == "Wheat"
