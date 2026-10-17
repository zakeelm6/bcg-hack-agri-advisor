"""Fetch real Sentinel-2 crop vigor (NDVI) for the field and store it in the app database.

Usage (needs internet, run once before a demo, results are cached):
    .venv-sat/bin/python scripts/fetch_satellite.py --lat 32.6328 --lon -8.4368
    .venv-sat/bin/python scripts/fetch_satellite.py --from-cache      # re-apply the last download, no internet needed

What it does:
  1. finds Sentinel-2 L2A scenes over the field (Earth Search STAC catalog, free, no account);
  2. for each scene reads only the field's pixels (a ~155 m square = 2.4 ha, about 15 x 15 pixels at 10 m);
  3. drops clouds, shadows, water and very dark pixels (scene classification band), computes NDVI;
  4. averages NDVI over the 2 x 2 zones (A B / C D); a zone with under half clear pixels is skipped for that date;
  5. keeps the last 4 clear dates per zone and writes them to the database, plus a JSON cache in data/ that also holds the
     per-pixel NDVI of every date (used by the anomaly detector, see app/processing/satellite).
Limits (shown in the app): 10 m pixels are coarse for a 2.4 ha field, so each zone has only about 55 pixels.
"""
import argparse
import json
import math
import os
import sqlite3
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

ROOT = os.path.join(os.path.dirname(__file__), "..")
CACHE = os.path.join(ROOT, "data", "ndvi_cache.json")
SIDE_M = 155.0   # side of a 2.4 ha square


def bbox_for(lat, lon, side_m=SIDE_M):
    dlat = (side_m / 2) / 110540.0
    dlon = (side_m / 2) / (111320.0 * math.cos(math.radians(lat)))
    return (lon - dlon, lat - dlat, lon + dlon, lat + dlat)


def download(lat, lon, days, max_cloud):
    import numpy as np
    import satellite as sat
    scenes = sat.find_scenes(lon, lat, days=days, max_cloud=max_cloud)
    by_date = {}
    for it in scenes:
        d = it.datetime.date().isoformat()
        if d not in by_date or (it.properties.get("eo:cloud_cover") or 100) < (by_date[d].properties.get("eo:cloud_cover") or 100):
            by_date[d] = it
    rows = []
    for d in sorted(by_date):
        it = by_date[d]
        try:
            nd, good, info = sat.read_ndvi(it, bbox_for(lat, lon))
        except Exception as e:  # one broken scene must not stop the run
            print(f"  {d}: skipped ({type(e).__name__}: {e})")
            continue
        zm = sat.zone_means(nd, good)
        valid_share = round(float(good.mean()), 2)
        # the per-pixel NDVI (None where cloudy or unusable) feeds the anomaly detector in app/processing/satellite
        pixels = [[round(float(v), 3) if np.isfinite(v) else None for v in row] for row in nd]
        rows.append({"date": d, "scene": info["id"], "scene_cloud_pct": round(info["cloud"], 1) if info["cloud"] is not None else None,
                     "clear_pixel_share": valid_share, "zones": zm, "pixels": pixels})
        print(f"  {d}  scene cloud {info['cloud']:.0f}%  clear pixels {valid_share:.0%}  zones {zm}")
    return {"lat": lat, "lon": lon, "side_m": SIDE_M, "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
            "source": "Sentinel-2 L2A via Earth Search", "rows": rows}


LAND_SIDE_M = 480.0      # the picture covers 480 m x 480 m around the field (the field itself is 155 m)


def _png(rgb):
    """Minimal PNG writer for an (h, w, 3) uint8 array, so no imaging library is needed."""
    import struct
    import zlib
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def save_land_image(lat, lon, scene_hint=None):
    """True-colour picture of the land around the field from the clearest recent scene. Returns metadata or None."""
    import numpy as np
    import rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import Window, from_bounds
    import satellite as sat
    scenes = [it for it in sat.find_scenes(lon, lat, days=60, max_cloud=15)]
    if not scenes:
        return None
    it = min(scenes, key=lambda x: (x.properties.get("eo:cloud_cover") or 100))
    bbox = bbox_for(lat, lon, LAND_SIDE_M)
    bands = []
    for name in ("red", "green", "blue"):
        a = it.assets[name]
        with rasterio.open(a.href) as ds:
            b = transform_bounds("EPSG:4326", ds.crs, *bbox)
            win = from_bounds(*b, transform=ds.transform).round_offsets().round_lengths()
            win = Window(win.col_off, win.row_off, max(1, win.width), max(1, win.height))
            dn = ds.read(1, window=win, out_shape=(int(LAND_SIDE_M // 10), int(LAND_SIDE_M // 10)), boundless=True, fill_value=0).astype("float32")
        sc, off = sat._scale_offset(a)
        bands.append(np.clip(dn * sc + off, 0, 1))
    refl = np.stack(bands, axis=-1)
    img = np.clip((refl / 0.28) ** 0.8, 0, 1)                      # gain and gamma for a natural look
    out_dir = os.environ.get("FA_STATIC_DIR") or os.path.join(ROOT, "..", "frontend-legacy")   # the land picture is served by the API as /static/land.png
    open(os.path.join(out_dir, "land.png"), "wb").write(_png((img * 255).astype("uint8")))
    meta = {"date": it.datetime.date().isoformat(), "side_m": LAND_SIDE_M, "field_side_m": SIDE_M, "scene": it.id,
            "source": "Sentinel-2 L2A true colour, 10 m pixels", "px": int(LAND_SIDE_M // 10)}
    json.dump(meta, open(os.path.join(out_dir, "land.json"), "w"))
    return meta


def apply_to_db(data, crop=None):
    from app.core.config import settings
    from app.db import init_db
    init_db()
    conn = sqlite3.connect(settings.db)
    updated = {}
    conn.execute("DELETE FROM ndvi_obs WHERE field_id=1")
    for r in data["rows"]:           # the full clear-sky series, for the chart
        for code, v in r["zones"].items():
            if v is not None:
                conn.execute("INSERT OR REPLACE INTO ndvi_obs(field_id,date,zone_code,ndvi,clear_share) VALUES (1,?,?,?,?)",
                             (r["date"], code, v, r.get("clear_pixel_share")))
    for code in "ABCD":
        series = [(r["date"], r["zones"].get(code)) for r in data["rows"] if r["zones"].get(code) is not None]
        series = series[-4:]
        if not series:
            continue
        hist = [round(v, 3) for _, v in series]
        conn.execute("UPDATE zones SET ndvi=?, ndvi_hist=?, ndvi_source=? WHERE code=? AND field_id=1",
                     (hist[-1], json.dumps(hist), f"sentinel-2 {series[-1][0]}", code))
        updated[code] = (series[-1][0], hist)
    # The satellite shows vigor, not the crop species: unless you tell us, the crop stays "Not identified".
    conn.execute("UPDATE fields SET lat=?, lon=?, crop=? WHERE id=1", (data["lat"], data["lon"], crop or "Not identified"))
    conn.execute("DELETE FROM cache WHERE key LIKE 'wx:%'")  # weather must follow the new location
    conn.commit()
    conn.close()
    return updated


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lat", type=float, default=32.6328)
    ap.add_argument("--lon", type=float, default=-8.4368)
    ap.add_argument("--days", type=int, default=75)
    ap.add_argument("--max-cloud", type=float, default=60)
    ap.add_argument("--crop", default=None, help="crop grown on the parcel, if you know it (the satellite cannot tell)")
    ap.add_argument("--from-cache", action="store_true")
    a = ap.parse_args()
    if a.from_cache:
        data = json.load(open(CACHE))
        print(f"Using cache from {data['fetched_at']} ({len(data['rows'])} dates)")
    else:
        print(f"Searching Sentinel-2 scenes near lat {a.lat}, lon {a.lon} (last {a.days} days)...")
        data = download(a.lat, a.lon, a.days, a.max_cloud)
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump(data, open(CACHE, "w"), indent=1)
        print(f"Saved cache: {os.path.relpath(CACHE)}")
    if not data["rows"]:
        sys.exit("No usable scene found. The database was not changed.")
    updated = apply_to_db(data, a.crop)
    if not updated:
        sys.exit("No zone had enough clear pixels. The database was not changed.")
    try:
        meta = save_land_image(data["lat"], data["lon"])
        print(f"Land picture saved: frontend-legacy/land.png ({meta['date']}, {meta['px']}x{meta['px']} px)" if meta else "No clear scene for the land picture.")
    except Exception as e:  # the picture is optional: the app falls back to a plain background
        print(f"Land picture skipped ({type(e).__name__}: {e})")
    print("Database updated:")
    for code, (d, hist) in updated.items():
        print(f"  zone {code}: latest {hist[-1]} on {d}, history {hist}")


if __name__ == "__main__":
    main()
