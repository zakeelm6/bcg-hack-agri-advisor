"""Farm Advisor - satellite layer.

    satellite  ->  WHERE the problem is   (Sentinel-2, 10 m, every 5 days)
    sensors    ->  WHEN and HOW MUCH      (sentinel node, every 15 min)

NDVI localises a problem; it never diagnoses one. Every anomaly emitted
here becomes an "inspect" task, never a dose.
"""

from .anomaly import (
    DetectionConfig,
    detect,
    flag_scene,
    robust_stats,
    score_detection,
    to_geojson,
)
from .indices import from_bands, ndre, ndvi, ndwi, savi
from .models import SENTINEL2_BANDS, AnomalyZone, FieldGrid, Scene
from .synthetic import FieldRecipe, generate_field, growth_curve
from .zones import ManagementZone, delineate_zones

__all__ = [
    "FieldGrid", "Scene", "AnomalyZone", "SENTINEL2_BANDS",
    "ndvi", "ndre", "ndwi", "savi", "from_bands",
    "detect", "flag_scene", "robust_stats", "score_detection",
    "to_geojson", "DetectionConfig",
    "generate_field", "FieldRecipe", "growth_curve",
    "delineate_zones", "ManagementZone",
]
