"""Water-balance residual: the drift detector that actually works.

The thermal cross-check is weakly conditioned (see thermal_sensor.py). This
one is not, because it compares the probe against two sources that have
nothing to do with it: the rain gauge and the evapotranspiration model.

    predicted_change = (rain - ET) / layer_depth
    residual         = measured_change - predicted_change

For a healthy probe the residual is zero-mean noise. A corroding probe adds
a small, CONSISTENTLY SIGNED residual every single step. Individually each
step is invisible; summed over days it is unmistakable.

This is a CUSUM detector - the standard tool for exactly this problem.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

from .models import Node, Reading
from .physics import field_capacity, wilting_point


@dataclass
class DriftResult:
    drift_detected: bool
    drift_rate_per_day: float       # m3/m3 per day, signed
    cumulative_offset: float        # total accumulated error over the record
    detection_day: Optional[int]    # first step index where CUSUM crossed
    n_steps: int
    verdict: str


def expected_change(rain_mm: float, et_mm: float, layer_depth_m: float) -> float:
    """What the water balance says the probe SHOULD have moved by."""
    return (rain_mm - et_mm) / (layer_depth_m * 1000.0)


def estimate_et(air_temp: float, vwc: float, node: Node,
                step_hours: float, et0_mm_day: float = 4.5) -> float:
    """FAO-56 style ET, reduced by water stress. Same model the engine uses."""
    et = et0_mm_day * (step_hours / 24.0)
    et *= max(0.3, min(1.6, air_temp / 18.0))

    wp, fc = wilting_point(node.texture), field_capacity(node.texture)
    stress = (vwc - wp) / max(fc - wp, 1e-6)
    return et * min(max(stress, 0.0), 1.0)


def detect_drift(readings: Sequence[Reading], node: Node,
                 layer_depth_m: float = 0.22,
                 calibration_days: float = 7.0,
                 drift_threshold: float = 0.015,
                 slack_multiplier: float = 3.0) -> DriftResult:
    """CUSUM on the CHANGE in the water-balance residual.

    Two design decisions that matter, both learned the hard way:

    1. RAIN-FREE STEPS ONLY. During and after rainfall, drainage and runoff
       move water in ways a two-term balance does not capture, so the
       residual is dominated by model error rather than sensor error.
       Dry-down is the clean regime: no inputs, just ET.

    2. BASELINE, NOT ABSOLUTE. Our ET model will never exactly match the real
       soil, so the residual has a non-zero mean even for a perfect probe.
       We therefore learn that baseline over a calibration window and detect
       a DEPARTURE from it. This is what makes the detector survive contact
       with a real field instead of only with our own simulator.
    """
    usable = [r for r in readings
              if r.vwc_shallow is not None and r.air_temp is not None]
    if len(usable) < 100:
        return DriftResult(False, 0.0, 0.0, None, len(usable),
                           "not enough data to test for drift")

    step_hours = (usable[1].timestamp - usable[0].timestamp).total_seconds() / 3600.0

    # --- aggregate to daily medians before differencing ---------------------
    # Differencing consecutive 15-minute samples amplifies sensor noise:
    # the drift signal is ~4e-5 per step against ~6e-3 of noise, so CUSUM
    # would accumulate noise far faster than signal. A daily median averages
    # ~96 samples down and is robust to spikes, which lifts the per-day
    # signal-to-noise ratio by roughly an order of magnitude.
    from statistics import median

    by_day: dict = {}
    for r in usable:
        d = r.timestamp.date()
        by_day.setdefault(d, {"vwc": [], "air": [], "rain": 0.0})
        by_day[d]["vwc"].append(r.vwc_shallow)
        by_day[d]["air"].append(r.air_temp)
        by_day[d]["rain"] += (r.rainfall_mm or 0.0)

    days = sorted(by_day)
    daily = [{
        "day": d,
        "vwc": median(by_day[d]["vwc"]),
        "air": sum(by_day[d]["air"]) / len(by_day[d]["air"]),
        "rain": by_day[d]["rain"],
    } for d in days]

    # --- residual on rain-free day pairs only -------------------------------
    samples: list[tuple[int, float]] = []   # (day index, residual)
    for i in range(1, len(daily)):
        prev, cur = daily[i - 1], daily[i]
        if cur["rain"] > 0.2 or prev["rain"] > 0.2:
            continue   # drainage and runoff dominate; not a clean dry-down

        measured_change = cur["vwc"] - prev["vwc"]
        et = estimate_et(prev["air"], prev["vwc"], node, step_hours=24.0)
        predicted = expected_change(0.0, et, layer_depth_m)
        samples.append((i, measured_change - predicted))

    if len(samples) < 8:
        return DriftResult(False, 0.0, 0.0, None, len(samples),
                           "too few rain-free days to test for drift")

    # --- learn the baseline on the calibration window -----------------------
    baseline_samples = [r for idx, r in samples if idx < calibration_days]
    if len(baseline_samples) < 4:
        baseline_samples = [r for _, r in samples[:max(len(samples) // 3, 2)]]

    baseline = sum(baseline_samples) / len(baseline_samples)
    spread = (sum((r - baseline) ** 2 for r in baseline_samples)
              / len(baseline_samples)) ** 0.5
    slack = slack_multiplier * max(spread, 1e-4)

    # --- CUSUM on the departure from baseline -------------------------------
    cusum_pos = cusum_neg = 0.0
    detection_day: Optional[int] = None
    departures: list[float] = []

    for idx, residual in samples:
        if idx < calibration_days:
            continue
        d = residual - baseline
        departures.append(d)

        cusum_pos = max(0.0, cusum_pos + d - slack)
        cusum_neg = min(0.0, cusum_neg + d + slack)

        if detection_day is None and max(cusum_pos, -cusum_neg) > drift_threshold:
            detection_day = idx

    if not departures:
        return DriftResult(False, 0.0, 0.0, None, len(samples),
                           "record too short beyond the calibration window")

    cumulative = sum(departures)
    rate = cumulative / len(departures)
    detected = detection_day is not None

    if detected:
        direction = "reading low" if rate < 0 else "reading high"
        verdict = (f"drift detected from ~day {detection_day}: probe is {direction} "
                   f"by {abs(rate):.4f} m3/m3 per day")
    else:
        verdict = "probe tracks the water balance - no systematic drift"

    return DriftResult(
        drift_detected=detected,
        drift_rate_per_day=round(rate, 5),
        cumulative_offset=round(cumulative, 4),
        detection_day=detection_day,
        n_steps=len(departures),
        verdict=verdict,
    )
