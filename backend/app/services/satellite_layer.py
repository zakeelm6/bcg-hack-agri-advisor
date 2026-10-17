"""Satellite layer in the backend (Phase 2): the real Sentinel-2 pixels of the field go through the anomaly detector.

The detector (app/processing/satellite) learns each pixel's normal standing in the field from the early passes, then flags
pixels that stay below their own baseline on several passes. A persistent patch becomes an "Inspect" task in the engine and a
GeoJSON layer for the map. It says where, never why.
"""
import json
import math
import os
from datetime import date
from functools import lru_cache

import numpy as np

from ..core.config import BACKEND_DIR
from .common import ar_fallback
from ..processing.satellite import DetectionConfig, FieldGrid, Scene, detect, to_geojson

CACHE_FILE = os.path.join(BACKEND_DIR, "data", "ndvi_cache.json")
CONFIG = DetectionConfig(min_persistence=3, min_zone_pixels=4, edge_buffer_px=1, baseline_dates=4)


def cache_path(field: dict | None = None) -> str:
    """The file the pixels of this field are read from: the farmer's own download for an own field, else the demo parcel's.
    FA_NDVI_CACHE overrides both (tests and demos)."""
    if os.environ.get("FA_NDVI_CACHE"):
        return os.environ["FA_NDVI_CACHE"]
    if field and field.get("source") == "own":
        from .own_field import ndvi_path   # imported here: own_field does not import this module, but this keeps start-up light
        return ndvi_path(field["id"])
    return CACHE_FILE


def _load(path: str | None = None):
    try:
        with open(path or cache_path(), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def anomalies_available(field: dict | None = None) -> bool:
    d = _load(cache_path(field))
    return bool(d and any("pixels" in r for r in d.get("rows", [])))


def _grid_and_scenes(d: dict):
    rows = [r for r in d.get("rows", []) if r.get("pixels")]
    if not rows:
        return None, []
    n_rows, n_cols = len(rows[0]["pixels"]), len(rows[0]["pixels"][0])
    side = d.get("side_m", 155.0)
    origin_lat = d["lat"] + (side / 2) / 110540.0
    origin_lon = d["lon"] - (side / 2) / (111320.0 * math.cos(math.radians(d["lat"])))
    grid = FieldGrid(field_id="1", rows=n_rows, cols=n_cols, pixel_size_m=side / n_cols, origin_lat=origin_lat, origin_lon=origin_lon)
    scenes = []
    for r in rows:
        arr = np.array([[np.nan if v is None else v for v in row] for row in r["pixels"]], dtype=float)
        if arr.shape != (n_rows, n_cols):
            continue
        scenes.append(Scene(field_id="1", acquired=date.fromisoformat(r["date"]), ndvi=arr))
    return grid, scenes


@lru_cache(maxsize=4)
def _detect(path: str, mtime: float):
    d = _load(path)
    if not d:
        return None, []
    grid, scenes = _grid_and_scenes(d)
    if grid is None:
        return None, []
    return grid, detect(scenes, grid, CONFIG)


def detected(field: dict | None = None):
    """(grid, [AnomalyZone]) from the cache file; recomputed only when the file changes."""
    p = cache_path(field)
    try:
        return _detect(p, os.path.getmtime(p))
    except OSError:
        return None, []


def _zone_code(grid: FieldGrid, r: int, c: int) -> str:
    """Pixel -> demo zone (2 x 2: A B / C D)."""
    return "ABCD"[(0 if r < grid.rows / 2 else 2) + (0 if c < grid.cols / 2 else 1)]


def anomalies_for_engine(field: dict | None = None) -> list[dict]:
    """What the engine needs: one entry per anomaly with the zone, severity, persistence, deviation and the pin position (0..1 in the field)."""
    grid, zones = detected(field)
    if grid is None:
        return []
    out = []
    for z in zones:
        rs = [r for r, _ in z.pixel_indices]
        cs = [c for _, c in z.pixel_indices]
        r0, c0 = float(np.mean(rs)), float(np.mean(cs))
        out.append({"zone": _zone_code(grid, int(round(r0)), int(round(c0))), "zone_id": z.zone_id, "severity": z.severity,
                    "persistence": z.persistence, "deviation": z.mean_deviation, "area_ha": round(len(z.pixel_indices) * grid.pixel_size_m ** 2 / 10000, 3),
                    "pixels": len(z.pixel_indices), "x": round((c0 + 0.5) / grid.cols, 3), "y": round((r0 + 0.5) / grid.rows, 3),
                    "last_date": z.dates_seen[-1].isoformat() if z.dates_seen else None})
    return out


def geojson(lang: str = "en", field: dict | None = None) -> dict:
    """GeoJSON FeatureCollection of the persistent anomalies, plus honest metadata."""
    grid, zones = detected(field)
    d = _load(cache_path(field)) or {}
    if grid is None:
        return {"type": "FeatureCollection", "features": [], "available": False, "source": None, "dates": 0,
                "note": {"fr": "Pas encore de pixels Sentinel-2 : lancez scripts/fetch_satellite.py.",
                         "ar": "لا بكسلات Sentinel-2 بعد: شغّل scripts/fetch_satellite.py."}.get(ar_fallback(lang), "No Sentinel-2 pixels yet: run scripts/fetch_satellite.py.")}
    g = to_geojson(zones, grid)
    for f, a, z in zip(g["features"], anomalies_for_engine(field), zones):
        f["properties"].update({"zone_code": a["zone"], "x": a["x"], "y": a["y"], "cells": [[int(r), int(c)] for r, c in z.pixel_indices]})
    g.update({"available": True, "source": d.get("source"), "dates": sum(1 for r in d.get("rows", []) if r.get("pixels")),
              "grid": {"rows": grid.rows, "cols": grid.cols, "pixel_m": grid.pixel_size_m}, "config": {"min_persistence": CONFIG.min_persistence, "mad_threshold": CONFIG.mad_threshold},
              "note": {"fr": "Le satellite montre où, pas pourquoi. Une tache est signalée quand elle reste sous sa propre normale sur plusieurs passages.",
                       "ar": "القمر الصناعي يُظهر الموضع لا السبب. تُرصد البقعة عندما تبقى تحت معدلها عبر عدة مرور."}.get(ar_fallback(lang), "The satellite shows where, not why. A patch is reported when it stays below its own normal on several passes.")})
    return g
