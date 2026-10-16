"""Farm Advisor API. Run: uvicorn app.main:app --reload  (from farm-advisor/)"""
import json
import os
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import time
from collections import deque

from . import copilot, engine, geo, llm
from .db import get_conn, init_db

app = FastAPI(title="Farm Advisor", version="0.1.0")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
MAX_PHOTO_CHARS = 400_000


@app.middleware("http")
async def no_stale_pages(request, call_next):
    """The site is updated often: make browsers ask again instead of reusing an old page, script or style."""
    resp = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static") or request.url.path == "/sw.js":
        resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.on_event("startup")
def _startup():
    init_db()
    refresh_advice()


def _rows(conn, sql, args=()):
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def _field(conn):
    return dict(conn.execute("SELECT * FROM fields WHERE id=1").fetchone())


def _zones(conn):
    zs = _rows(conn, "SELECT * FROM zones WHERE field_id=1 ORDER BY code")
    for z in zs:
        z["ndvi_hist"] = json.loads(z["ndvi_hist"])
    return zs


def _latest_sensors(conn):
    """Latest reading per sensor -> {zone_code: moisture} plus a detail list."""
    out, detail = {}, []
    for s in _rows(conn, "SELECT * FROM sensors WHERE field_id=1"):
        r = conn.execute("SELECT * FROM readings WHERE sensor_id=? ORDER BY ts DESC, id DESC LIMIT 1", (s["id"],)).fetchone()
        if r:
            out[s["zone_code"]] = r["moisture"]
            detail.append({**s, "moisture": r["moisture"], "updated_at": r["ts"], "simulated": bool(s["simulated"])})
    return out, detail


def _latest_soil(conn):
    """Latest soil test per zone, with its age in days. Used by the engine and shown in the app."""
    out = {}
    for r in _rows(conn, "SELECT * FROM soil_tests WHERE field_id=1 ORDER BY ts, id"):
        age = max(0, (datetime.utcnow() - datetime.fromisoformat(r["ts"])).days)
        out[r["zone_code"]] = {**r, "age_days": age}   # later rows overwrite earlier ones
    return out


def refresh_advice(force_weather=False):
    """Recompute tasks and alerts from current data. Keeps the status of tasks that still apply."""
    conn = get_conn()
    field, zones = _field(conn), _zones(conn)
    sensors, _ = _latest_sensors(conn)
    weather = geo.get_weather(field["lat"], field["lon"], force=force_weather)
    _, tasks, alerts = engine.build_advice(field, zones, sensors, weather, soil=_latest_soil(conn))
    now = datetime.utcnow().isoformat(timespec="seconds")
    keys = [t["key"] for t in tasks]
    for t in tasks:
        row = conn.execute("SELECT id FROM tasks WHERE key=?", (t["key"],)).fetchone()
        vals = (t["type"], t["zone"], t["title"], t["what"], t["when_text"], t["when_date"], t["why"], t["cost"],
                t["confidence"], t["conf_reason"], t["plan_b"], t["x"], t["y"], now)
        if row:
            conn.execute("UPDATE tasks SET type=?,zone_code=?,title=?,what=?,when_text=?,when_date=?,why=?,cost=?,"
                         "confidence=?,conf_reason=?,plan_b=?,x=?,y=?,updated_at=? WHERE key=?", vals + (t["key"],))
        else:
            conn.execute("INSERT INTO tasks(type,zone_code,title,what,when_text,when_date,why,cost,confidence,conf_reason,"
                         "plan_b,x,y,updated_at,field_id,key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)", vals + (t["key"],))
    if keys:
        conn.execute(f"DELETE FROM tasks WHERE status='open' AND key NOT IN ({','.join('?' * len(keys))})", keys)
    else:
        conn.execute("DELETE FROM tasks WHERE status='open'")
    for a in alerts:
        if not conn.execute("SELECT 1 FROM alerts WHERE key=?", (a["key"],)).fetchone():
            conn.execute("INSERT INTO alerts(key,kind,title,body,ts) VALUES (?,?,?,?,?)", (a["key"], a["kind"], a["title"], a["body"], now))
        else:
            conn.execute("UPDATE alerts SET title=?, body=? WHERE key=?", (a["title"], a["body"], a["key"]))
    conn.execute(f"DELETE FROM alerts WHERE key NOT IN ({','.join('?' * len(alerts))})", [a['key'] for a in alerts])
    conn.commit()
    conn.close()
    return weather


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/state")
def state(refresh: bool = False, lang: str = "en"):
    lang = lang if lang in ("en", "fr", "ar") else "en"
    weather = refresh_advice(force_weather=refresh) if refresh else None
    conn = get_conn()
    field, zones = _field(conn), _zones(conn)
    sensors, sensor_detail = _latest_sensors(conn)
    if weather is None:
        weather = geo.get_weather(field["lat"], field["lon"])
    soil = _latest_soil(conn)
    est, tasks_l, alerts_l = engine.build_advice(field, zones, sensors, weather, soil=soil, lang=lang)
    for z in zones:
        e = est[z["code"]]
        z.update({"moisture": e["moisture"], "moisture_source": e["source"], "confidence": e["confidence"], "conf_reason": e["reason"],
                  "has_sensor": z["code"] in sensors, "soil_test": soil.get(z["code"])})
    tasks = _rows(conn, "SELECT * FROM tasks WHERE field_id=1 ORDER BY when_date, id")
    alerts = _rows(conn, "SELECT * FROM alerts ORDER BY unread DESC, id")
    conn.close()
    if lang != "en":   # same tasks, same numbers, wording in the farmer's language (stored rows are English)
        loc = {t["key"]: t for t in tasks_l}
        for t in tasks:
            lt = loc.get(t["key"])
            if lt:
                for k in ("title", "what", "when_text", "why", "cost", "conf_reason", "plan_b"):
                    t[k] = lt[k]
        loc_a = {a["key"]: a for a in alerts_l}
        for a in alerts:
            la = loc_a.get(a["key"])
            if la:
                a["title"], a["body"] = la["title"], la["body"]
    return {"field": field, "zones": zones, "sensors": sensor_detail, "tasks": tasks, "alerts": alerts, "weather": weather,
            "soil_tests": sorted(soil.values(), key=lambda t: t["zone_code"]),
            "generated_at": datetime.utcnow().isoformat(timespec="seconds"),
            "data_notes": {"vigor": zones[0]["ndvi_source"] if zones else "none", "sensors": "simulated"}}


class Reading(BaseModel):
    moisture: float
    temp_c: float | None = None


@app.post("/api/sensors/{sensor_id}/readings")
def add_reading(sensor_id: int, r: Reading):
    if not 0.0 <= r.moisture <= 0.6:
        raise HTTPException(422, "moisture must be a fraction between 0 and 0.6")
    conn = get_conn()
    if not conn.execute("SELECT 1 FROM sensors WHERE id=?", (sensor_id,)).fetchone():
        conn.close()
        raise HTTPException(404, "unknown sensor")
    conn.execute("INSERT INTO readings(sensor_id,ts,moisture,temp_c) VALUES (?,?,?,?)",
                 (sensor_id, datetime.utcnow().isoformat(timespec="seconds"), r.moisture, r.temp_c))
    conn.commit()
    conn.close()
    refresh_advice()
    return {"ok": True}


class StatusBody(BaseModel):
    status: str


def _set_status(task_id, status):
    if status not in ("open", "done", "skipped"):
        raise HTTPException(422, "status must be open, done or skipped")
    conn = get_conn()
    cur = conn.execute("UPDATE tasks SET status=? WHERE id=?", (status, task_id))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(404, "unknown task")


@app.post("/api/tasks/{task_id}/status")
def task_status(task_id: int, b: StatusBody):
    _set_status(task_id, b.status)
    return {"ok": True}


class Observation(BaseModel):
    task_id: int | None = None
    result: str | None = None
    note: str | None = None
    photo: str | None = None
    yield_kg: float | None = None


def _add_observation(o: Observation):
    if o.photo and len(o.photo) > MAX_PHOTO_CHARS:
        raise HTTPException(413, "photo too large")
    conn = get_conn()
    conn.execute("INSERT INTO observations(task_id,result,note,photo,yield_kg,ts) VALUES (?,?,?,?,?,?)",
                 (o.task_id, o.result, o.note, o.photo, o.yield_kg, datetime.utcnow().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()


@app.post("/api/observations")
def add_observation(o: Observation):
    _add_observation(o)
    return {"ok": True}


@app.get("/api/ndvi-series")
def ndvi_series(lang: str = "en"):
    """Clear-sky NDVI per zone and date. Empty when the satellite data has not been downloaded (vigor is simulated then)."""
    conn = get_conn()
    zones = _zones(conn)
    rows = _rows(conn, "SELECT zone_code, date, ndvi, clear_share FROM ndvi_obs WHERE field_id=1 ORDER BY date, zone_code")
    conn.close()
    source = zones[0]["ndvi_source"] if zones else "none"
    return {"real": source.startswith("sentinel-2"), "source": source, "points": rows,
            "note": {"fr": "Les dates avec nuages, ombres ou trop peu de pixels clairs sont absentes. Pixels de 10 m : environ 55 par zone.",
                     "ar": "التواريخ ذات السحب أو الظلال أو البكسلات الصافية القليلة غير موجودة. بكسلات 10 م: حوالي 55 لكل منطقة."}.get(
                lang, "Dates with clouds, shadows or too few clear pixels are missing. 10 m pixels: about 55 per zone.")}


@app.get("/api/forecast")
def forecast(lang: str = "en"):
    conn = get_conn()
    field, zones = _field(conn), _zones(conn)
    listing = conn.execute("SELECT * FROM listings ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    f = engine.harvest_forecast(field, zones, lang=lang if lang in ("en", "fr", "ar") else "en")
    f["listing"] = dict(listing) if listing else None
    return f


@app.get("/api/offers")
def offers():
    conn = get_conn()
    rows = _rows(conn, "SELECT * FROM offers ORDER BY price_mad_kg DESC")
    conn.close()
    return {"simulated": True, "offers": rows}


@app.post("/api/listings")
def create_listing():
    conn = get_conn()
    field, zones = _field(conn), _zones(conn)
    f = engine.harvest_forecast(field, zones)
    conn.execute("INSERT INTO listings(field_id,status,qty_min_t,qty_max_t,created_at) VALUES (1,'published',?,?,?)",
                 (f["qty_min_t"], f["qty_max_t"], datetime.utcnow().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/offers/{offer_id}/accept")
def accept_offer(offer_id: int):
    conn = get_conn()
    row = conn.execute("SELECT status FROM offers WHERE id=?", (offer_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "unknown offer")
    conn.execute("UPDATE offers SET status=CASE WHEN id=? THEN 'accepted' ELSE 'declined' END", (offer_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


class SoilTest(BaseModel):
    zone_code: str
    ph: float | None = None
    om_pct: float | None = None
    moisture: float | None = None   # fraction (0.24 = 24%) measured when the sample was taken


def _add_soil_test(t: SoilTest):
    if t.ph is None and t.om_pct is None and t.moisture is None:
        raise HTTPException(422, "enter at least one value")
    if t.ph is not None and not 3.0 <= t.ph <= 10.0:
        raise HTTPException(422, "pH must be between 3 and 10")
    if t.om_pct is not None and not 0.0 <= t.om_pct <= 15.0:
        raise HTTPException(422, "organic matter must be between 0 and 15 %")
    if t.moisture is not None and not 0.03 <= t.moisture <= 0.6:
        raise HTTPException(422, "moisture must be between 3 and 60 %")
    conn = get_conn()
    if not conn.execute("SELECT 1 FROM zones WHERE field_id=1 AND code=?", (t.zone_code,)).fetchone():
        conn.close()
        raise HTTPException(404, "unknown zone")
    conn.execute("INSERT INTO soil_tests(field_id,zone_code,ph,om_pct,moisture,ts) VALUES (1,?,?,?,?,?)",
                 (t.zone_code, t.ph, t.om_pct, t.moisture, datetime.utcnow().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()
    refresh_advice()


@app.post("/api/soil-tests")
def add_soil_test(t: SoilTest):
    _add_soil_test(t)
    return {"ok": True}


# ---------------- Copilot and vision ----------------
_calls = deque(maxlen=60)   # timestamps of recent Copilot calls: a simple brake that protects a paid model key


def _rate_ok(limit=30, window=60):
    now = time.time()
    while _calls and now - _calls[0] > window:
        _calls.popleft()
    if len(_calls) >= limit:
        return False
    _calls.append(now)
    return True


def _inputs():
    conn = get_conn()
    field, zones = _field(conn), _zones(conn)
    sensors, _ = _latest_sensors(conn)
    soil = _latest_soil(conn)
    conn.close()
    return field, zones, sensors, geo.get_weather(field["lat"], field["lon"]), soil


def _log(kind, question, answer, source, ok, note=None):
    conn = get_conn()
    conn.execute("INSERT INTO copilot_log(ts,kind,question,answer,source,numbers_ok,note) VALUES (?,?,?,?,?,?,?)",
                 (datetime.utcnow().isoformat(timespec="seconds"), kind, question, answer, source, 1 if ok else 0, note))
    conn.commit()
    conn.close()


class CopilotBody(BaseModel):
    question: str
    task_id: int | None = None
    lang: str = "en"


@app.get("/api/copilot/status")
def copilot_status():
    info = llm.provider_info()
    return {"mode": info["mode"], "provider": info["provider"], "vision": info["vision"],
            "note": "Answers come from the model, checked against the facts." if info["mode"] == "model"
            else "Answers come from the rule engine. No language model is configured."}


@app.post("/api/copilot")
def copilot_ask(b: CopilotBody):
    q = b.question.strip()
    if not q:
        raise HTTPException(422, "type a question")
    if len(q) > copilot.MAX_QUESTION:
        raise HTTPException(422, f"keep the question under {copilot.MAX_QUESTION} characters")
    if not _rate_ok():
        raise HTTPException(429, "too many questions, wait a minute")
    lang = b.lang if b.lang in ("en", "fr", "ar") else "en"
    st = state(lang=lang)
    field, zones, sensors, weather, soil = _inputs()
    res = copilot.answer(q, st, b.task_id, lambda d: engine.what_if_wait(field, zones, sensors, weather, soil, d, lang=lang), lang)
    _log("question", q, res["text"], res["source"], res["numbers_ok"], res["note"])
    return res


class VisionBody(BaseModel):
    photo: str
    zone: str = "A"


@app.post("/api/vision")
def vision(b: VisionBody):
    if not _rate_ok():
        raise HTTPException(429, "too many requests, wait a minute")
    res = copilot.vision_notes(b.photo, b.zone)
    _log("photo", f"photo zone {b.zone}", json.dumps({k: v for k, v in res.items() if k != "photo"}), "model" if res["available"] else "none", True)
    return res


@app.get("/api/audit")
def audit():
    conn = get_conn()
    rows = _rows(conn, "SELECT ts, kind, question, answer, source, numbers_ok, note FROM copilot_log ORDER BY id DESC LIMIT 30")
    conn.close()
    return {"entries": rows}


class Action(BaseModel):
    type: str
    payload: dict = {}


class SyncBody(BaseModel):
    actions: list[Action]


@app.post("/api/sync")
def sync(b: SyncBody):
    """Replays actions queued on the phone while it was offline. Each result is reported separately."""
    results = []
    for a in b.actions:
        try:
            if a.type == "task_status":
                _set_status(int(a.payload["task_id"]), a.payload["status"])
            elif a.type == "observation":
                _add_observation(Observation(**a.payload))
            elif a.type == "soil_test":
                _add_soil_test(SoilTest(**a.payload))
            elif a.type == "listing":
                create_listing()
            elif a.type == "offer_accept":
                accept_offer(int(a.payload["offer_id"]))
            else:
                raise HTTPException(422, f"unknown action {a.type}")
            results.append({"type": a.type, "ok": True})
        except HTTPException as e:
            results.append({"type": a.type, "ok": False, "error": e.detail})
        except Exception as e:  # keep the batch going; report the failure
            results.append({"type": a.type, "ok": False, "error": str(e)})
    return {"results": results}


@app.get("/")
def home():
    """Serve the page with a version in the script and style URLs, so a changed file is never served from an old copy."""
    from fastapi.responses import HTMLResponse
    v = str(int(max(os.path.getmtime(os.path.join(STATIC_DIR, f)) for f in ("app.js", "i18n.js", "style.css", "index.html"))))
    html = open(os.path.join(STATIC_DIR, "index.html"), encoding="utf-8").read().replace("__V__", v)
    return HTMLResponse(html)


@app.get("/sw.js")
def sw():
    return FileResponse(os.path.join(STATIC_DIR, "sw.js"), media_type="application/javascript")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
