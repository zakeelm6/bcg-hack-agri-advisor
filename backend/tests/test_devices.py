"""Step 8: one farmer, one field, one phone. Each phone's token gives it a field of its own and nothing of another phone's is reachable."""
import os
import secrets
import tempfile
from datetime import date

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.core import ratelimit  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

LAT, LON = 33.2716, -7.5819


def phone():
    return {"X-Device": secrets.token_urlsafe(24)}


@pytest.fixture(scope="module")
def c():
    with TestClient(app) as client:
        yield client


def activity(client_id, **kw):
    return {"client_id": client_id, "type": "irrigation", "date": date.today().isoformat(), "note": "", "amount_mm": 20, **kw}


def test_every_phone_gets_a_field_of_its_own(c):
    a, b = phone(), phone()
    fa, fb = c.get("/api/state", headers=a).json()["field"], c.get("/api/state", headers=b).json()["field"]
    assert fa["id"] != fb["id"] and 1 not in (fa["id"], fb["id"])
    assert c.get("/api/state", headers=a).json()["field"]["id"] == fa["id"]            # the same token is the same field
    c.post("/api/farmer", headers=a, json={"crop": "wheat", "lat": LAT, "lon": LON, "area_ha": 4.0, "lang": "en"})
    assert c.get("/api/field", headers=a).json()["source"] == "own"
    assert c.get("/api/field", headers=b).json()["source"] == "demo"                    # B's field did not move
    assert c.get("/api/field").json()["source"] == "demo"                               # nor the shared demo field (no token)
    assert c.get("/api/state", headers=b).json()["field"]["crop"] == "Potato"
    assert c.get("/api/state", headers=a).json()["field"]["crop"] == "Wheat"


def test_activities_are_private_even_with_the_same_id(c):
    a, b = phone(), phone()
    c.get("/api/state", headers=a), c.get("/api/state", headers=b)
    assert c.post("/api/activities", headers=a, json=activity("same-id-0001", cost=300, type="expense", note="a's seeds")).status_code == 200
    assert c.get("/api/activities", headers=b).json()["activities"] == []
    assert c.post("/api/activities", headers=b, json=activity("same-id-0001", note="b's water")).status_code == 200   # no clash, no overwrite
    assert [x["note"] for x in c.get("/api/activities", headers=a).json()["activities"]] == ["a's seeds"]
    assert c.delete("/api/activities/same-id-0001", headers=b).status_code == 200
    assert len(c.get("/api/activities", headers=a).json()["activities"]) == 1           # B's undo did not touch A's entry


def test_a_phone_cannot_touch_the_tasks_sensors_or_offers_of_another(c):
    a, b = phone(), phone()
    tasks_b = c.get("/api/state", headers=b).json()["tasks"]
    c.get("/api/state", headers=a)
    assert tasks_b, "the demo field has advice to answer"
    tid = tasks_b[0]["id"]
    assert c.post(f"/api/tasks/{tid}/status", headers=a, json={"status": "done"}).status_code == 404
    assert c.post("/api/observations", headers=a, json={"task_id": tid, "result": "done"}).status_code == 404
    assert c.post(f"/api/tasks/{tid}/status", headers=b, json={"status": "done"}).status_code == 200
    sensors_b = c.get("/api/state", headers=b).json()["sensors"]
    assert c.post(f"/api/sensors/{sensors_b[0]['id']}/readings", headers=a, json={"moisture": 0.3}).status_code == 404
    offers_b = c.get("/api/offers", headers=b).json()["offers"]
    assert c.post(f"/api/offers/{offers_b[0]['id']}/accept", headers=a).status_code == 404
    assert c.post(f"/api/offers/{offers_b[0]['id']}/accept", headers=b).status_code == 200
    assert all(o["status"] == "open" for o in c.get("/api/offers", headers=a).json()["offers"])   # A's offers did not change


def test_soil_tests_and_the_audit_log_are_private(c):
    a, b = phone(), phone()
    c.get("/api/state", headers=a), c.get("/api/state", headers=b)
    assert c.post("/api/soil-tests", headers=a, json={"zone_code": "D", "ph": 6.5, "moisture": 0.24}).status_code == 200
    assert len(c.get("/api/state", headers=a).json()["soil_tests"]) == 1
    assert c.get("/api/state", headers=b).json()["soil_tests"] == []
    c.post("/api/copilot", headers=a, json={"question": "Why this task?", "lang": "en"})
    assert c.get("/api/audit", headers=a).json()["entries"] and not c.get("/api/audit", headers=b).json()["entries"]


def test_sync_replays_only_into_the_phones_own_field(c):
    a, b = phone(), phone()
    r = c.post("/api/sync", headers=a, json={"actions": [{"type": "activity", "payload": activity("sync-id-0001")}]}).json()
    assert r["results"][0]["ok"]
    assert len(c.get("/api/activities", headers=a).json()["activities"]) == 1 and c.get("/api/activities", headers=b).json()["activities"] == []


def test_a_bad_token_is_refused_and_no_token_means_the_shared_demo_field(c):
    assert c.get("/api/state", headers={"X-Device": "short"}).status_code == 401
    assert c.get("/api/state", headers={"X-Device": "x" * 40 + "!"}).status_code == 401
    assert c.get("/api/state").json()["field"]["id"] == 1


def test_a_public_server_can_refuse_requests_without_a_token(c, monkeypatch):
    monkeypatch.setattr(settings, "require_device", True)
    assert c.get("/api/state").status_code == 401
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/state", headers=phone()).status_code == 200


def test_registering_phones_is_limited(c, monkeypatch):
    known = phone()
    c.get("/api/state", headers=known)
    monkeypatch.setattr(ratelimit.device_brake, "allow", lambda: False)
    assert c.get("/api/state", headers=phone()).status_code == 429
    assert c.get("/api/state", headers=known).status_code == 200                        # a phone already registered is not affected
    monkeypatch.setattr(settings, "max_devices", 1)
    monkeypatch.setattr(ratelimit.device_brake, "allow", lambda: True)
    assert c.get("/api/state", headers=phone()).status_code == 503


def test_only_a_hash_of_the_token_is_stored(c):
    from sqlalchemy import select
    from app.db import models as m, session_scope
    h = phone()
    c.get("/api/state", headers=h)
    with session_scope() as db:
        hashes = [d.token_hash for d in db.scalars(select(m.Device))]
    assert h["X-Device"] not in hashes and all(len(x) == 64 for x in hashes)


def test_each_phone_has_its_own_satellite_folder(c, tmp_path, monkeypatch):
    from app.services import own_field
    monkeypatch.setattr(own_field, "OWN_DIR", str(tmp_path))
    assert own_field.own_dir(1) == str(tmp_path) and own_field.own_dir(7) == str(tmp_path / "7")
