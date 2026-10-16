"""Within-field anomaly detection.

Three ideas, each of which fixes a specific failure:

1. DYNAMIC, PER-FIELD, PER-DATE THRESHOLDS.
   NDVI 0.45 is healthy in March and alarming in May; a threshold that
   works on wheat fails on barley. So we never compare against a constant.
   We compare each pixel against its own field on its own date, using the
   median and MAD - robust statistics, because the anomaly we are hunting
   would drag a mean and a standard deviation toward itself.

2. PERSISTENCE FILTERING.
   A cloud shadow is a dark patch on one date. Real stress is a dark patch
   on the same pixels for several passes. Requiring persistence is what
   makes this usable without a human filtering every image.

3. EDGE EXCLUSION.
   Boundary pixels mix crop with track, hedge and ditch. They read low
   permanently and would otherwise be flagged every single time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional, Sequence

import numpy as np

from .models import AnomalyZone, FieldGrid, Scene


@dataclass
class DetectionConfig:
    mad_threshold: float = 2.0        # robust z below expectation
    min_persistence: int = 3          # passes a pixel must be anomalous
    min_zone_pixels: int = 4          # below this it is noise, not a zone
    edge_buffer_px: int = 1
    min_valid_fraction: float = 0.5   # skip scenes that are mostly cloud
    severity_moderate: float = 0.10   # NDVI deviation
    severity_high: float = 0.18

    # Baseline mode: compare each pixel against its OWN history rather than
    # against the field median. Without this, a naturally weak zone is
    # flagged forever and a newly stressed patch inside a strong zone is
    # missed - the detector finds soil, not problems.
    use_baseline: bool = True
    baseline_dates: int = 4           # early passes used to learn normality


def robust_stats(values: np.ndarray) -> tuple[float, float]:
    """Median and MAD-derived sigma.

    The 1.4826 factor makes MAD comparable to a standard deviation for
    normally distributed data. We use it rather than std precisely because
    the thing we are looking for is an outlier population: a mean would be
    pulled down by the stressed patch and hide it.
    """
    v = values[np.isfinite(values)]
    if v.size < 8:
        return float("nan"), float("nan")
    med = float(np.median(v))
    mad = float(np.median(np.abs(v - med)))
    return med, mad * 1.4826


def flag_scene(scene: Scene, grid: FieldGrid,
               cfg: Optional[DetectionConfig] = None) -> Optional[np.ndarray]:
    """Pixels anomalously low on this one date. None if the scene is unusable."""
    cfg = cfg or DetectionConfig()

    interior = grid.interior(cfg.edge_buffer_px)
    usable = scene.valid & interior

    if usable.sum() < max(8, cfg.min_valid_fraction * interior.sum()):
        return None   # too much cloud to judge this date

    med, sigma = robust_stats(scene.ndvi[usable])
    if not np.isfinite(med) or not np.isfinite(sigma) or sigma < 1e-6:
        return None

    z = np.full(scene.ndvi.shape, np.nan)
    z[usable] = (scene.ndvi[usable] - med) / sigma

    # One-sided: we flag low vigour. A patch that is unusually GREEN is
    # interesting too, but it is not a problem to send someone out for.
    return (z < -cfg.mad_threshold) & usable


def _connected_components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """Group flagged pixels into contiguous blobs (4-connectivity, BFS)."""
    seen = np.zeros_like(mask, dtype=bool)
    out: list[list[tuple[int, int]]] = []
    rows, cols = mask.shape

    for r in range(rows):
        for c in range(cols):
            if not mask[r, c] or seen[r, c]:
                continue
            stack = [(r, c)]
            seen[r, c] = True
            blob: list[tuple[int, int]] = []
            while stack:
                cr, cc = stack.pop()
                blob.append((cr, cc))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = cr + dr, cc + dc
                    if (0 <= nr < rows and 0 <= nc < cols
                            and mask[nr, nc] and not seen[nr, nc]):
                        seen[nr, nc] = True
                        stack.append((nr, nc))
            out.append(blob)
    return out


def scene_zscore(scene: Scene, grid: FieldGrid,
                 cfg: DetectionConfig) -> Optional[np.ndarray]:
    """Per-date robust z-score: each pixel against its field, that day.

    Standardising per date removes the seasonal growth curve, so an early
    pass and a late pass can be compared on the same footing.
    """
    interior = grid.interior(cfg.edge_buffer_px)
    usable = scene.valid & interior

    if usable.sum() < max(8, cfg.min_valid_fraction * interior.sum()):
        return None

    med, sigma = robust_stats(scene.ndvi[usable])
    if not np.isfinite(med) or not np.isfinite(sigma) or sigma < 1e-6:
        return None

    z = np.full(scene.ndvi.shape, np.nan)
    z[usable] = (scene.ndvi[usable] - med) / sigma
    return z


def learn_baseline(scenes: Sequence[Scene], grid: FieldGrid,
                   cfg: DetectionConfig) -> Optional[np.ndarray]:
    """Each pixel's normal standing within the field, from early passes.

    This is the spatial twin of the sentinel offset in the sensor layer:
    a pixel that always sits below its field is not a problem, it is a
    soil property. We want pixels that LEAVE their own baseline.
    """
    stack = []
    for scene in scenes[:cfg.baseline_dates]:
        z = scene_zscore(scene, grid, cfg)
        if z is not None:
            stack.append(z)

    if len(stack) < 2:
        return None

    cube = np.stack(stack)
    all_nan = np.all(~np.isfinite(cube), axis=0)
    out = np.full(cube.shape[1:], np.nan)
    with np.errstate(invalid="ignore"):
        out[~all_nan] = np.nanmedian(cube[:, ~all_nan], axis=0)
    return out


def detect(scenes: Sequence[Scene], grid: FieldGrid,
           cfg: Optional[DetectionConfig] = None) -> list[AnomalyZone]:
    """Full pipeline: baseline, per-date departure, persistence, clustering."""
    cfg = cfg or DetectionConfig()

    baseline = learn_baseline(scenes, grid, cfg) if cfg.use_baseline else None
    monitored = scenes[cfg.baseline_dates:] if baseline is not None else scenes

    counts = np.zeros((grid.rows, grid.cols), dtype=int)
    deviation_sum = np.zeros((grid.rows, grid.cols))
    dates_per_pixel: dict[tuple[int, int], list[date]] = {}
    used_dates = 0

    for scene in monitored:
        z = scene_zscore(scene, grid, cfg)
        if z is None:
            continue
        used_dates += 1

        interior = grid.interior(cfg.edge_buffer_px)
        usable = scene.valid & interior

        if baseline is not None:
            departure = z - baseline       # change from this pixel's normal
        else:
            departure = z                  # fallback: vs the field median

        # Standardise the departure by its OWN robust spread, so the
        # threshold is self-calibrating. Subtracting the baseline removes
        # the field's spatial structure, leaving a much tighter residual -
        # a fixed threshold in units of the raw spatial spread would be
        # far too strict, and would need re-tuning for every field.
        dep_valid = departure[usable & np.isfinite(departure)]
        _, dep_sigma = robust_stats(dep_valid)
        if not np.isfinite(dep_sigma) or dep_sigma < 1e-6:
            continue

        robust_departure = departure / dep_sigma
        flags = ((robust_departure < -cfg.mad_threshold)
                 & usable & np.isfinite(robust_departure))

        _, sigma = robust_stats(scene.ndvi[usable])
        counts += flags.astype(int)
        # Record the deviation in NDVI units, so severity is interpretable
        dev = np.where(flags, departure * sigma, 0.0)
        deviation_sum += np.nan_to_num(dev)

        for r, c in zip(*np.where(flags)):
            dates_per_pixel.setdefault((int(r), int(c)), []).append(scene.acquired)

    if used_dates == 0:
        return []

    persistent = counts >= cfg.min_persistence
    zones: list[AnomalyZone] = []

    for i, blob in enumerate(_connected_components(persistent), start=1):
        if len(blob) < cfg.min_zone_pixels:
            continue

        devs = [deviation_sum[r, c] / max(counts[r, c], 1) for r, c in blob]
        mean_dev = float(np.mean(devs))
        persistence = int(np.median([counts[r, c] for r, c in blob]))

        all_dates = sorted({d for px in blob for d in dates_per_pixel.get(px, [])})

        magnitude = abs(mean_dev)
        if magnitude >= cfg.severity_high:
            severity = "high"
        elif magnitude >= cfg.severity_moderate:
            severity = "moderate"
        else:
            severity = "low"

        zones.append(AnomalyZone(
            field_id=grid.field_id,
            zone_id=f"{grid.field_id}-anomaly-{i:02d}",
            pixel_indices=blob,
            mean_deviation=round(mean_dev, 4),
            persistence=persistence,
            dates_seen=all_dates,
            severity=severity,
        ))

    zones.sort(key=lambda z: (z.severity != "high", -z.n_pixels))
    return zones


def score_detection(detected: Sequence[AnomalyZone],
                    truth: np.ndarray, grid: FieldGrid) -> dict:
    """Pixel-level precision and recall against a known injected patch.

    Without this the detector can only be eyeballed, and an eyeballed
    detector is one that works on the demo field and nowhere else.
    """
    predicted = np.zeros_like(truth, dtype=bool)
    for z in detected:
        for r, c in z.pixel_indices:
            predicted[r, c] = True

    interior = grid.interior(1)
    truth_i = truth & interior
    pred_i = predicted & interior

    tp = int((truth_i & pred_i).sum())
    fp = int((~truth_i & pred_i).sum())
    fn = int((truth_i & ~pred_i).sum())

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return {
        "true_positive_px": tp,
        "false_positive_px": fp,
        "false_negative_px": fn,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "n_zones": len(detected),
    }


def to_geojson(zones: Sequence[AnomalyZone], grid: FieldGrid) -> dict:
    """GeoJSON for the map in the cockpit."""
    features = []
    for z in zones:
        lat, lon = z.centroid(grid)
        half = grid.pixel_size_m / 2 / 111_320.0
        ring = []
        for r, c in z.pixel_indices:
            plat, plon = grid.pixel_centre(r, c)
            ring.append([round(plon, 6), round(plat, 6)])

        features.append({
            "type": "Feature",
            "geometry": {"type": "MultiPoint", "coordinates": ring},
            "properties": {
                **z.to_task(grid),
                "centroid": [round(lon, 6), round(lat, 6)],
                "pixel_count": z.n_pixels,
                "persistence": z.persistence,
                "dates_seen": [d.isoformat() for d in z.dates_seen],
            },
        })

    return {"type": "FeatureCollection", "features": features}
