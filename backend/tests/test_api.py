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


def test_sensor_reading_validation_and_latest_wins_on_same_second():
    with client() as c:
        assert c.post("/api/sensors/1/readings", json={"moisture": 0.9}).status_code == 422
        c.post("/api/sensors/1/readings", json={"moisture": 0.12})
        c.post("/api/sensors/1/readings", json={"moisture": 0.30})
        a = next(s for s in c.get("/api/state").json()["sensors"] if s["id"] == 1)
        assert a["moisture"] == 0.30
