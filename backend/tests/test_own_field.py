"""Step 4: the farmer's own field replaces the demo parcel, and its satellite pictures are read when they arrive."""
import json
import os
import tempfile

os.environ["FA_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.db import session_scope  # noqa: E402
from app.main import app  # noqa: E402
from app.services import own_field  # noqa: E402

LAT, LON = 33.2716, -7.5819
PROFILE = {"location": "Berrechid", "crop": "tomatoes", "planted_on": "2026-09-01", "area_ha": 4.0, "lat": LAT, "lon": LON, "lang": "en"}


@pytest.fixture
def own_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(own_field, "OWN_DIR", str(tmp_path))
    monkeypatch.delenv("FA_NDVI_CACHE", raising=False)   # other tests point the layer at their own file; here it follows the field
    return tmp_path


def fake_download(own_dir, rows=None):
    rows = rows if rows is not None else [
        {"date": f"2026-09-{d:02d}", "clear_pixel_share": 0.9, "zones": {"A": 0.7 + i / 100, "B": 0.62, "C": 0.55, "D": 0.4},
         "pixels": [[0.6] * 12 for _ in range(12)]} for i, d in enumerate((2, 7, 12, 17, 22))]
    (own_dir / "ndvi.json").write_text(json.dumps({"lat": LAT, "lon": LON, "side_m": 200.0, "rows": rows}))


def client():
    return TestClient(app)


def test_the_position_moves_the_engine_to_the_farmers_field():
    with client() as c:
        r = c.post("/api/farmer", json=PROFILE).json()
        assert r["applied"]["position"] == {"lat": LAT, "lon": LON, "satellite": "none"}
        s = c.get("/api/state").json()
        assert s["field"]["source"] == "own" and (s["field"]["lat"], s["field"]["lon"]) == (LAT, LON) and s["field"]["area_ha"] == 4.0
        assert s["field"]["side_m"] == 200.0                                   # a 4 ha square is 200 m on a side
        assert all(z["ndvi"] is None and z["ndvi_source"] == "none" for z in s["zones"])
        assert abs(sum(z["area_ha"] for z in s["zones"]) - 4.0) < 0.01
        assert not [t for t in s["tasks"] if t["type"] in ("fertilize",)]       # no vigor rule without a satellite picture
        info = c.get("/api/field").json()
        assert info["source"] == "own" and info["satellite_status"] == "none" and "not set up" in info["satellite_note"] or "switched off" in info["satellite_note"]


def test_a_town_name_alone_does_not_move_the_field():
    with client() as c:
        r = c.post("/api/farmer", json={"location": "Meknes", "crop": "wheat"}).json()
        assert "position" not in r["applied"] and any("town name" in n for n in r["not_applied"])
        assert c.get("/api/field").json()["source"] == "demo"


def test_the_same_position_again_changes_nothing_and_a_move_starts_a_new_download(monkeypatch, own_dir):
    jobs = []
    monkeypatch.setenv("FA_SATELLITE_JOBS", "1")
    monkeypatch.setattr(own_field, "satellite_python", lambda: "/fake/python")
    monkeypatch.setattr(own_field, "start_job", lambda py, lat, lon, side, field_id=1: jobs.append((py, round(lat, 4), round(lon, 4), side)))
    with client() as c:
        assert c.post("/api/farmer", json=PROFILE).json()["applied"]["position"]["satellite"] == "pending"
        assert c.post("/api/farmer", json=PROFILE).json()["applied"]["position"]["satellite"] == "pending"   # same place: no second job
        assert len(jobs) == 1 and jobs[0] == ("/fake/python", LAT, LON, 200.0)
        c.post("/api/farmer", json={**PROFILE, "lat": LAT + 0.01})                                          # about a kilometre away
        assert len(jobs) == 2
        c.post("/api/farmer", json={**PROFILE, "lat": LAT + 0.01, "area_ha": 9.0})                          # much bigger: the square changes
        assert len(jobs) == 3 and jobs[2][3] == 300.0


def test_the_satellite_pictures_arrive_and_fill_the_zones(monkeypatch, own_dir):
    with client() as c:
        c.post("/api/farmer", json=PROFILE)
        fake_download(own_dir)
        (own_dir / "land.png").write_bytes(b"\x89PNG fake")
        (own_dir / "land.json").write_text(json.dumps({"date": "2026-09-22", "side_m": 600.0, "field_side_m": 200.0}))
        own_field.finish_job(LAT, LON, True)
        info = c.get("/api/field").json()
        assert info["satellite_status"] == "ready" and info["picture"]["field_side_m"] == 200.0
        zones = {z["code"]: z for z in c.get("/api/state").json()["zones"]}
        assert zones["D"]["ndvi"] == 0.4 and zones["D"]["ndvi_source"] == "sentinel-2 2026-09-22" and len(zones["A"]["ndvi_hist"]) == 4
        assert c.get("/api/ndvi-series").json()["real"] is True and len(c.get("/api/ndvi-series").json()["points"]) == 20
        assert c.get("/api/field/picture").status_code == 200
        assert c.get("/api/zones/anomalies").json()["available"] is True        # the pixels of the farmer's field, not the demo parcel's


def test_no_picture_yet_is_said_plainly(own_dir):
    with client() as c:
        c.post("/api/farmer", json=PROFILE)
        assert c.get("/api/field/picture").status_code == 404
        assert c.get("/api/zones/anomalies").json()["available"] is False
        f = c.get("/api/forecast").json()
        assert "no satellite picture" in f["note"]
        q = c.post("/api/copilot", json={"question": "Why?"}).json()
        assert q["numbers_ok"] is True


def test_a_failed_or_cloudy_download_is_reported_and_can_be_retried(monkeypatch, own_dir):
    started = []
    with client() as c:
        c.post("/api/farmer", json=PROFILE)
        own_field.finish_job(LAT, LON, False, "No usable scene found.")
        info = c.get("/api/field").json()
        assert info["satellite_status"] == "failed" and info["satellite_note"] == "No usable scene found."
        fake_download(own_dir, rows=[])                                         # downloaded, but no clear date
        own_field.finish_job(LAT, LON, True)
        assert "clouds" in c.get("/api/field").json()["satellite_note"]
        monkeypatch.setenv("FA_SATELLITE_JOBS", "1")
        monkeypatch.setattr(own_field, "satellite_python", lambda: "/fake/python")
        monkeypatch.setattr(own_field, "start_job", lambda *a: started.append(a))
        assert c.post("/api/field/satellite").json()["satellite_status"] == "pending" and len(started) == 1


def test_the_result_for_a_field_the_farmer_left_is_ignored(own_dir):
    with client() as c:
        c.post("/api/farmer", json=PROFILE)
        fake_download(own_dir)
        own_field.finish_job(LAT + 0.5, LON, True)                              # a job for a position that is no longer the field
        assert c.get("/api/field").json()["satellite_status"] == "none"


def test_the_download_runs_in_the_satellite_environment_with_the_right_square(monkeypatch, own_dir):
    seen = {}

    class Done:
        returncode, stdout, stderr = 0, "", ""

    monkeypatch.setattr(own_field.subprocess, "run", lambda cmd, **kw: (seen.update(cmd=cmd, kw=kw), Done())[1])
    monkeypatch.setattr(own_field, "finish_job", lambda lat, lon, ok, note=None, field_id=1: seen.update(done=(round(lat, 4), ok)))
    own_field._run_job("/fake/python", LAT, LON, 200.0)
    cmd = seen["cmd"]
    assert cmd[0] == "/fake/python" and cmd[1].endswith("fetch_satellite.py")
    assert cmd[cmd.index("--side") + 1] == "200.0" and cmd[cmd.index("--out-dir") + 1] == str(own_dir)
    assert seen["kw"]["timeout"] == own_field.JOB_TIMEOUT_S and seen["done"] == (LAT, True)


def test_the_square_follows_the_area():
    assert own_field.side_for(2.4) == 155.0 and own_field.side_for(0.1) == 90.0 and own_field.side_for(50) == 400.0
    assert own_field.centroid([[1.0, 2.0], [3.0, 2.0], [2.0, 5.0]]) == (2.0, 3.0)


def test_an_outline_places_the_field_at_its_centre():
    with client() as c:
        outline = [[LAT, LON], [LAT + 0.002, LON], [LAT + 0.002, LON + 0.002], [LAT, LON + 0.002]]
        c.post("/api/farmer", json={**PROFILE, "boundary": outline})
        f = c.get("/api/field").json()
        assert abs(f["lat"] - (LAT + 0.001)) < 1e-9 and abs(f["lon"] - (LON + 0.001)) < 1e-9 and f["boundary"] == outline
