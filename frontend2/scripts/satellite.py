"""Sentinel-2 helpers (free data, no account): search scenes, read small windows, compute NDVI.

Source: Element84 "Earth Search" STAC catalog (sentinel-2-l2a). The images are public Cloud Optimized GeoTIFFs,
so only the few pixels of the field are downloaded, not whole tiles.
Run this file with the satellite environment:  .venv-sat/bin/python scripts/fetch_satellite.py
"""
from datetime import date, timedelta

import numpy as np
import rasterio
from pystac_client import Client
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

STAC_URL = "https://earth-search.aws.element84.com/v1"
VALID_SCL = {4, 5, 6, 7}   # 4 vegetation, 5 bare soil, 6 water, 7 low-probability cloud (kept, but see MAX_CLOUD)
MIN_REFLECTANCE_SUM = 0.05  # red + nir below this is too dark for a stable ratio
GOOD_SCL = {4, 5}          # pixels used for crop vigor: vegetation and bare soil only (no cloud, shadow, water, snow)


def find_scenes(lon, lat, days=90, max_cloud=60, radius_deg=0.002, max_items=60):
    """Scenes covering the point, newest first."""
    cat = Client.open(STAC_URL)
    d1 = date.today()
    s = cat.search(collections=["sentinel-2-l2a"], bbox=[lon - radius_deg, lat - radius_deg, lon + radius_deg, lat + radius_deg],
                   datetime=f"{d1 - timedelta(days=days)}/{d1}", query={"eo:cloud_cover": {"lt": max_cloud}}, max_items=max_items)
    return sorted(s.items(), key=lambda it: it.datetime, reverse=True)


def _scale_offset(asset):
    """Reflectance = DN * scale + offset. Newer scenes carry a -0.1 offset: ignoring it biases NDVI."""
    rb = (asset.extra_fields.get("raster:bands") or [{}])[0]
    return rb.get("scale", 0.0001), rb.get("offset", 0.0)


def read_ndvi(item, bbox, out_px=None):
    """NDVI and scene-classification mask for bbox=(west, south, east, north) in WGS84.
    Returns (ndvi float32 array with NaN where unusable, good bool array, info dict)."""
    arrays, scl = {}, None
    for band in ("red", "nir"):
        a = item.assets[band]
        with rasterio.open(a.href) as ds:
            b = transform_bounds("EPSG:4326", ds.crs, *bbox)
            win = from_bounds(*b, transform=ds.transform).round_offsets().round_lengths()
            win = rasterio.windows.Window(win.col_off, win.row_off, max(1, win.width), max(1, win.height))
            shape = out_px or (int(win.height), int(win.width))
            dn = ds.read(1, window=win, out_shape=shape, boundless=True, fill_value=0).astype("float32")
        sc, off = _scale_offset(a)
        arrays[band] = dn * sc + off
        arrays[band][dn == 0] = np.nan
        shape_ref = arrays[band].shape
    with rasterio.open(item.assets["scl"].href) as ds:
        b = transform_bounds("EPSG:4326", ds.crs, *bbox)
        win = from_bounds(*b, transform=ds.transform).round_offsets().round_lengths()
        win = rasterio.windows.Window(win.col_off, win.row_off, max(1, win.width), max(1, win.height))
        scl = ds.read(1, window=win, out_shape=shape_ref, boundless=True, fill_value=0, resampling=rasterio.enums.Resampling.nearest)
    red, nir = arrays["red"], arrays["nir"]
    # Dark pixels can come out with reflectance <= 0 after the offset: NDVI is meaningless there, so they are dropped.
    usable = (red > 0) & (nir > 0) & ((red + nir) >= MIN_REFLECTANCE_SUM)
    with np.errstate(invalid="ignore", divide="ignore"):
        ndvi = (nir - red) / (nir + red)
    good = np.isin(scl, list(GOOD_SCL)) & usable & np.isfinite(ndvi) & (ndvi >= -1) & (ndvi <= 1)
    ndvi = np.where(good, ndvi, np.nan).astype("float32")
    return ndvi, good, {"date": item.datetime.date().isoformat(), "cloud": item.properties.get("eo:cloud_cover"), "id": item.id}


def zone_means(ndvi, good, rows=2, cols=2, min_valid=0.5):
    """Mean NDVI per zone of a rows x cols grid; None when too few clear pixels. Zone order: A, B, C, D (row by row)."""
    h, w = ndvi.shape
    out = {}
    for r in range(rows):
        for c in range(cols):
            blk = ndvi[r * h // rows:(r + 1) * h // rows, c * w // cols:(c + 1) * w // cols]
            gd = good[r * h // rows:(r + 1) * h // rows, c * w // cols:(c + 1) * w // cols]
            out["ABCD"[r * cols + c]] = round(float(np.nanmean(blk)), 3) if gd.size and gd.mean() >= min_valid and np.isfinite(blk).any() else None
    return out
