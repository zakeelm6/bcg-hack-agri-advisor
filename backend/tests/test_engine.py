import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.processing import engine  # noqa: E402

FIELD = {"crop": "Potato", "area_ha": 2.4, "sowing_date": "2026-08-20", "cycle_days": 90}


def zones(d_ndvi=0.38):
    return [
        {"code": "A", "col": 0, "row": 0, "area_ha": 0.6, "ndvi": 0.72, "ndvi_hist": [0.72] * 4},
        {"code": "B", "col": 1, "row": 0, "area_ha": 0.6, "ndvi": 0.58, "ndvi_hist": [0.6, 0.59, 0.58, 0.58]},
        {"code": "C", "col": 0, "row": 1, "area_ha": 0.6, "ndvi": 0.55, "ndvi_hist": [0.56, 0.55, 0.55, 0.55]},
        {"code": "D", "col": 1, "row": 1, "area_ha": 0.6, "ndvi": d_ndvi, "ndvi_hist": [0.5, 0.46, 0.42, d_ndvi]},
    ]


def weather(rains=(0, 0, 0, 0, 0), tmin=15.0):
    return {"source": "test", "days": [
        {"date": f"2026-10-{16 + i}", "rain": r, "et0": 3.0, "tmax": 26.0, "tmin": tmin} for i, r in enumerate(rains)]}


SENSORS = {"A": 0.30, "B": 0.26}
NOW = datetime(2026, 10, 16, 8, 0)


def test_dry_zone_gets_bounded_irrigation_without_rain():
    _, tasks, _ = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW)
    irr = [t for t in tasks if t["type"] == "irrigate"]
    assert [t["zone"] for t in irr] == ["D"]
    assert "20 mm" in irr[0]["title"]
    assert irr[0]["confidence"] == "Medium"  # estimated from a neighbouring sensor, not measured


def test_no_irrigation_when_rain_is_coming():
    _, tasks, _ = engine.build_advice(FIELD, zones(), SENSORS, weather(rains=(0, 6, 0, 0, 0)), NOW)
    assert not [t for t in tasks if t["type"] == "irrigate"]


def test_irrigation_never_exceeds_cap():
    z = zones(d_ndvi=0.05)
    _, tasks, _ = engine.build_advice(FIELD, z, {"A": 0.10, "B": 0.10}, weather(), NOW)
    for t in tasks:
        if t["type"] == "irrigate":
            assert int(t["title"].split(",")[1].split()[0]) <= engine.MAX_IRRIGATION_MM


def test_fertilizer_skipped_before_heavy_rain():
    _, tasks, _ = engine.build_advice(FIELD, zones(), SENSORS, weather(rains=(12, 0, 0, 0, 0)), NOW)
    assert not [t for t in tasks if t["type"] == "fertilize"]


def test_fertilizer_dose_is_bounded():
    _, tasks, _ = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW)
    for t in tasks:
        if t["type"] == "fertilize":
            dose = int(t["title"].split(",")[1].split()[0])
            assert 20 <= dose <= 60 and dose % 5 == 0


def test_vigor_drop_creates_inspection_and_alert():
    _, tasks, alerts = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW)
    assert any(t["type"] == "inspect" and t["zone"] == "D" for t in tasks)
    assert any(a["key"] == "stress:D" for a in alerts)


def test_frost_alert():
    _, _, alerts = engine.build_advice(FIELD, zones(), SENSORS, weather(tmin=1.0), NOW)
    assert any(a["key"] == "frost" for a in alerts)


def test_zone_without_any_sensor_is_low_confidence():
    est = engine.estimate_moisture(zones(), {"A": 0.30})
    assert est["D"]["confidence"] == "Low"  # diagonal from the only sensor
    assert est["B"]["confidence"] == "Medium"


def test_harvest_forecast_range_and_label():
    f = engine.harvest_forecast(FIELD, zones())
    assert f["qty_min_t"] < f["qty_max_t"]
    assert f["confidence"] == "Low" and "Not validated" in f["note"]


# ---- soil tests ----
def soil(zone="D", ph=6.4, om=2.0, moisture=None, age=1):
    return {zone: {"ph": ph, "om_pct": om, "moisture": moisture, "age_days": age}}


def test_fresh_soil_sample_moisture_becomes_a_measurement():
    est, tasks, alerts = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil(moisture=0.21))
    assert est["D"]["source"] == "sample" and est["D"]["confidence"] == "High"
    irr = [t for t in tasks if t["type"] == "irrigate"][0]
    assert irr["confidence"] == "High"
    assert not any(a["key"] == "sample:D" for a in alerts)  # no more need to ask for a sample


def test_old_sample_moisture_is_ignored():
    est, _, alerts = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil(moisture=0.21, age=10))
    assert est["D"]["source"] == "estimate"
    assert any(a["key"] == "sample:D" for a in alerts)


def test_sensor_beats_sample_in_same_zone():
    est = engine.estimate_moisture(zones(), {"A": 0.30, "D": 0.20}, {"D": 0.35})
    assert est["D"]["source"] == "sensor" and est["D"]["moisture"] == 0.20


def test_organic_matter_changes_the_fertilizer_dose_within_bounds():
    base = {t["zone"]: int(t["title"].split(",")[1].split()[0]) for t in engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW)[1] if t["type"] == "fertilize"}
    rich = {t["zone"]: int(t["title"].split(",")[1].split()[0]) for t in engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil("B", om=4.0))[1] if t["type"] == "fertilize"}
    poor = {t["zone"]: int(t["title"].split(",")[1].split()[0]) for t in engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil("B", om=1.0))[1] if t["type"] == "fertilize"}
    assert rich["B"] == max(20, base["B"] - 10) and poor["B"] == min(60, base["B"] + 10)
    assert 20 <= rich["B"] <= 60 and 20 <= poor["B"] <= 60


def test_soil_test_raises_fertilizer_confidence():
    _, tasks, _ = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil("B", om=2.0))
    fz = {t["zone"]: t for t in tasks if t["type"] == "fertilize"}
    assert fz["B"]["confidence"] == "High" and fz["C"]["confidence"] == "Medium"


def test_ph_outside_range_raises_alert_but_normal_ph_does_not():
    _, _, bad = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil("C", ph=4.8))
    _, _, ok = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, soil("C", ph=6.4))
    assert any(a["key"] == "ph:C" for a in bad) and not any(a["key"] == "ph:C" for a in ok)


def test_zone_between_two_measurements_averages_them():
    est = engine.estimate_moisture(zones(), {"A": 0.30}, {"D": 0.18})
    # C touches both A (0.30) and D (0.18): its estimate must lie between the two, not copy one of them
    assert est["C"]["source"] == "estimate" and 0.18 < est["C"]["moisture"] < 0.30


# ---- what-if: wait N days ----
def test_waiting_never_reduces_the_water_needed_when_no_rain_comes():
    r = engine.what_if_wait(FIELD, zones(), SENSORS, weather(), {}, 2, NOW)
    assert r["available"] and r["irrigation"]
    for row in r["irrigation"]:
        assert row["after_mm"] is None or row["after_mm"] >= (row["now_mm"] or 0)
        assert row["after_mm"] is None or row["after_mm"] <= engine.MAX_IRRIGATION_MM


def test_what_if_is_unavailable_when_forecast_is_too_short():
    short = {"source": "test", "days": weather()["days"][:2]}
    assert engine.what_if_wait(FIELD, zones(), SENSORS, short, {}, 2, NOW)["available"] is False


# ---- French ----
import re as _re  # noqa: E402


def test_french_has_the_same_decisions_and_numbers_as_english():
    en = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, None, "en")
    fr = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, None, "fr")
    assert [t["key"] for t in en[1]] == [t["key"] for t in fr[1]]
    assert [a["key"] for a in en[2]] == [a["key"] for a in fr[2]]
    nums = lambda ts: [_re.findall(r"\d+(?:\.\d+)?", t["title"] + t["cost"]) for t in ts]
    assert nums(en[1]) == nums(fr[1])
    assert fr[1][0]["title"].startswith("Irriguer la zone")
    assert [t["confidence"] for t in en[1]] == [t["confidence"] for t in fr[1]]   # codes stay English for the interface logic


def test_unknown_language_falls_back_to_english():
    assert engine.tr("de", "today") == "Today" and engine.tr("fr", "today") == "Aujourd'hui"


def test_every_english_text_has_a_french_and_an_arabic_twin():
    assert set(engine.TEXTS["en"]) == set(engine.TEXTS["fr"]) == set(engine.TEXTS["ar"])


def test_arabic_has_the_same_decisions_and_numbers():
    en = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, None, "en")
    ar = engine.build_advice(FIELD, zones(), SENSORS, weather(), NOW, None, "ar")
    assert [t["key"] for t in en[1]] == [t["key"] for t in ar[1]]
    nums = lambda ts: [_re.findall(r"\d+(?:\.\d+)?", t["title"] + t["cost"].replace("m3", "").replace("م³", "")) for t in ts]
    assert nums(en[1]) == nums(ar[1])
    assert ar[1][0]["title"].startswith("سقي المنطقة")
