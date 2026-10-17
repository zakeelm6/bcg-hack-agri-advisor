"""Vegetation indices from Sentinel-2 bands.

Sentinel-2 gives 10 m pixels every ~5 days, free. A one-hectare plot is about
100 pixels, which is what makes within-field detection possible at all.

The formulas are trivial arithmetic. The hard parts are deciding which pixels
to trust (SCL masking, in `models.Scene.valid`) and what counts as abnormal
(`anomaly.py`).
"""

from __future__ import annotations

import numpy as np

EPS = 1e-6


def _safe_ratio(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Normalised difference with NaN where the denominator vanishes."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    denom = a + b
    out = np.full(denom.shape, np.nan, dtype=float)
    valid = np.abs(denom) > EPS
    out[valid] = (a[valid] - b[valid]) / denom[valid]
    return out


def ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Greenness: (NIR - red) / (NIR + red).

    Saturates at high biomass - a dense canopy and a very dense canopy look
    alike - so it is good at finding BAD patches and poor at ranking good
    ones. That asymmetry suits us: we are looking for problems.
    """
    return _safe_ratio(nir, red)


def ndre(red_edge: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Red-edge index: more sensitive to canopy nitrogen than NDVI.

    Useful because it separates a nitrogen problem from a water problem
    better than NDVI alone - though neither is diagnostic on its own.
    """
    return _safe_ratio(nir, red_edge)


def ndwi(nir: np.ndarray, swir: np.ndarray) -> np.ndarray:
    """Canopy water content: (NIR - SWIR) / (NIR + SWIR).

    The useful pairing: NDVI down AND NDWI down suggests water stress; NDVI
    down with NDWI steady points elsewhere (nutrient, disease, compaction).
    """
    return _safe_ratio(nir, swir)


def savi(red: np.ndarray, nir: np.ndarray, soil_factor: float = 0.5) -> np.ndarray:
    """Soil-Adjusted Vegetation Index.

    Early in the season the canopy is sparse and NDVI is dominated by the
    soil background, which varies with moisture and tillage. SAVI damps that
    with the L term, so it is the better index before canopy closure.

    L = 0.5 is the usual compromise; L -> 0 reduces SAVI to NDVI.
    """
    red = np.asarray(red, dtype=float)
    nir = np.asarray(nir, dtype=float)
    denom = nir + red + soil_factor
    out = np.full(denom.shape, np.nan, dtype=float)
    valid = np.abs(denom) > EPS
    out[valid] = ((nir[valid] - red[valid]) / denom[valid]) * (1.0 + soil_factor)
    return out


def from_bands(bands: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Compute every index the available bands allow.

    Takes a dict keyed by Sentinel-2 band id (B04, B08, B05, B11) and returns
    only the indices it can actually build, so a partial download degrades
    gracefully instead of raising.
    """
    out: dict[str, np.ndarray] = {}

    red, nir = bands.get("B04"), bands.get("B08")
    red_edge, swir = bands.get("B05"), bands.get("B11")

    if red is not None and nir is not None:
        out["ndvi"] = ndvi(red, nir)
        out["savi"] = savi(red, nir)
    if red_edge is not None and nir is not None:
        out["ndre"] = ndre(red_edge, nir)
    if swir is not None and nir is not None:
        out["ndwi"] = ndwi(nir, swir)

    return out


def field_stats(index: np.ndarray, mask: np.ndarray) -> dict:
    """Distribution of one index inside one field on one date.

    Everything downstream thresholds against THIS distribution rather than an
    absolute value, because a healthy NDVI depends on crop, stage and season.
    A fixed cutoff would flag an entire field during early growth.
    """
    vals = index[mask & np.isfinite(index)]
    if vals.size == 0:
        return {"n": 0, "mean": np.nan, "std": np.nan, "median": np.nan,
                "p10": np.nan, "p90": np.nan, "cv": np.nan}

    mean = float(np.mean(vals))
    std = float(np.std(vals))
    return {
        "n": int(vals.size),
        "mean": mean,
        "std": std,
        "median": float(np.median(vals)),
        "p10": float(np.percentile(vals, 10)),
        "p90": float(np.percentile(vals, 90)),
        # Coefficient of variation: how uneven the field is overall. A rising
        # CV across dates means the field is diverging from itself.
        "cv": float(std / mean) if abs(mean) > EPS else np.nan,
    }
