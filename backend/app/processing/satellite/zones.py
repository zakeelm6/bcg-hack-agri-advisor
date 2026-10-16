"""Management zones from multi-date NDVI history.

This is the module that replaces interpolation. With two or three sensors
in a village you cannot estimate a variogram, so kriging or IDW across them
is not a map - it is noise with a confidence interval drawn on it.

Instead: the satellite gives ~100 observations per hectare per pass, over
many passes. Cluster the *stable* part of that history and you get zones
that are real, repeatable and free.

Zones answer "which parts of this field behave alike". The sentinel node
then supplies the time dynamics within each zone, via its learned offset.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence

import numpy as np

from .anomaly import robust_stats
from .models import FieldGrid, Scene


@dataclass
class ManagementZone:
    zone_id: str
    field_id: str
    pixel_indices: list[tuple[int, int]] = field(default_factory=list)
    mean_vigour: float = 0.0        # average NDVI rank within the field
    stability: float = 0.0          # 1 = identical pattern every pass
    rank: int = 0                   # 1 = weakest zone

    @property
    def area_ha(self) -> float:
        return len(self.pixel_indices) * 100.0 / 10_000.0

    @property
    def n_pixels(self) -> int:
        return len(self.pixel_indices)


def stable_pattern(scenes: Sequence[Scene], grid: FieldGrid,
                   edge_buffer_px: int = 1) -> tuple[np.ndarray, np.ndarray]:
    """The part of the within-field pattern that repeats across dates.

    Each scene is converted to a per-date anomaly (pixel minus the field
    median, divided by MAD) before averaging. That removes the seasonal
    growth curve, so March and May contribute on the same footing - which
    is the whole reason this can be averaged at all.

    Returns (mean_pattern, stability) where stability is 1 minus the
    normalised spread across dates: high where the pixel behaves the same
    way every pass.
    """
    interior = grid.interior(edge_buffer_px)
    stack: list[np.ndarray] = []

    for scene in scenes:
        usable = scene.valid & interior
        if usable.sum() < 8:
            continue
        med, sigma = robust_stats(scene.ndvi[usable])
        if not np.isfinite(sigma) or sigma < 1e-6:
            continue
        z = np.full(scene.ndvi.shape, np.nan)
        z[usable] = (scene.ndvi[usable] - med) / sigma
        stack.append(z)

    if not stack:
        return (np.full((grid.rows, grid.cols), np.nan),
                np.zeros((grid.rows, grid.cols)))

    cube = np.stack(stack)
    # Pixels masked on every pass (outside the plot) are all-NaN columns;
    # computing a mean over them is valid but noisy in the logs.
    all_nan = np.all(~np.isfinite(cube), axis=0)

    mean_pattern = np.full(cube.shape[1:], np.nan)
    spread = np.full(cube.shape[1:], np.nan)
    with np.errstate(invalid="ignore"):
        mean_pattern[~all_nan] = np.nanmean(cube[:, ~all_nan], axis=0)
        spread[~all_nan] = np.nanstd(cube[:, ~all_nan], axis=0)

    stability = 1.0 / (1.0 + np.nan_to_num(spread, nan=10.0))
    return mean_pattern, stability


def delineate_zones(scenes: Sequence[Scene], grid: FieldGrid,
                    n_zones: int = 3, min_zone_pixels: int = 6,
                    seed: int = 0) -> list[ManagementZone]:
    """Cluster the stable pattern into management zones.

    Uses k-means on (vigour, row, col): including position keeps zones
    spatially coherent instead of scattering single pixels across the
    field, which is the same reason spatial segmentation outperforms plain
    clustering in the ECa literature.
    """
    pattern, stability = stable_pattern(scenes, grid)
    interior = grid.interior(1)
    valid = interior & np.isfinite(pattern)

    if valid.sum() < n_zones * min_zone_pixels:
        return []

    rows, cols = np.where(valid)
    vigour = pattern[valid]

    # Scale position down so vigour dominates but space still binds
    r_norm = (rows - rows.mean()) / max(grid.rows, 1) * 1.5
    c_norm = (cols - cols.mean()) / max(grid.cols, 1) * 1.5
    features = np.column_stack([vigour, r_norm, c_norm])

    labels = _kmeans(features, n_zones, seed=seed)

    zones: list[ManagementZone] = []
    for k in range(n_zones):
        sel = labels == k
        if sel.sum() < min_zone_pixels:
            continue
        pix = [(int(r), int(c)) for r, c in zip(rows[sel], cols[sel])]
        zones.append(ManagementZone(
            zone_id=f"{grid.field_id}-zone-{k+1}",
            field_id=grid.field_id,
            pixel_indices=pix,
            mean_vigour=round(float(vigour[sel].mean()), 4),
            stability=round(float(np.mean(stability[valid][sel])), 4),
        ))

    zones.sort(key=lambda z: z.mean_vigour)
    for i, z in enumerate(zones, start=1):
        z.rank = i
        z.zone_id = f"{grid.field_id}-zone-{i}"
    return zones


def _kmeans(x: np.ndarray, k: int, seed: int = 0, iters: int = 60) -> np.ndarray:
    """k-means with k-means++ seeding. Written out to avoid a hard sklearn dep."""
    rng = np.random.default_rng(seed)
    n = x.shape[0]

    centres = [x[rng.integers(n)]]
    for _ in range(k - 1):
        d = np.min(np.stack([np.sum((x - c) ** 2, axis=1) for c in centres]), axis=0)
        total = d.sum()
        probs = d / total if total > 0 else np.full(n, 1.0 / n)
        centres.append(x[rng.choice(n, p=probs)])
    centres = np.stack(centres)

    labels = np.zeros(n, dtype=int)
    for _ in range(iters):
        dists = np.stack([np.sum((x - c) ** 2, axis=1) for c in centres])
        new_labels = np.argmin(dists, axis=0)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels
        for j in range(k):
            if (labels == j).any():
                centres[j] = x[labels == j].mean(axis=0)
    return labels


def zone_summary(zones: Sequence[ManagementZone]) -> list[dict]:
    """Compact rows for the cockpit and for the engine."""
    return [{
        "zone_id": z.zone_id,
        "rank": z.rank,
        "area_ha": round(z.area_ha, 3),
        "pixels": z.n_pixels,
        "mean_vigour": z.mean_vigour,
        "stability": z.stability,
        "label": ("weakest - prioritise for sampling" if z.rank == 1
                  else "strongest" if z.rank == len(zones) else "mid"),
    } for z in zones]
