"""Farm Advisor - sensor layer.

Pipeline:
    simulator / LoRa ingest  ->  qc  ->  thermal cross-check  ->  sentinel offset
                                                              ->  decision engine

Nothing in this package produces an agronomic dose. It produces measurements
and a confidence level. The rule engine decides; the LLM only explains.
"""

from .models import Node, Reading, SoilTexture, TEXTURE_PARAMS
from .physics import (
    TENSION_FLOOR_KPA,
    cwsi,
    field_capacity,
    plant_available_water,
    thermal_diffusivity,
    vwc_to_tension_kpa,
    wilting_point,
)
from .qc import FLAG_DESCRIPTIONS, QCConfig, qc_summary, run_qc, zone_confidence
from .sentinel import choose_sentinel, learn_offset, propagate, validate_offset
from .simulator import FaultType, NodeSimulator, SimConfig, simulate_village
from .thermal_sensor import cross_check, estimate_daily, sensitivity_report
from .water_balance import detect_drift

__all__ = [
    "Node", "Reading", "SoilTexture", "TEXTURE_PARAMS",
    "vwc_to_tension_kpa", "wilting_point", "field_capacity",
    "plant_available_water", "thermal_diffusivity", "cwsi", "TENSION_FLOOR_KPA",
    "run_qc", "qc_summary", "zone_confidence", "QCConfig", "FLAG_DESCRIPTIONS",
    "estimate_daily", "cross_check", "sensitivity_report",
    "detect_drift",
    "learn_offset", "choose_sentinel", "propagate", "validate_offset",
    "NodeSimulator", "SimConfig", "FaultType", "simulate_village",
]
