"""Synthetic Sentinel-2 scenes, for development and for the demo.

Why this exists: Copernicus needs OAuth credentials, the download is slow,
and a hackathon venue's wifi is not a thing to bet a demo on. This produces
scenes with the same structure as real ones - management zones, a seasonal
growth curve, clouds, sensor noise - so the detection code is exercised
properly and we can inject a known stress patch to score against.

Every output of this module is labelled SIMULATED. We never present it as
a real acquisition.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

import numpy as np

from .models import FieldGrid, Scene


@dataclass
class FieldRecipe:
    """What the synthetic field should contain."""

    rows: int = 32
    cols: int = 40
    n_zones: int = 3                   # soil-driven management zones
    zone_strength: float = 0.08        # NDVI spread between zones

    # The stress patch we inject and then try to detect
    stress_row: tuple[int, int] = (4, 13)
    stress_col: tuple[int, int] = (26, 37)
    stress_depth: float = 0.18         # how far NDVI drops inside it
    stress_start_date: int = 5         # index into the date list

    # Acquisition realism
    revisit_days: int = 5
    n_dates: int = 12
    cloud_probability: float = 0.25
    noise: float = 0.015

    seed: int = 42


def _smooth(a: np.ndarray, passes: int = 3) -> np.ndarray:
    """Cheap box blur - gives spatially correlated structure, not white noise."""
    out = a.astype(float)
    for _ in range(passes):
        padded = np.pad(out, 1, mode="edge")
        out = (padded[:-2, 1:-1] + padded[2:, 1:-1] +
               padded[1:-1, :-2] + padded[1:-1, 2:] + out) / 5.0
    return out


def make_zones(recipe: FieldRecipe, rng: np.random.Generator) -> np.ndarray:
    """Stable soil zones: the part of the pattern that repeats every season.

    Real within-field variability is dominated by texture and topography,
    which do not move. That is exactly why a persistent anomaly is
    informative and a one-date anomaly is usually cloud.
    """
    base = rng.normal(0, 1, (recipe.rows, recipe.cols))
    smooth = _smooth(base, passes=6)
    smooth = (smooth - smooth.mean()) / (smooth.std() + 1e-9)

    # Quantise into discrete zones, the way fuzzy c-means would
    quantiles = np.quantile(smooth, np.linspace(0, 1, recipe.n_zones + 1)[1:-1])
    zone_idx = np.digitize(smooth, quantiles)

    offsets = np.linspace(-recipe.zone_strength, recipe.zone_strength,
                          recipe.n_zones)
    return offsets[zone_idx]


def growth_curve(day_index: int, total_days: int) -> float:
    """Seasonal NDVI: emergence, canopy closure, senescence.

    Matters because a fixed NDVI threshold is meaningless - 0.45 is healthy
    in March and alarming in May. Every threshold in anomaly.py is computed
    per date, from that date's own distribution.
    """
    t = day_index / max(total_days - 1, 1)
    if t < 0.15:
        return 0.15 + 2.0 * t                      # bare soil -> emergence
    if t < 0.55:
        return 0.45 + 1.1 * (t - 0.15)             # rapid growth
    if t < 0.75:
        return 0.89 - 0.1 * (t - 0.55)             # plateau at canopy closure
    return 0.87 - 1.9 * (t - 0.75)                 # senescence


def generate_field(recipe: Optional[FieldRecipe] = None
                   ) -> tuple[FieldGrid, list[Scene], np.ndarray]:
    """Build a field, a time series of scenes, and the truth mask.

    Returns (grid, scenes, truth_mask) where truth_mask marks the injected
    stress patch so detection can be scored rather than eyeballed.
    """
    recipe = recipe or FieldRecipe()
    rng = np.random.default_rng(recipe.seed)

    # Irregular plot boundary - real fields are not rectangles, and the
    # edge is where false positives come from.
    grid = FieldGrid(field_id="demo-field-01", rows=recipe.rows, cols=recipe.cols)
    mask = np.ones((recipe.rows, recipe.cols), dtype=bool)
    for r in range(recipe.rows):
        cut = int(3 * np.sin(r / 6.0) + 3)
        mask[r, :max(cut, 0)] = False
        mask[r, recipe.cols - max(cut, 0):] = False
    grid.mask = mask

    zones = make_zones(recipe, rng)

    truth = np.zeros((recipe.rows, recipe.cols), dtype=bool)
    truth[recipe.stress_row[0]:recipe.stress_row[1],
          recipe.stress_col[0]:recipe.stress_col[1]] = True
    truth &= mask

    start = date(2026, 3, 1)
    scenes: list[Scene] = []

    for i in range(recipe.n_dates):
        acquired = start + timedelta(days=i * recipe.revisit_days)
        level = growth_curve(i, recipe.n_dates)

        ndvi_arr = np.full((recipe.rows, recipe.cols), level) + zones
        ndvi_arr += rng.normal(0, recipe.noise, ndvi_arr.shape)

        # Inject the stress, ramping in rather than appearing at full depth
        if i >= recipe.stress_start_date:
            ramp = min(1.0, (i - recipe.stress_start_date + 1) / 3.0)
            ndvi_arr[truth] -= recipe.stress_depth * ramp

        # Clouds: a blob, plus its shadow offset a few pixels. The shadow is
        # the dangerous one - it looks exactly like crop stress.
        scl = np.full((recipe.rows, recipe.cols), 4, dtype=int)
        cloud_fraction = 0.0
        if rng.random() < recipe.cloud_probability:
            cr = rng.integers(0, recipe.rows)
            cc = rng.integers(0, recipe.cols)
            radius = rng.integers(5, 12)
            rr, cc_grid = np.ogrid[:recipe.rows, :recipe.cols]
            blob = (rr - cr) ** 2 + (cc_grid - cc) ** 2 < radius ** 2
            scl[blob] = 9                                  # cloud high prob
            ndvi_arr[blob] = rng.uniform(0.0, 0.2, blob.sum())

            shadow = np.roll(np.roll(blob, 4, axis=0), 3, axis=1)
            scl[shadow & ~blob] = 3                        # cloud shadow
            ndvi_arr[shadow & ~blob] -= 0.25
            cloud_fraction = float(blob.sum()) / blob.size

        ndvi_arr[~mask] = np.nan
        scl[~mask] = 0

        scenes.append(Scene(field_id=grid.field_id, acquired=acquired,
                            ndvi=np.clip(ndvi_arr, -1, 1), scl=scl,
                            cloud_fraction=round(cloud_fraction, 3)))

    return grid, scenes, truth
