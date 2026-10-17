"""Data model for the satellite layer.

Division of labour, restated because it is the whole architecture:

    satellite  ->  WHERE the problem is      (10 m, every 5 days)
    sensors    ->  WHEN and HOW MUCH         (one point, every 15 min)
    lab        ->  WHAT chemically           (one sample per season)
    engine     ->  WHAT TO DO                (per management zone)

NDVI localises a problem. It does NOT diagnose one: nitrogen deficiency,
water stress, disease and compaction all look like a dark patch. Every
anomaly this package emits is an "go and inspect" task, never a diagnosis.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

import numpy as np

# Sentinel-2 Level-2A bands we use, with native resolution.
SENTINEL2_BANDS = {
    "B02": {"name": "blue", "nm": 490, "res_m": 10},
    "B03": {"name": "green", "nm": 560, "res_m": 10},
    "B04": {"name": "red", "nm": 665, "res_m": 10},
    "B05": {"name": "red_edge_1", "nm": 705, "res_m": 20},
    "B08": {"name": "nir", "nm": 842, "res_m": 10},
    "B11": {"name": "swir_1", "nm": 1610, "res_m": 20},
}

# Scene Classification Layer codes. Anything not in VALID_SCL is masked out:
# a cloud shadow reads as a dark patch and is the classic false positive.
SCL_CLASSES = {
    0: "no_data", 1: "saturated", 2: "dark_area", 3: "cloud_shadow",
    4: "vegetation", 5: "bare_soil", 6: "water", 7: "unclassified",
    8: "cloud_medium_prob", 9: "cloud_high_prob", 10: "thin_cirrus",
    11: "snow",
}
VALID_SCL = {4, 5, 7}


@dataclass
class FieldGrid:
    """A plot, as a pixel grid. Pixels outside the polygon are masked.

    A 1 ha field is roughly 100 pixels at Sentinel-2's 10 m resolution -
    enough to see a stressed corner, not enough for anything subtler.
    """

    field_id: str
    rows: int
    cols: int
    pixel_size_m: float = 10.0
    origin_lat: float = 33.21
    origin_lon: float = -7.58
    mask: Optional[np.ndarray] = None   # True = inside the plot

    def __post_init__(self) -> None:
        if self.mask is None:
            self.mask = np.ones((self.rows, self.cols), dtype=bool)

    @property
    def area_ha(self) -> float:
        return float(self.mask.sum()) * self.pixel_size_m ** 2 / 10_000.0

    @property
    def n_pixels(self) -> int:
        return int(self.mask.sum())

    def interior(self, buffer_px: int = 1) -> np.ndarray:
        """Mask eroded by `buffer_px`.

        Edge pixels mix the field with the track or hedge next to it, so
        they read low for reasons that have nothing to do with the crop.
        Every statistic in this package is computed on the interior.
        """
        m = self.mask.copy()
        for _ in range(buffer_px):
            eroded = m.copy()
            eroded[1:, :] &= m[:-1, :]
            eroded[:-1, :] &= m[1:, :]
            eroded[:, 1:] &= m[:, :-1]
            eroded[:, :-1] &= m[:, 1:]
            m = eroded
        return m

    def pixel_centre(self, row: int, col: int) -> tuple[float, float]:
        """Approximate lat/lon of a pixel centre, for the GeoJSON output."""
        dlat = (row + 0.5) * self.pixel_size_m / 111_320.0
        dlon = ((col + 0.5) * self.pixel_size_m
                / (111_320.0 * np.cos(np.radians(self.origin_lat))))
        return self.origin_lat - dlat, self.origin_lon + dlon


@dataclass
class Scene:
    """One satellite pass over one field."""

    field_id: str
    acquired: date
    ndvi: np.ndarray
    scl: Optional[np.ndarray] = None          # scene classification
    cloud_fraction: float = 0.0

    @property
    def valid(self) -> np.ndarray:
        """Pixels usable on this date: not cloud, shadow, water or snow."""
        if self.scl is None:
            return np.isfinite(self.ndvi)
        ok = np.isin(self.scl, list(VALID_SCL))
        return ok & np.isfinite(self.ndvi)

    @property
    def is_usable(self, min_valid_fraction: float = 0.5) -> bool:
        total = self.ndvi.size
        return total > 0 and self.valid.sum() / total >= min_valid_fraction


@dataclass
class AnomalyZone:
    """A contiguous group of pixels that is persistently below its field.

    Deliberately carries no cause. The engine turns this into an "inspect"
    task; a human or a soil test says why.
    """

    field_id: str
    zone_id: str
    pixel_indices: list[tuple[int, int]] = field(default_factory=list)
    mean_deviation: float = 0.0        # NDVI below the field median
    persistence: int = 0               # dates on which it was anomalous
    dates_seen: list[date] = field(default_factory=list)
    severity: str = "low"

    @property
    def area_ha(self) -> float:
        return len(self.pixel_indices) * 100.0 / 10_000.0

    @property
    def n_pixels(self) -> int:
        return len(self.pixel_indices)

    def centroid(self, grid: FieldGrid) -> tuple[float, float]:
        if not self.pixel_indices:
            return grid.origin_lat, grid.origin_lon
        rows = [r for r, _ in self.pixel_indices]
        cols = [c for _, c in self.pixel_indices]
        return grid.pixel_centre(int(np.mean(rows)), int(np.mean(cols)))

    def to_task(self, grid: FieldGrid) -> dict:
        """The action object the decision engine consumes.

        Note the action is 'inspect', never 'fertilise'. We know where,
        not why.
        """
        lat, lon = self.centroid(grid)
        return {
            "action": "inspect",
            "zone_id": self.zone_id,
            "field_id": self.field_id,
            "location": {"lat": round(lat, 6), "lon": round(lon, 6)},
            "area_ha": round(self.area_ha, 3),
            "why": (f"vegetation index {abs(self.mean_deviation):.2f} below the "
                    f"rest of the field on {self.persistence} consecutive passes"),
            "severity": self.severity,
            "confidence": "medium" if self.persistence >= 3 else "low",
            "note": "satellite shows where, not why - inspect or sample to diagnose",
        }
