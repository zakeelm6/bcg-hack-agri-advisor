"""Step 3: what the farmer records (watering, spending) reaches the engine and the Copilot."""
import os
import tempfile
from datetime import date, datetime, timedelta

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from app.db import init_db, models as m, session_scope  # noqa: E402
from app.main import app  # noqa: E402
from app.processing import geo  # noqa: E402
from app.services.advice import refresh_advice  # noqa: E402

TODAY = datetime.utcnow().date()
DRY = [{"date": (TODAY + timedelta(days=i)).isoformat(), "rain": 0.0, "et0": 4.0, "tmax": 28.0, "tmin": 14.0} for i in range(5)]


@pytest.fixture(autouse=True)
def dry_weather(monkeypatch):
    monkeypatch.setattr(geo, "get_weather", lambda db, lat, lon, force=False: {"days": DRY, "source": "cache", "age_hours": 0.0})
    init_db()
    with session_scope() as db:                       # a clean list for every test
        for a in db.scalars(select(m.Activity)).all():
            db.delete(a)
        db.commit()
        refresh_advice(db)


def client():
    return TestClient(app)


def activity(cid="aaaaaaaa-0001", **kw):
    return {"client_id": cid, "type": "irrigation", "date": TODAY.isoformat(), "note": "Watered", **kw}


def open_irrigation(c):
    return [t for t in c.get("/api/state").json()["tasks"] if t["type"] == "irrigate" and t["status"] == "open"]


def test_an_activity_is_saved_once_listed_and_removed():
    with client() as c:
        assert c.post("/api/activities", json=activity(cost=120.5, zone="D", amount_mm=20)).status_code == 200
        assert c.post("/api/activities", json=activity(cost=120.5, zone="D", amount_mm=20)).status_code == 200   # the same entry sent again (retry)
        rows = c.get("/api/activities").json()["activities"]
        assert len(rows) == 1 and rows[0]["zone"] == "D" and rows[0]["amount_mm"] == 20 and rows[0]["cost"] == 120.5
        assert c.delete("/api/activities/aaaaaaaa-0001").json() == {"ok": True}
        assert c.delete("/api/activities/aaaaaaaa-0001").json() == {"ok": True}      # undo sent twice is harmless
        assert c.get("/api/activities").json()["activities"] == []


def test_bad_entries_are_refused():
    with client() as c:
        assert c.post("/api/activities", json=activity(type="dancing")).status_code == 422
        assert c.post("/api/activities", json=activity(date="yesterday")).status_code == 422
        assert c.post("/api/activities", json=activity(date=(TODAY + timedelta(days=5)).isoformat())).status_code == 422
        assert c.post("/api/activities", json=activity(zone="Z")).status_code == 404
        assert c.post("/api/activities", json=activity(cost=-5)).status_code == 422


def test_recorded_watering_makes_the_engine_wait_and_says_why():
    with client() as c:
        assert open_irrigation(c), "the demo field needs water on a dry week"
        c.post("/api/activities", json=activity(amount_mm=20))
        st = c.get("/api/state").json()
        assert not open_irrigation(c)
        note = next(a for a in st["alerts"] if a["key"] == "watered")
        assert "20 mm" in note["body"] and note["kind"] == "water"
        c.delete("/api/activities/aaaaaaaa-0001")                       # undone: the advice comes back
        assert open_irrigation(c) and not any(a["key"] == "watered" for a in c.get("/api/state").json()["alerts"])


def test_watering_of_one_zone_does_not_hold_back_the_others():
    with client() as c:
        zones = {t["zone_code"] for t in open_irrigation(c)}
        assert len(zones) >= 1
        z = sorted(zones)[0]
        c.post("/api/activities", json=activity(zone=z))
        assert z not in {t["zone_code"] for t in open_irrigation(c)}
        assert {t["zone_code"] for t in open_irrigation(c)} == zones - {z}


def test_an_old_watering_no_longer_holds_the_engine_back():
    with client() as c:
        c.post("/api/activities", json=activity(date=(TODAY - timedelta(days=3)).isoformat()))
        assert open_irrigation(c)


def test_the_note_follows_the_language():
    with client() as c:
        c.post("/api/activities", json=activity(amount_mm=15))
        for lang, word in (("fr", "Arrosage"), ("ar", "السقي"), ("ary", "السقي")):
            note = next(a for a in c.get(f"/api/state?lang={lang}").json()["alerts"] if a["key"] == "watered")
            assert word in note["title"] and "15 mm" in note["body"], lang


def test_a_done_task_comes_back_on_a_later_day_but_not_the_same_day():
    with client() as c:
        t = open_irrigation(c)[0]
        c.post(f"/api/tasks/{t['id']}/status", json={"status": "done"})
        with session_scope() as db:
            refresh_advice(db)
        assert not any(x["id"] == t["id"] and x["status"] == "open" for x in c.get("/api/state").json()["tasks"])   # same day: still the answer given
        with session_scope() as db:                                       # the answer is from yesterday: a new occasion
            row = db.get(m.Task, t["id"])
            row.when_date = (TODAY - timedelta(days=2)).isoformat()
            db.commit()
            refresh_advice(db)
        assert any(x["id"] == t["id"] and x["status"] == "open" for x in c.get("/api/state").json()["tasks"])


def test_the_offline_queue_can_send_and_undo_activities():
    with client() as c:
        r = c.post("/api/sync", json={"actions": [{"type": "activity", "payload": activity(cid="bbbbbbbb-0002", cost=50)},
                                                   {"type": "activity_remove", "payload": {"client_id": "bbbbbbbb-0002"}},
                                                   {"type": "activity", "payload": {"client_id": "x"}}]}).json()["results"]
        assert [x["ok"] for x in r] == [True, True, False]
        assert c.get("/api/activities").json()["activities"] == []


def test_the_copilot_answers_spending_questions_from_the_real_list_and_checks_numbers():
    with client() as c:
        none = c.post("/api/copilot", json={"question": "How are my costs looking?"}).json()
        assert none["intent"] == "spend" and "not recorded" in none["text"]
        c.post("/api/activities", json=activity(cid="cccccccc-0003", type="expense", note="Urea", cost=300))
        one = c.post("/api/copilot", json={"question": "How are my costs looking?"}).json()
        assert "300" in one["text"] and "one entry" in one["text"] and "times" not in one["text"]
        c.post("/api/activities", json=activity(cid="cccccccc-0004", type="expense", note="Seeds", cost=200.5))
        r = c.post("/api/copilot", json={"question": "How are my costs looking?"}).json()
        assert r["intent"] == "spend" and "500.5" in r["text"] and "2 times" in r["text"] and "Urea" in r["text"] and r["numbers_ok"] is True
        ary = c.post("/api/copilot", json={"question": "شحال صرفت؟", "lang": "ary"}).json()
        assert ary["intent"] == "spend" and "500.5" in ary["text"]
        chat = c.post("/api/chat", json={"question": "Combien j'ai dépensé ?", "lang": "fr"}).json()
        assert "500.5" in chat["recommendation"] and chat["steps"] == []


def test_a_question_about_the_cost_of_a_task_is_still_a_task_question():
    with client() as c:
        r = c.post("/api/copilot", json={"question": "How much does it cost?"}).json()
        assert r["intent"] == "cost"
