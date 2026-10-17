import os
import tempfile

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402
from app.db import models as m  # noqa: E402
from app.db.session import run_migrations  # noqa: E402
from app.main import app  # noqa: E402


def client():
    return TestClient(app)


def test_chat_returns_the_shape_the_react_copilot_displays():
    with client() as c:
        r = c.post("/api/chat", json={"question": "What should I do today?", "context": {"profile": {"crop": "Potato"}}})
        assert r.status_code == 200
        j = r.json()
        assert set(j) >= {"recommendation", "why", "steps", "missing"}
        assert isinstance(j["steps"], list) and isinstance(j["missing"], list) and j["recommendation"]


def test_chat_advice_comes_from_the_engine_tasks():
    with client() as c:
        tasks = [t for t in c.get("/api/state").json()["tasks"] if t["status"] == "open"]
        j = c.post("/api/chat", json={"question": "Why?"}).json()
        if tasks:
            assert j["recommendation"] in [t["title"] for t in tasks]
            assert any("Plan B" in s for s in j["steps"])


def test_chat_answers_in_the_requested_language():
    with client() as c:
        fr = c.post("/api/chat", json={"question": "Pourquoi ?", "lang": "fr"}).json()
        ar = c.post("/api/chat", json={"question": "لماذا؟", "lang": "ar"}).json()
        assert any("Plan B" in s for s in fr["steps"]) or fr["why"]
        assert any(0x0600 <= ord(ch) <= 0x06FF for ch in ar["why"] + ar["recommendation"])


def test_chat_rejects_an_empty_or_too_long_question():
    with client() as c:
        assert c.post("/api/chat", json={"question": "  "}).status_code == 422
        assert c.post("/api/chat", json={"question": "x" * 401}).status_code == 422


def test_cors_allows_the_react_dev_server_and_nobody_else():
    with client() as c:
        ok = c.options("/api/state", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
        assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
        no = c.options("/api/state", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
        assert "access-control-allow-origin" not in no.headers


def test_responses_are_typed_in_the_contract():
    with client() as c:
        spec = c.get("/openapi.json").json()
        ok_schema = spec["paths"]["/api/state"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        assert ok_schema["$ref"].endswith("StateOut")


def test_a_database_without_migration_history_is_adopted_not_rebuilt():
    url = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "old.db")
    eng = create_engine(url)
    m.Base.metadata.create_all(eng)                      # what the app created before migrations existed
    with eng.begin() as conn:
        conn.execute(text("INSERT INTO fields(id,name,crop,area_ha,lat,lon,sowing_date,cycle_days) VALUES (1,'Mine','Wheat',1.0,1,1,'2026-01-01',90)"))
    run_migrations(url)
    run_migrations(url)                                  # running twice changes nothing
    with eng.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0004"   # create_all made the current schema
        assert conn.execute(text("SELECT name FROM fields")).scalar() == "Mine"
    assert "tasks" in inspect(eng).get_table_names()


def test_a_new_database_is_created_by_migrations():
    url = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "new.db")
    run_migrations(url)
    names = set(inspect(create_engine(url)).get_table_names())
    assert {"fields", "zones", "sensors", "readings", "tasks", "alerts", "observations", "listings", "offers", "ndvi_obs",
            "soil_tests", "copilot_log", "cache", "plot_offsets", "alembic_version"} <= names
