"""Quality control, following the ISMN convention.

Core rule: we never delete a reading, we flag it. A flagged reading stays
visible and auditable, but it does not enter a dose calculation.

Flag families:
    C0x  bounds        - physically impossible values
    D0x  consistency   - possible in isolation, impossible given other data
    Dx   spectrum      - shape of the time series itself
    Xxx  cross-check   - our own additions beyond ISMN
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable, Sequence

from .models import TEXTURE_PARAMS, Node, Reading

# ---------------------------------------------------------------------------

FLAG_DESCRIPTIONS: dict[str, str] = {
    "C01": "soil moisture below 0.0 m3/m3",
    "C02": "soil moisture above 0.6 m3/m3",
    "C03": "soil moisture above the saturation point for this texture",
    "C04": "soil temperature outside -60..60 degC",
    "D01": "moisture rose with no rainfall in the preceding 24 h",
    "D02": "moisture varied while soil temperature was below 0 degC",
    "D03": "spike detected in the moisture series",
    "D04": "negative jump detected in the moisture series",
    "D05": "positive jump detected in the moisture series",
    "D06": "low constant value held for at least 12 h",
    "D10": "saturated plateau held for at least 12 h",
    "X01": "deep probe responded before the shallow probe",
    "X02": "battery voltage below the reliable-reading threshold",
    "X03": "moisture diverges persistently from the thermal virtual sensor",
}

BATTERY_MIN_V = 3.45          # below this the ADC reference sags and readings drift
VWC_ABS_MIN = 0.0
VWC_ABS_MAX = 0.6
TEMP_ABS_MIN = -60.0
TEMP_ABS_MAX = 60.0


@dataclass
class QCConfig:
    spike_threshold: float = 0.05       # 2nd-derivative magnitude, m3/m3
    jump_threshold: float = 0.06        # step change between consecutive samples
    plateau_hours: float = 12.0
    plateau_tolerance: float = 0.002    # considered "constant" within this band
    low_constant_max: float = 0.05      # a real soil rarely sits this dry and flat
    rain_window_hours: float = 24.0
    rain_rise_threshold: float = 0.015  # on rolling means, ~5 sigma of noise
    drift_tolerance: float = 0.06       # vs the thermal virtual sensor
    drift_min_fraction: float = 0.8     # must disagree this often to be called drift


# ---------------------------------------------------------------------------
# Single-reading checks
# ---------------------------------------------------------------------------


def check_bounds(reading: Reading, node: Node) -> list[str]:
    flags: list[str] = []
    theta_s = TEXTURE_PARAMS[node.texture]["theta_s"]

    for vwc in (reading.vwc_shallow, reading.vwc_deep):
        if vwc is None:
            continue
        if vwc < VWC_ABS_MIN:
            flags.append("C01")
        elif vwc > VWC_ABS_MAX:
            flags.append("C02")
        elif vwc > theta_s + 0.02:
            flags.append("C03")

    for temp in (reading.temp_shallow, reading.temp_deep):
        if temp is not None and not (TEMP_ABS_MIN <= temp <= TEMP_ABS_MAX):
            flags.append("C04")

    if reading.battery_v is not None and reading.battery_v < BATTERY_MIN_V:
        flags.append("X02")

    return flags


# ---------------------------------------------------------------------------
# Series checks
# ---------------------------------------------------------------------------


def _series(readings: Sequence[Reading], attr: str) -> list[float | None]:
    return [getattr(r, attr) for r in readings]


def _rained_near(readings: Sequence[Reading], i: int, window: int = 2) -> bool:
    """Was there rain within a couple of steps of i?

    Real infiltration is a sharp rise followed by a flat top, which looks
    exactly like a spike to a second-derivative test. Without this exemption
    every rainfall event is flagged as a sensor fault.
    """
    lo, hi = max(0, i - window), min(len(readings), i + window + 1)
    return any((readings[j].rainfall_mm or 0.0) > 0.5 for j in range(lo, hi))


def check_spikes(readings: Sequence[Reading], cfg: QCConfig) -> dict[int, list[str]]:
    """A spike shows up as a large second derivative: up then immediately down.

    A genuine spike returns to the trend; infiltration does not. So we also
    require the value to come back down, which separates noise from rain.
    """
    out: dict[int, list[str]] = {}
    v = _series(readings, "vwc_shallow")

    for i in range(1, len(v) - 1):
        if v[i - 1] is None or v[i] is None or v[i + 1] is None:
            continue
        second_derivative = v[i + 1] - 2 * v[i] + v[i - 1]
        if abs(second_derivative) <= cfg.spike_threshold:
            continue
        if _rained_near(readings, i):
            continue  # infiltration, not a fault

        # A true spike departs from BOTH neighbours in the same direction.
        d_prev, d_next = v[i] - v[i - 1], v[i] - v[i + 1]
        if d_prev * d_next > 0:
            out.setdefault(i, []).append("D03")
    return out


def check_jumps(readings: Sequence[Reading], cfg: QCConfig) -> dict[int, list[str]]:
    """A step change that does not come back: the probe moved, or was dug up.

    A jump that coincides with rain is legitimate infiltration, so we exempt it.
    """
    out: dict[int, list[str]] = {}
    v = _series(readings, "vwc_shallow")

    for i in range(1, len(v)):
        if v[i] is None or v[i - 1] is None:
            continue
        delta = v[i] - v[i - 1]
        if abs(delta) <= cfg.jump_threshold:
            continue
        if delta > 0 and (readings[i].rainfall_mm or 0) > 0.5:
            continue  # rain explains it
        out.setdefault(i, []).append("D05" if delta > 0 else "D04")
    return out


def check_plateaus(readings: Sequence[Reading], node: Node,
                   cfg: QCConfig) -> dict[int, list[str]]:
    """Constant values for hours mean the probe stopped sensing the soil.

    High and flat -> drowned (D10). Low and flat -> out of soil or cut (D06).
    """
    out: dict[int, list[str]] = {}
    if len(readings) < 2:
        return out

    theta_s = TEXTURE_PARAMS[node.texture]["theta_s"]
    step_hours = (readings[1].timestamp - readings[0].timestamp).total_seconds() / 3600.0
    min_run = max(int(cfg.plateau_hours / step_hours), 2)

    v = _series(readings, "vwc_shallow")
    run_start = 0

    for i in range(1, len(v) + 1):
        broken = (
            i == len(v)
            or v[i] is None
            or v[run_start] is None
            or abs(v[i] - v[run_start]) > cfg.plateau_tolerance
        )
        if not broken:
            continue

        run_len = i - run_start
        if run_len >= min_run and v[run_start] is not None:
            value = v[run_start]
            flag = None
            if value > theta_s - 0.02:
                flag = "D10"
            elif value < cfg.low_constant_max:
                flag = "D06"
            if flag:
                for j in range(run_start, i):
                    out.setdefault(j, []).append(flag)
        run_start = i

    return out


def check_rain_consistency(readings: Sequence[Reading],
                           cfg: QCConfig) -> dict[int, list[str]]:
    """Moisture cannot rise without water arriving.

    This is the check that catches drift and parasitic signal, because it
    crosses two independent sources: the probe and the rain gauge.
    """
    out: dict[int, list[str]] = {}
    if len(readings) < 2:
        return out

    step_hours = (readings[1].timestamp - readings[0].timestamp).total_seconds() / 3600.0
    window = max(int(cfg.rain_window_hours / step_hours), 1)
    k = max(int(1.0 / step_hours), 2)        # ~1 h of samples each side

    def mean_vwc(lo: int, hi: int) -> float | None:
        vals = [readings[j].vwc_shallow for j in range(lo, hi)
                if readings[j].vwc_shallow is not None]
        return sum(vals) / len(vals) if vals else None

    for i in range(k, len(readings) - k):
        before = mean_vwc(i - k, i)
        after = mean_vwc(i, i + k)
        if before is None or after is None:
            continue

        # Compare rolling means, not single samples. Sample-to-sample noise
        # has a standard deviation around 0.006 m3/m3, so a 0.015 threshold
        # on raw differences fires on the noise tail several times a month.
        # Averaging an hour each side cuts that to ~0.003 and leaves only
        # sustained rises, which is what infiltration actually looks like.
        if after - before <= cfg.rain_rise_threshold:
            continue

        recent_rain = sum(
            (readings[j].rainfall_mm or 0.0)
            for j in range(max(0, i - window), min(len(readings), i + k))
        )
        if recent_rain < 0.5:
            out.setdefault(i, []).append("D01")
    return out


def check_frozen_soil(readings: Sequence[Reading]) -> dict[int, list[str]]:
    """Liquid water cannot move while the soil is frozen."""
    out: dict[int, list[str]] = {}
    for i in range(1, len(readings)):
        t = readings[i].temp_shallow
        cur, prev = readings[i].vwc_shallow, readings[i - 1].vwc_shallow
        if t is None or cur is None or prev is None:
            continue
        if t < 0.0 and abs(cur - prev) > 0.01:
            out.setdefault(i, []).append("D02")
    return out


def check_depth_ordering(readings: Sequence[Reading]) -> dict[int, list[str]]:
    """Free redundancy: after rain the 30 cm probe cannot respond before the 15 cm one.

    Costs nothing, needs no extra hardware, and catches a swapped or failed probe.
    """
    out: dict[int, list[str]] = {}
    if len(readings) < 3:
        return out

    step_hours = (readings[1].timestamp - readings[0].timestamp).total_seconds() / 3600.0
    k = max(int(1.0 / step_hours), 2)

    def mean_of(attr: str, lo: int, hi: int) -> float | None:
        vals = [getattr(readings[j], attr) for j in range(lo, hi)
                if getattr(readings[j], attr) is not None]
        return sum(vals) / len(vals) if vals else None

    # Rolling means again: a single-sample comparison here fires on the deep
    # probe's own noise tail a couple of times a month.
    for i in range(k, len(readings) - k):
        d_before, d_after = mean_of("vwc_deep", i - k, i), mean_of("vwc_deep", i, i + k)
        s_before, s_after = mean_of("vwc_shallow", i - k, i), mean_of("vwc_shallow", i, i + k)
        if None in (d_before, d_after, s_before, s_after):
            continue

        deep_rise = d_after - d_before
        shallow_rise = s_after - s_before

        # Drainage legitimately moves water down while the shallow layer
        # falls, so only flag when no water has arrived recently.
        if deep_rise > 0.02 and shallow_rise < 0.002 and not _rained_near(readings, i, window=4 * k):
            out.setdefault(i, []).append("X01")
    return out


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_qc(readings: Sequence[Reading], node: Node,
           cfg: QCConfig | None = None) -> list[Reading]:
    """Apply every check and write the flags onto the readings in place."""
    cfg = cfg or QCConfig()

    for r in readings:
        r.flags = check_bounds(r, node)

    series_checks = [
        check_spikes(readings, cfg),
        check_jumps(readings, cfg),
        check_plateaus(readings, node, cfg),
        check_rain_consistency(readings, cfg),
        check_frozen_soil(readings),
        check_depth_ordering(readings),
    ]

    for result in series_checks:
        for idx, flags in result.items():
            for f in flags:
                if f not in readings[idx].flags:
                    readings[idx].flags.append(f)

    return list(readings)


def qc_summary(readings: Iterable[Reading]) -> dict[str, int]:
    """Flag counts, for the dashboard and for the demo output."""
    counts: dict[str, int] = {}
    total = 0
    good = 0
    for r in readings:
        total += 1
        if r.is_good:
            good += 1
        for f in r.flags:
            counts[f] = counts.get(f, 0) + 1
    counts["_total"] = total
    counts["_good"] = good
    return counts


def zone_confidence(readings: Sequence[Reading], window_hours: float = 24.0) -> str:
    """What the recommendation engine asks before it computes a dose.

    If every recent reading is flagged we return "insufficient" - and the
    platform then recommends a soil test instead of guessing a number.
    """
    if not readings:
        return "insufficient"

    step_hours = 0.25
    if len(readings) > 1:
        step_hours = (readings[1].timestamp - readings[0].timestamp).total_seconds() / 3600.0

    n = max(int(window_hours / step_hours), 1)
    recent = readings[-n:]
    good_fraction = sum(1 for r in recent if r.is_good) / len(recent)

    if good_fraction >= 0.9:
        return "high"
    if good_fraction >= 0.5:
        return "medium"
    if good_fraction > 0.0:
        return "low"
    return "insufficient"
