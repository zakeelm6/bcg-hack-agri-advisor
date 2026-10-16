"""SQLite layer for Farm Advisor. Creates and seeds a demo field on first run.

Everything seeded here is DEMO DATA: the zone vigor values (NDVI) and the two sensors are
simulated, and are labelled as such in the API and the app.
"""
import json
import os
import sqlite3
from datetime import date, datetime, timedelta

DB_PATH = os.environ.get("FA_DB", os.path.join(os.path.dirname(__file__), "..", "farm_advisor.db"))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS fields (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, crop TEXT NOT NULL, area_ha REAL NOT NULL,
    lat REAL NOT NULL, lon REAL NOT NULL, sowing_date TEXT NOT NULL, cycle_days INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY, field_id INTEGER NOT NULL, code TEXT NOT NULL,
    col INTEGER NOT NULL, row INTEGER NOT NULL, area_ha REAL NOT NULL,
    ndvi REAL NOT NULL, ndvi_hist TEXT NOT NULL, ndvi_source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sensors (
    id INTEGER PRIMARY KEY, field_id INTEGER NOT NULL, zone_code TEXT NOT NULL,
    name TEXT NOT NULL, simulated INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY, sensor_id INTEGER NOT NULL, ts TEXT NOT NULL,
    moisture REAL NOT NULL, temp_c REAL
);
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY, field_id INTEGER NOT NULL, key TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
    zone_code TEXT NOT NULL, title TEXT NOT NULL, what TEXT NOT NULL, when_text TEXT NOT NULL,
    when_date TEXT NOT NULL, why TEXT NOT NULL, cost TEXT NOT NULL, confidence TEXT NOT NULL,
    conf_reason TEXT NOT NULL, plan_b TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
    x REAL NOT NULL, y REAL NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, title TEXT NOT NULL,
    body TEXT NOT NULL, unread INTEGER NOT NULL DEFAULT 1, ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY, task_id INTEGER, result TEXT, note TEXT, photo TEXT, yield_kg REAL, ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY, field_id INTEGER NOT NULL, status TEXT NOT NULL,
    qty_min_t REAL NOT NULL, qty_max_t REAL NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY, buyer TEXT NOT NULL, kind TEXT NOT NULL, price_mad_kg REAL NOT NULL,
    pickup TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS ndvi_obs (
    id INTEGER PRIMARY KEY, field_id INTEGER NOT NULL, date TEXT NOT NULL, zone_code TEXT NOT NULL,
    ndvi REAL NOT NULL, clear_share REAL, UNIQUE(field_id, date, zone_code)
);
CREATE TABLE IF NOT EXISTS soil_tests (
    id INTEGER PRIMARY KEY, field_id INTEGER NOT NULL, zone_code TEXT NOT NULL,
    ph REAL, om_pct REAL, moisture REAL, ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS copilot_log (
    id INTEGER PRIMARY KEY, ts TEXT NOT NULL, kind TEXT NOT NULL, question TEXT, answer TEXT NOT NULL,
    source TEXT NOT NULL, numbers_ok INTEGER NOT NULL DEFAULT 1, note TEXT
);
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, ts TEXT NOT NULL);
"""

# Demo field: a 2.4 ha plot in the Berrechid plain, split into 4 zones.
# NDVI values and the sensors are SIMULATED until the satellite pipeline is connected.
SEED_ZONES = [  # code, col, row, ndvi history (oldest -> latest)
    ("A", 0, 0, [0.71, 0.72, 0.72, 0.72]),
    ("B", 1, 0, [0.60, 0.59, 0.58, 0.58]),
    ("C", 0, 1, [0.56, 0.55, 0.55, 0.55]),
    ("D", 1, 1, [0.50, 0.46, 0.42, 0.38]),
]
SEED_SENSORS = [("A", "Sentinel sensor A"), ("B", "Sentinel sensor B")]
SEED_OFFERS = [
    ("School canteens network", "institution", 3.20, "Pickup at the village collection point"),
    ("Local trader", "trader", 3.00, "Collects from the field"),
    ("Village cooperative", "cooperative", 2.90, "Delivery to the cooperative store"),
]


def init_db():
    first_time = not os.path.exists(DB_PATH)
    conn = get_conn()
    conn.executescript(SCHEMA)
    if first_time or conn.execute("SELECT COUNT(*) n FROM fields").fetchone()["n"] == 0:
        sowing = (date.today() - timedelta(days=58)).isoformat()
        conn.execute(
            "INSERT INTO fields(id,name,crop,area_ha,lat,lon,sowing_date,cycle_days) VALUES (1,'Field A','Potato',2.4,33.27,-7.58,?,90)",
            (sowing,),
        )
        for code, col, row, hist in SEED_ZONES:
            conn.execute(
                "INSERT INTO zones(field_id,code,col,row,area_ha,ndvi,ndvi_hist,ndvi_source) VALUES (1,?,?,?,0.6,?,?,'simulated')",
                (code, col, row, hist[-1], json.dumps(hist)),
            )
        now = datetime.utcnow()
        base = {"A": 0.30, "B": 0.26}
        for code, name in SEED_SENSORS:
            cur = conn.execute("INSERT INTO sensors(field_id,zone_code,name,simulated) VALUES (1,?,?,1)", (code, name))
            for k, d in enumerate([2, 1, 0]):
                ts = (now - timedelta(days=d)).isoformat(timespec="seconds")
                conn.execute(
                    "INSERT INTO readings(sensor_id,ts,moisture,temp_c) VALUES (?,?,?,?)",
                    (cur.lastrowid, ts, round(base[code] + 0.01 * (2 - k), 3), 21.0),
                )
        for buyer, kind, price, pickup in SEED_OFFERS:
            conn.execute("INSERT INTO offers(buyer,kind,price_mad_kg,pickup) VALUES (?,?,?,?)", (buyer, kind, price, pickup))
    conn.commit()
    conn.close()
