"""Weather from Open-Meteo (no key). Cached in SQLite, with a labelled fallback so the app never breaks offline."""
import json
from datetime import datetime, timedelta

import httpx

from ..db.models import Cache

URL = "https://api.open-meteo.com/v1/forecast"
TTL_HOURS = 3


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
            "latitude": lat, "longitude": lon, "forecast_days": days, "timezone": "auto",
            "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration",
        },
        timeout=8,
    )
    r.raise_for_status()
    d = r.json()["daily"]
    return [
        {"date": d["time"][i], "rain": d["precipitation_sum"][i] or 0.0, "et0": d["et0_fao_evapotranspiration"][i] or 0.0,
         "tmax": d["temperature_2m_max"][i], "tmin": d["temperature_2m_min"][i]}
        for i in range(len(d["time"]))
    ]


def get_weather(db, lat, lon, force=False):
    """Returns {days, source: live|cache|fallback, age_hours}. `db` is a SQLAlchemy session used for the weather cache."""
    key = f"wx:{round(lat, 2)}:{round(lon, 2)}"
    row = db.get(Cache, key)
    now = datetime.utcnow()
    if row and not force:
        age = (now - datetime.fromisoformat(row.ts)).total_seconds() / 3600
        if age < TTL_HOURS:
            return {"days": json.loads(row.value), "source": "cache", "age_hours": round(age, 1)}
    try:
        days = _fetch(lat, lon)
        if row:
            row.value, row.ts = json.dumps(days), now.isoformat()
        else:
            db.add(Cache(key=key, value=json.dumps(days), ts=now.isoformat()))
        db.commit()
        return {"days": days, "source": "live", "age_hours": 0.0}
    except Exception:
        if row:
            age = (now - datetime.fromisoformat(row.ts)).total_seconds() / 3600
            return {"days": json.loads(row.value), "source": "cache", "age_hours": round(age, 1)}
        return {"days": _fallback(), "source": "fallback", "age_hours": None}
