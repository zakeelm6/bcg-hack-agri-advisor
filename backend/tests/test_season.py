"""Phase 4: season plan, verifier, missing questions and briefing. All deterministic; the model is never involved."""
import os
import tempfile
from datetime import date, timedelta

_tmp = tempfile.mkdtemp()
os.environ["FA_DB"] = os.path.join(_tmp, "season.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.processing import engine, season  # noqa: E402

WEATHER = {"days": [{"date": (date(2026, 10, 16) + timedelta(days=i)).isoformat(), "rain": 0.0, "tmin": 14, "tmax": 28, "et0": 4.0} for i in range(5)]}
FIELD = {"name": "F", "crop": "Potato", "area_ha": 2.4, "sowing_date": "2026-08-19", "cycle_days": 90}


def test_missing_answers_become_questions_and_assumptions_in_every_language():
    for lang in ("en", "fr", "ar", "ary"):
        q, a = season.needs_input({"crop": "tomatoes"}, FIELD, lang)
        assert [x["field"] for x in q] == ["planted_on", "area_ha", "irrigation", "location"]
        assert all(x["question"] for x in q) and len(a) >= 4
    q, a = season.needs_input({"crop": "tomatoes", "planted_on": "2026-09-01", "area_ha": 3, "irrigation": "drip", "location": "Berrechid"}, FIELD, "fr")
    assert q == [] and any("climatologie" in x for x in a)   # the plan still says what it assumes


def test_season_plan_numbers_are_computed_and_capped():
    plan = season.build_season_plan(FIELD, {"irrigation": "drip"}, today=date(2026, 10, 16))
    assert plan["crop_known"] and plan["cycle_days"] == 90 and plan["harvest_date"] == "2026-11-17"
    assert plan["week"] == 9 and plan["stage"]["key"] == "mid"
    irr = [t for s in plan["stages"] for t in s["tasks"] if t["type"] == "irrigate" and t["mm"] is not None]
    assert irr and all(5 <= t["mm"] <= engine.MAX_IRRIGATION_MM for t in irr)
    fert = [t for s in plan["stages"] for t in s["tasks"] if t["type"] == "fertilize"]
    assert sum(t["dose_kg_n_ha"] for t in fert) == plan["n_total_kg_ha"] == 120
    rain = season.build_season_plan(FIELD, {"irrigation": "rain-fed"}, today=date(2026, 10, 16))
    assert all(t["mm"] is None for s in rain["stages"] for t in s["tasks"] if t["type"] == "irrigate")
    unknown = season.build_season_plan({**FIELD, "crop": "Not identified"}, {}, today=date(2026, 10, 16), lang="ar")
    assert unknown["crop_known"] is False and unknown["confidence"] == "Low" and unknown["stage"]["label"]


def test_verifier_statuses():
    est = {"D": {"moisture": 0.20, "confidence": "Medium"}, "C": {"moisture": None, "confidence": "Low"}}
    ok = {"type": "irrigate", "zone": "D", "title": "Irrigate Zone D, 25 mm"}
    assert season.verify_task(ok, est, WEATHER, {}, {})["status"] == "verified"
    assert season.verify_task({**ok, "title": "Irrigate Zone D, 45 mm"}, est, WEATHER, {}, {})["status"] == "fixed"
    assert season.verify_task({"type": "irrigate", "zone": "C", "title": "Irrigate Zone C, 20 mm"}, est, WEATHER, {}, {})["status"] == "escalated"
    assert season.verify_task(ok, est, WEATHER, {}, {"D": ["D06"]})["status"] == "escalated"
    fert = {"type": "fertilize", "zone": "B", "title": "Fertilize Zone B, 50 kg N/ha"}
    assert season.verify_task(fert, est, WEATHER, {}, {})["status"] == "verified"
    wet = {**WEATHER, "days": [{**WEATHER["days"][0], "rain": 12.0}] + WEATHER["days"][1:]}
    assert season.verify_task(fert, est, wet, {}, {})["status"] == "escalated"
    assert season.verify_task({**fert, "title": "Fertilize Zone B, 80 kg N/ha"}, est, WEATHER, {}, {})["status"] == "fixed"
    for lang in ("fr", "ar", "ary"):
        assert season.verify_task(ok, est, WEATHER, {}, {}, lang=lang)["detail"] != season.verify_task(ok, est, WEATHER, {}, {})["detail"]


def test_api_exposes_verification_season_and_briefing():
    with TestClient(app) as c:
        s = c.get("/api/state").json()
        assert all(t["verify_status"] in ("verified", "fixed", "escalated") and t["verify_detail"] for t in s["tasks"])
        f = c.get("/api/farmer?lang=fr").json()
        assert f["needs_input"] and f["needs_input"][0]["question"] and f["assumptions"]
        p = c.get("/api/season?lang=ary").json()
        assert p["stages"] and p["stage"]["label"] and p["assumptions"] and p["source"].startswith("deterministic")
        b = c.get("/api/briefing?lang=fr").json()
        assert b["text"] and ("Aujourd'hui" in b["text"] or "Rien" in b["text"]) and "Météo" in b["text"]
        # the briefing never carries a number that is not in the tasks or the weather
        import re
        nums = set(re.findall(r"\d+(?:[.,]\d+)?", b["text"]))
        from datetime import date as _d
        nxt = next((st for st in p["stages"] if _d.fromisoformat(st["start"]) > _d.today()), None)
        facts = " ".join(t["title"] + t["when_text"] for t in s["tasks"]) + " ".join(str(round(d["tmax"])) + str(round(d["rain"])) for d in s["weather"]["days"]) + f" {p['week']} 5 " + (str((_d.fromisoformat(nxt["start"]) - _d.today()).days) if nxt else "")
        assert all(n.split(",")[0].split(".")[0] in facts for n in nums), (nums, b["text"])
