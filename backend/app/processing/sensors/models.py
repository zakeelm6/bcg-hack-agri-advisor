"""Data model for the Farm Advisor sentinel node.

One Reading is one LoRa frame from one node: every sensor on the node,
plus the housekeeping fields we need to tell a dying node from a dry soil.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional


class SoilTexture(str, Enum):
    """Texture class drives both the moisture calibration and the thermal inversion."""

    SAND = "sand"
    LOAMY_SAND = "loamy_sand"
    SANDY_LOAM = "sandy_loam"
    LOAM = "loam"
    CLAY_LOAM = "clay_loam"
    CLAY = "clay"


# Saturation / wilting point / van Genuchten parameters per texture.
# theta_s: saturated water content, theta_r: residual, alpha [1/cm], n: shape.
TEXTURE_PARAMS: dict[SoilTexture, dict[str, float]] = {
    SoilTexture.SAND:        {"theta_s": 0.43, "theta_r": 0.045, "alpha": 0.145, "n": 2.68},
    SoilTexture.LOAMY_SAND:  {"theta_s": 0.41, "theta_r": 0.057, "alpha": 0.124, "n": 2.28},
    SoilTexture.SANDY_LOAM:  {"theta_s": 0.41, "theta_r": 0.065, "alpha": 0.075, "n": 1.89},
    SoilTexture.LOAM:        {"theta_s": 0.43, "theta_r": 0.078, "alpha": 0.036, "n": 1.56},
    SoilTexture.CLAY_LOAM:   {"theta_s": 0.41, "theta_r": 0.095, "alpha": 0.019, "n": 1.31},
    SoilTexture.CLAY:        {"theta_s": 0.38, "theta_r": 0.068, "alpha": 0.008, "n": 1.09},
}


@dataclass
class Node:
    """A shared sentinel node. One per village or management zone, never per farm."""

    node_id: str
    latitude: float
    longitude: float
    texture: SoilTexture
    bulk_density: float = 1.35          # t/m3, needed for the thermal inversion
    depths_moisture_cm: tuple[int, int] = (15, 30)
    depths_temp_cm: tuple[int, int] = (5, 30)
    installed_on: Optional[datetime] = None

    # Per-sensor one-point field calibration (see SENSORS.md 2.1).
    # Without it, a lab calibration applied in the field gives RMSE up to 0.191 m3/m3.
    calibration_offset: float = 0.0


@dataclass
class Reading:
    """One transmitted frame. Every field may be None if that sensor is absent."""

    node_id: str
    timestamp: datetime

    # Soil moisture, volumetric water content [m3/m3]
    vwc_shallow: Optional[float] = None
    vwc_deep: Optional[float] = None

    # Soil temperature [degC]
    temp_shallow: Optional[float] = None
    temp_deep: Optional[float] = None

    # Matric potential [kPa], negative by convention; this is what the plant feels
    tension_shallow: Optional[float] = None
    tension_deep: Optional[float] = None

    # Canopy minus air temperature [degC] -> crop water stress index
    canopy_temp: Optional[float] = None
    air_temp: Optional[float] = None

    # Leaf wetness [0-1 fraction of the interval the leaf was wet]
    leaf_wetness: Optional[float] = None

    # Locally measured rainfall over the interval [mm]
    rainfall_mm: Optional[float] = None

    # Housekeeping: a sagging battery drifts the analog reads before it kills the node
    battery_v: Optional[float] = None
    rssi_dbm: Optional[int] = None

    # Populated by the QC pass. Empty list means the reading is good.
    flags: list[str] = field(default_factory=list)

    @property
    def is_good(self) -> bool:
        return not self.flags

    def to_dict(self) -> dict:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d
