"""Cross-layer tests (Phase 2): sensors -> engine, satellite -> engine, and the API they surface through.

The claims: a faulty sensor gives low confidence and a soil-test recommendation instead of a dose; a learned offset replaces the
nearest-sensor guess; a persistent satellite anomaly becomes an "Inspect" task pinned in the right zone and a GeoJSON layer.
"""
import json
import os
import tempfile
from datetime import datetime, timedelta

_tmp = tempfile.mkdtemp()
os.environ["FA_DB"] = os.path.join(_tmp, "layers.db")
os.environ["FA_NDVI_CACHE"] = os.path.join(_tmp, "no_cache.json")   # start with no satellite pixels

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db import models as m, session_scope  # noqa: E402
from app.processing import engine  # noqa: E402
from app.services import satellite_layer  # noqa: E402

WEATHER = {"days": [{"date": (datetime(2026, 10, 16) + timedelta(days=i)).date().isoformat(), "rain": 0.0, "tmin": 14, "tmax": 28, "et0": 4.0} for i in range(5)]}
FIELD = {"name": "F", "crop": "Potato", "area_ha": 2.4, "sowing_date": "2026-08-19", "cycle_days": 90}
ZONES = [{"code": c, "col": col, "row": row, "area_ha": 0.6, "ndvi": 0.8, "ndvi_hist": [0.8, 0.8, 0.8, 0.8]} for c, col, row in [("A", 0, 0), ("B", 1, 0), ("C", 0, 1), ("D", 1, 1)]]


def client():
    return TestClient(app)


# ---------------------------------------------------------------- engine, pure


def test_flagged_sensor_gives_no_dose_low_confidence_and_a_sample_alert():
    est, tasks, alerts = engine.build_advice(FIELD, ZONES, {"A": 0.30}, WEATHER, bad_sensors={"B": ["D06", "X02"]})
    assert est["B"]["moisture"] is None and est["B"]["confidence"] == "Low" and est["B"]["source"] == "sensor_flagged"
    assert "D06" in est["B"]["reason"]
    assert not any(t["type"] == "irrigate" and t["zone"] == "B" for t in tasks)          # no dose from a bad sensor
    assert any(a["key"] == "sensor:B" and a["kind"] == "data" for a in alerts)            # soil sample recommended instead
    for lang in ("fr", "ar"):
        _, _, al = engine.build_advice(FIELD, ZONES, {"A": 0.30}, WEATHER, bad_sensors={"B": ["D06"]}, lang=lang)
        assert any(a["key"] == "sensor:B" and a["title"] != alerts[0]["title"] for a in al)


def test_a_soil_sample_in_the_zone_beats_the_flagged_sensor():
    soil = {"B": {"zone_code": "B", "ph": None, "om_pct": None, "moisture": 0.18, "age_days": 0}}
    est, tasks, alerts = engine.build_advice(FIELD, ZONES, {"A": 0.30}, WEATHER, soil=soil, bad_sensors={"B": ["D06"]})
    assert est["B"]["source"] == "sample" and est["B"]["confidence"] == "High"
    assert any(t["type"] == "irrigate" and t["zone"] == "B" for t in tasks)
    assert not any(a["key"] == "sensor:B" for a in alerts)


def test_learned_offset_replaces_the_nearest_sensor_guess():
    base = engine.estimate_moisture(ZONES, {"A": 0.30})
    assert base["C"]["source"] == "estimate"
    off = {"C": {"sentinel": "A", "delta": -0.06, "sdrd": 0.01, "n": 6}}
    est = engine.estimate_moisture(ZONES, {"A": 0.30}, offsets=off)
    assert est["C"]["source"] == "offset" and est["C"]["moisture"] == 0.24 and est["C"]["confidence"] == "High"
    assert "6" in est["C"]["reason"] and "A" in est["C"]["reason"]
    few = engine.estimate_moisture(ZONES, {"A": 0.30}, offsets={"C": {**off["C"], "n": 2}})
    assert few["C"]["source"] == "estimate"                                              # too few samples: not used
    wobbly = engine.estimate_moisture(ZONES, {"A": 0.30}, offsets={"C": {**off["C"], "sdrd": 0.08}})
    assert wobbly["C"]["confidence"] == "Medium"


def test_satellite_anomaly_becomes_an_inspect_task_pinned_in_its_zone():
    an = [{"zone": "D", "severity": "high", "persistence": 4, "deviation": -0.27, "area_ha": 0.375, "x": 0.8, "y": 0.83, "last_date": "2026-10-12"}]
    _, tasks, alerts = engine.build_advice(FIELD, ZONES, {"A": 0.30}, WEATHER, anomalies=an)
    t = next(t for t in tasks if t["type"] == "inspect")
    assert t["zone"] == "D" and t["x"] == 0.8 and t["y"] == 0.83 and t["confidence"] == "Medium"
    assert "0.27" in t["why"] and "4" in t["why"] and "0.38" in t["why"]
    assert any(a["key"] == "stress:D" for a in alerts)
    assert len([t for t in tasks if t["type"] == "inspect"]) == 1                        # the zone-mean rule does not add a second one


# ---------------------------------------------------------------- through the API


def _post_readings(c, sensor_id, values):
    for v in values:
        assert c.post(f"/api/sensors/{sensor_id}/readings", json={"moisture": v}).status_code == 200


def test_a_faulty_sensor_through_the_api_says_it_cannot_be_sure():
    with client() as c:
        s = c.get("/api/state").json()
        sensor_b = next(x for x in s["sensors"] if x["zone_code"] == "B")
        _post_readings(c, sensor_b["id"], [0.7, 0.75, 0.8, 0.72, 0.78])                   # above saturation: C02/C03 every time
        s = c.get("/api/state").json()
        b = next(x for x in s["sensors"] if x["zone_code"] == "B")
        assert b["quality"] == "insufficient" and set(b["flags"]) & {"C02", "C03"}
        zb = next(z for z in s["zones"] if z["code"] == "B")
        assert zb["confidence"] == "Low" and zb["moisture"] is None and zb["sensor_quality"] == "insufficient"
        assert not any(t["type"] == "irrigate" and t["zone_code"] == "B" for t in s["tasks"])
        assert any(a["key"] == "sensor:B" for a in s["alerts"])
        with session_scope() as db:
            assert db.query(m.Reading).filter(m.Reading.sensor_id == sensor_b["id"]).count() >= 8   # nothing deleted


def test_soil_samples_teach_the_offset_between_a_zone_and_the_shared_sensor():
    with client() as c:
        s = c.get("/api/state").json()
        sensor_a = next(x for x in s["sensors"] if x["zone_code"] == "A")
        _post_readings(c, sensor_a["id"], [0.30, 0.30, 0.31, 0.30, 0.30])                 # clean recent sentinel readings to pair with
        for v in (0.21, 0.20, 0.22):
            assert c.post("/api/soil-tests", json={"zone_code": "C", "moisture": v}).status_code == 200
        s = c.get("/api/state").json()
        zc = next(z for z in s["zones"] if z["code"] == "C")
        assert zc["offset"] is not None and zc["offset"]["n"] == 3 and zc["offset"]["sentinel"] == "A"
        assert abs(zc["offset"]["delta"] - (0.21 - 0.30)) < 0.02                           # sentinel A reads about 0.30 in the demo data
        with session_scope() as db:
            assert db.query(m.PlotOffset).filter(m.PlotOffset.zone_code == "C").count() == 1


def test_anomaly_layer_is_honest_without_pixels_and_real_with_them():
    with client() as c:
        g = c.get("/api/zones/anomalies").json()
        assert g["available"] is False and g["features"] == [] and g["type"] == "FeatureCollection"
    # a small synthetic field: 12 x 12 pixels, a 3 x 3 patch collapses after the baseline dates
    import numpy as np
    rows = []
    for i in range(10):
        nd = np.full((12, 12), 0.80) + np.random.default_rng(i).normal(0, 0.01, (12, 12))
        if i >= 4:
            nd[8:11, 8:11] -= 0.30
        rows.append({"date": f"2026-09-{i + 1:02d}", "zones": {}, "pixels": [[round(float(v), 3) for v in r] for r in nd]})
    path = os.path.join(_tmp, "pixels.json")
    json.dump({"lat": 32.63, "lon": -8.44, "side_m": 120.0, "source": "test", "rows": rows}, open(path, "w"))
    os.environ["FA_NDVI_CACHE"] = path
    try:
        an = satellite_layer.anomalies_for_engine()
        assert len(an) == 1 and an[0]["zone"] == "D" and an[0]["persistence"] >= 3 and an[0]["pixels"] == 9
        with client() as c:
            g = c.get("/api/zones/anomalies?lang=fr").json()
            assert g["available"] is True and len(g["features"]) == 1 and g["features"][0]["properties"]["zone_code"] == "D"
            assert g["features"][0]["properties"]["action"] == "inspect"
            s = c.get("/api/state?refresh=true").json()
            t = next(t for t in s["tasks"] if t["type"] == "inspect")
            assert t["zone_code"] == "D" and t["x"] > 0.5 and t["y"] > 0.5
            assert s["data_notes"]["anomalies"] == "sentinel-2 pixels"
    finally:
        os.environ["FA_NDVI_CACHE"] = os.path.join(_tmp, "no_cache.json")
