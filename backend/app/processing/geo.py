"""Weather from Open-Meteo (no key). Cached in SQLite, with a labelled fallback so the app never breaks offline."""
import json
from datetime import datetime, timedelta

import httpx

from ..db.models import Cache

URL = "https://api.open-meteo.com/v1/forecast"
TTL_HOURS = 3
PAST_DAYS = 7   # the last week of rain and evaporation feeds the water balance used when the farmer has no sensor


def _fallback(days=5):
    d0 = datetime.utcnow().date()
    return [
        {"date": (d0 + timedelta(days=i)).isoformat(), "rain": r, "et0": 3.2, "tmax": 26.0, "tmin": 15.0}
        for i, r in enumerate([0.0, 0.0, 1.3, 0.0, 0.0][:days])
    ]


def _fetch(lat, lon, days=5):
    r = httpx.get(
        URL,
        params={
            "latitude": lat, "longitude": lon, "forecast_days": days, "past_days": PAST_DAYS, "timezone": "auto",
            "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration",
        },
        timeout=8,
    )
    r.raise_for_status()
    d = r.json()["daily"]
    rows = [
        {"date": d["time"][i], "rain": d["precipitation_sum"][i] or 0.0, "et0": d["et0_fao_evapotranspiration"][i] or 0.0,
         "tmax": d["temperature_2m_max"][i], "tmin": d["temperature_2m_min"][i]}
        for i in range(len(d["time"]))
    ]
    today = datetime.utcnow().date().isoformat()
    past = [x for x in rows if x["date"] < today]
    future = [x for x in rows if x["date"] >= today][:days]
    return future + [{**x, "past": True} for x in past]   # forecast first (the engine reads days[0..]), history flagged after it


def split(days):
    """(forecast days, past days) from a cached list; old caches have no past."""
    return [d for d in days if not d.get("past")], [d for d in days if d.get("past")]


def get_weather(db, lat, lon, force=False):
    """Returns {days (forecast), past (last week), source: live|cache|fallback, age_hours}. `db` is a SQLAlchemy session used for the weather cache."""
    key = f"wx:{round(lat, 2)}:{round(lon, 2)}"
    row = db.get(Cache, key)
    now = datetime.utcnow()
    if row and not force:
        age = (now - datetime.fromisoformat(row.ts)).total_seconds() / 3600
        if age < TTL_HOURS:
            f, p_ = split(json.loads(row.value))
            return {"days": f, "past": p_, "source": "cache", "age_hours": round(age, 1)}
    try:
        days = _fetch(lat, lon)
        if row:
            row.value, row.ts = json.dumps(days), now.isoformat()
        else:
            db.add(Cache(key=key, value=json.dumps(days), ts=now.isoformat()))
        db.commit()
        f, p_ = split(days)
        return {"days": f, "past": p_, "source": "live", "age_hours": 0.0}
    except Exception:
        if row:
            age = (now - datetime.fromisoformat(row.ts)).total_seconds() / 3600
            f, p_ = split(json.loads(row.value))
            return {"days": f, "past": p_, "source": "cache", "age_hours": round(age, 1)}
        return {"days": _fallback(), "past": [], "source": "fallback", "age_hours": None}
