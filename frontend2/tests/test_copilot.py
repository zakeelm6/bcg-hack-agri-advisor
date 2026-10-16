import json
import os
import tempfile

os.environ.setdefault("FA_DB", os.path.join(tempfile.mkdtemp(), "copilot.db"))

from fastapi.testclient import TestClient  # noqa: E402
from app import copilot, llm  # noqa: E402
from app.main import app  # noqa: E402

MODEL_ON = {"mode": "model", "provider": "fake", "model": "fake", "vision": True}
MODEL_OFF = {"mode": "engine", "provider": "none", "model": None, "vision": False}


def ask(c, q, task_id=None):
    return c.post("/api/copilot", json={"question": q, "task_id": task_id})


def test_intents():
    assert copilot.detect("Why irrigate zone D?")[0] == "why"
    assert copilot.detect("What is my plan B?")[0] == "planb"
    assert copilot.detect("what if I wait 3 days")[0:2] == ("whatif", 3)
    assert copilot.detect("pourquoi arroser ?")[0] == "why"
    assert copilot.detect("my leaves have a fungus")[0] == "diagnose"
    assert copilot.detect("blah blah")[0] == "unknown"


def test_engine_mode_answers_and_status(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_OFF)
    with TestClient(app) as c:
        assert c.get("/api/copilot/status").json()["mode"] == "engine"
        r = ask(c, "Why?").json()
        assert r["source"] == "engine" and r["text"].startswith("About")
        assert ask(c, "what is my plan today").json()["text"].startswith("You have")
        assert "cannot diagnose" in ask(c, "my plants have a disease").json()["text"]
        assert ask(c, "xyzzy").json()["text"] == copilot.HELP


def test_what_if_is_a_simulation_and_changes_nothing(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_OFF)
    with TestClient(app) as c:
        before = c.get("/api/state").json()["tasks"]
        r = ask(c, "What if I wait 2 days?").json()
        assert "wait 2 day" in r["text"] and "simulation" in r["text"]
        after = c.get("/api/state").json()["tasks"]
        assert [(t["id"], t["title"], t["status"]) for t in before] == [(t["id"], t["title"], t["status"]) for t in after]


def test_input_limits(monkeypatch):
    with TestClient(app) as c:
        assert ask(c, "   ").status_code == 422
        assert ask(c, "x" * 401).status_code == 422


def _draft_echo(system, user, **kw):
    start = user.index("may be empty):\n") + len("may be empty):\n")
    return user[start:user.index("\n\nWrite the answer.")]


def test_model_answer_is_used_when_numbers_are_in_the_facts(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_ON)
    monkeypatch.setattr(llm, "complete", _draft_echo)
    with TestClient(app) as c:
        r = ask(c, "Why?").json()
        assert r["source"] == "model" and r["numbers_ok"] is True


def test_model_answer_with_an_invented_number_is_rejected(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_ON)
    monkeypatch.setattr(llm, "complete", lambda *a, **k: "Apply 999 kg of fertilizer right now.")
    with TestClient(app) as c:
        r = ask(c, "Why?").json()
        assert r["source"] == "engine" and "rejected" in r["note"] and "999" in r["note"]
        assert "999" not in r["text"]


def test_model_failure_falls_back_to_the_engine(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_ON)
    monkeypatch.setattr(llm, "complete", lambda *a, **k: None)
    with TestClient(app) as c:
        r = ask(c, "Why?").json()
        assert r["source"] == "engine" and "did not answer" in r["note"]


def test_number_check_accepts_other_spellings_of_a_fact():
    facts = {"zones": [{"moisture_pct": 19}], "x": 0.194, "d": "2026-10-12"}
    assert llm.numbers_ok("Moisture is about 19% (0.19) on 12 October", facts)[0]
    ok, bad = llm.numbers_ok("Moisture is 42%", facts)
    assert not ok and bad == ["42"]


def test_vision_is_off_without_a_vision_model(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_OFF)
    with TestClient(app) as c:
        r = c.post("/api/vision", json={"photo": "data:image/jpeg;base64,AAAA", "zone": "D"}).json()
        assert r["available"] is False


def test_vision_never_returns_a_diagnosis(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_ON)
    monkeypatch.setattr(llm, "complete", lambda *a, **k: '```json\n{"observations":["yellow edges"],"possible_causes_to_check":["water"],"confidence":"high","diagnosis":"late blight"}\n```')
    with TestClient(app) as c:
        r = c.post("/api/vision", json={"photo": "data:image/jpeg;base64,AAAA", "zone": "D"}).json()
        assert r["available"] and r["diagnosis"] is None and r["confidence"] == "low"
        assert "blight" not in json.dumps(r)
    monkeypatch.setattr(llm, "complete", lambda *a, **k: "not json at all")
    with TestClient(app) as c:
        assert c.post("/api/vision", json={"photo": "data:image/jpeg;base64,AAAA"}).json()["available"] is False


def test_audit_log_records_questions(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_OFF)
    with TestClient(app) as c:
        ask(c, "When?")
        entries = c.get("/api/audit").json()["entries"]
        assert entries and entries[0]["kind"] == "question" and entries[0]["question"] == "When?"


def test_copilot_and_state_answer_in_french(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_OFF)
    with TestClient(app) as c:
        st = c.get("/api/state?lang=fr").json()
        en = c.get("/api/state").json()
        assert [t["id"] for t in st["tasks"]] == [t["id"] for t in en["tasks"]]
        assert any(t["title"].startswith("Irriguer") for t in st["tasks"])
        r = c.post("/api/copilot", json={"question": "Pourquoi ?", "lang": "fr"}).json()
        assert r["text"].startswith("À propos de") and r["source"] == "engine"
        w = c.post("/api/copilot", json={"question": "et si j'attends 2 jours ?", "lang": "fr"}).json()
        assert "Si vous attendez 2 jours" in w["text"] and "simulation" in w["text"]
        assert "diagnostiquer" in c.post("/api/copilot", json={"question": "ma plante a une maladie", "lang": "fr"}).json()["text"]
        assert c.get("/api/forecast?lang=fr").json()["advice"].startswith("Convenez")


def test_copilot_catalogue_is_complete():
    assert set(copilot.CT["en"]) == set(copilot.CT["fr"]) == set(copilot.CT["ar"])


def test_copilot_answers_in_arabic(monkeypatch):
    monkeypatch.setattr(llm, "provider_info", lambda: MODEL_OFF)
    with TestClient(app) as c:
        st = c.get("/api/state?lang=ar").json()
        assert any(t["title"].startswith("سقي") for t in st["tasks"])
        r = c.post("/api/copilot", json={"question": "لماذا؟", "lang": "ar"}).json()
        assert r["text"].startswith("بخصوص") and r["source"] == "engine"
        w = c.post("/api/copilot", json={"question": "ماذا لو انتظرت يومين؟", "lang": "ar"}).json()
        assert "محاكاة" in w["text"] and "يومين" in w["text"]
        assert "تشخيص" in c.post("/api/copilot", json={"question": "نبتتي فيها مرض", "lang": "ar"}).json()["text"]
