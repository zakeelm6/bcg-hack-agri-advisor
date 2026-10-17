"""Virtual moisture sensor: two thermometers as a COARSE independent check.

The idea: wet soil stores heat, dry soil does not, so the daily temperature
wave is damped as it travels downward and the damping depends on moisture.

HONEST LIMITATION, measured in this repo (run `python3 -m sensors.thermal_sensor`):
thermal diffusivity is NOT monotonic in water content. Conductivity rises
steeply with the first water added, but heat capacity keeps rising after
conductivity has saturated, so kappa peaks near vwc ~ 0.15 and falls again.

For clay loam at 5 cm / 30 cm the damping ratio spans only 0.139 - 0.154
across the whole plausible moisture range. Consequences:

  1. A given damping ratio usually has TWO solutions (one dry, one wet).
  2. Sensitivity is ~10% of signal for 100% of range, against a noisy
     amplitude estimate. Precision is poor by construction.

So this module does NOT return a precision moisture value. It returns a
bracket plus an explicit ambiguity flag, and it is used only to catch GROSS
divergence - a probe reading 0.05 while the soil is clearly mid-range.

For actual drift detection use `water_balance.py`, which is far better
conditioned because rainfall and ET are independent of the probe.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Optional, Sequence

from .models import TEXTURE_PARAMS, Node, Reading
from .physics import amplitude_ratio, thermal_diffusivity


@dataclass
class ThermalEstimate:
    """A bracket, not a point estimate. `ambiguous` means two branches fit."""

    day: date
    vwc_candidates: list[float] = field(default_factory=list)
    vwc_low: Optional[float] = None       # lower end of the feasible bracket
    vwc_high: Optional[float] = None      # upper end
    amplitude_shallow: float = 0.0
    amplitude_deep: float = 0.0
    damping_ratio: float = 0.0
    phase_lag_h: float = 0.0
    n_samples: int = 0
    ambiguous: bool = False
    note: str = ""

    @property
    def vwc(self) -> Optional[float]:
        """Midpoint of the bracket. Only meaningful when not ambiguous."""
        if self.vwc_low is None or self.vwc_high is None:
            return None
        return round(0.5 * (self.vwc_low + self.vwc_high), 4)

    @property
    def is_usable(self) -> bool:
        return self.vwc is not None and not self.ambiguous


# ---------------------------------------------------------------------------
# Signal extraction: fit a sinusoid, do not take max - min
# ---------------------------------------------------------------------------


def fit_diurnal(times_h: Sequence[float], temps: Sequence[float]
                ) -> tuple[float, float, float]:
    """Least-squares fit of mean + A*cos(wt) + B*sin(wt) over one day.

    Returns (mean, amplitude, phase_hours).

    Using max - min instead would inflate the amplitude by roughly the noise
    range, and the deep probe's amplitude is small enough that the bias
    dominates. The fit averages the noise down instead.
    """
    pairs = [(t, v) for t, v in zip(times_h, temps) if v is not None]
    if len(pairs) < 8:
        return 0.0, 0.0, 0.0

    omega = 2.0 * math.pi / 24.0
    n = len(pairs)

    s_1 = float(n)
    s_c = s_s = s_cc = s_ss = s_cs = 0.0
    s_y = s_yc = s_ys = 0.0

    for t, y in pairs:
        c, s = math.cos(omega * t), math.sin(omega * t)
        s_c += c; s_s += s
        s_cc += c * c; s_ss += s * s; s_cs += c * s
        s_y += y; s_yc += y * c; s_ys += y * s

    # Normal equations for [mean, A, B]
    m = [[s_1, s_c, s_s],
         [s_c, s_cc, s_cs],
         [s_s, s_cs, s_ss]]
    rhs = [s_y, s_yc, s_ys]

    sol = _solve3(m, rhs)
    if sol is None:
        return 0.0, 0.0, 0.0

    mean, a, b = sol
    amplitude = math.hypot(a, b)
    phase_h = (math.atan2(b, a) / omega) % 24.0
    return mean, amplitude, phase_h


def _solve3(m: list[list[float]], rhs: list[float]) -> Optional[list[float]]:
    """Gaussian elimination on a 3x3 system."""
    a = [row[:] + [rhs[i]] for i, row in enumerate(m)]
    for col in range(3):
        pivot_row = max(range(col, 3), key=lambda r: abs(a[r][col]))
        if abs(a[pivot_row][col]) < 1e-12:
            return None
        a[col], a[pivot_row] = a[pivot_row], a[col]
        for r in range(3):
            if r == col:
                continue
            factor = a[r][col] / a[col][col]
            for c in range(col, 4):
                a[r][c] -= factor * a[col][c]
    return [a[i][3] / a[i][i] for i in range(3)]


# ---------------------------------------------------------------------------
# Inversion: grid search, because the forward model is not monotonic
# ---------------------------------------------------------------------------


def invert_damping_to_vwc(damping_ratio: float, node: Node,
                          tolerance: float = 0.004,
                          n_grid: int = 400) -> tuple[list[float], bool]:
    """Every vwc whose predicted damping matches the observation.

    Returns (candidates, ambiguous). Bisection would be wrong here: the
    forward model rises then falls, so a root finder assuming monotonicity
    silently returns one branch or fails outright.
    """
    z1 = node.depths_temp_cm[0] / 100.0
    z2 = node.depths_temp_cm[1] / 100.0
    theta_s = TEXTURE_PARAMS[node.texture]["theta_s"]

    lo, hi = 0.02, theta_s

    def predicted(vwc: float) -> float:
        kappa = thermal_diffusivity(vwc, node.texture, node.bulk_density)
        return amplitude_ratio(kappa, z1, z2)

    grid = [lo + (hi - lo) * i / (n_grid - 1) for i in range(n_grid)]
    residuals = [abs(predicted(v) - damping_ratio) for v in grid]

    # Contiguous runs within tolerance become candidate branches
    branches: list[list[float]] = []
    current: list[float] = []
    for v, r in zip(grid, residuals):
        if r <= tolerance:
            current.append(v)
        elif current:
            branches.append(current)
            current = []
    if current:
        branches.append(current)

    if not branches:
        return [], False

    candidates = [round(sum(b) / len(b), 4) for b in branches]
    # Ambiguous if separate branches, or if one branch covers most of the range
    span = max(max(b) for b in branches) - min(min(b) for b in branches)
    ambiguous = len(branches) > 1 or span > 0.5 * (hi - lo)
    return candidates, ambiguous


def estimate_daily(readings: Sequence[Reading], node: Node) -> list[ThermalEstimate]:
    """One coarse moisture bracket per day, from temperature only."""
    by_day: dict[date, list[Reading]] = {}
    for r in readings:
        by_day.setdefault(r.timestamp.date(), []).append(r)

    out: list[ThermalEstimate] = []
    for day, group in sorted(by_day.items()):
        times = [r.timestamp.hour + r.timestamp.minute / 60.0 for r in group]
        _, a_s, ph_s = fit_diurnal(times, [r.temp_shallow for r in group])
        _, a_d, ph_d = fit_diurnal(times, [r.temp_deep for r in group])

        est = ThermalEstimate(day=day, amplitude_shallow=round(a_s, 3),
                              amplitude_deep=round(a_d, 3), n_samples=len(group))

        if a_s < 0.5:
            est.note = "diurnal signal too weak to invert"
            out.append(est)
            continue

        est.damping_ratio = round(a_d / a_s, 4)
        est.phase_lag_h = round((ph_d - ph_s) % 24.0, 2)

        candidates, ambiguous = invert_damping_to_vwc(est.damping_ratio, node)
        est.vwc_candidates = candidates
        est.ambiguous = ambiguous

        if not candidates:
            est.note = "damping outside the range this soil can produce"
        else:
            est.vwc_low = min(candidates)
            est.vwc_high = max(candidates)
            if ambiguous:
                est.note = "two feasible branches - usable only as a coarse bracket"

        out.append(est)

    return out


def cross_check(readings: Sequence[Reading], node: Node,
                gross_tolerance: float = 0.12) -> dict:
    """Catch GROSS disagreement only. Not a precision comparison.

    gross_tolerance is deliberately wide (0.12 m3/m3) because the thermal
    estimate is coarse. A tighter threshold would produce false alarms from
    the inversion's own error, not from any real probe fault.
    """
    estimates = estimate_daily(readings, node)

    by_day: dict[date, list[float]] = {}
    for r in readings:
        if r.vwc_shallow is not None:
            by_day.setdefault(r.timestamp.date(), []).append(r.vwc_shallow)

    comparisons: list[dict] = []
    for est in estimates:
        if est.day not in by_day or not est.vwc_candidates:
            continue
        measured = sum(by_day[est.day]) / len(by_day[est.day])
        # Distance to the nearest feasible branch - we only object if the
        # probe is far from EVERY branch the physics allows.
        distance = min(abs(measured - c) for c in est.vwc_candidates)
        comparisons.append({
            "day": est.day,
            "probe": round(measured, 4),
            "thermal_candidates": est.vwc_candidates,
            "distance": round(distance, 4),
            "ambiguous": est.ambiguous,
        })

    if not comparisons:
        return {
            "gross_disagreement": False,
            "n_days": 0,
            "diverging_fraction": 0.0,
            "comparisons": [],
            "verdict": "no invertible days - thermal cross-check unavailable",
        }

    diverging = [c for c in comparisons if c["distance"] > gross_tolerance]
    fraction = len(diverging) / len(comparisons)
    detected = fraction >= 0.6

    return {
        "gross_disagreement": detected,
        "n_days": len(comparisons),
        "diverging_fraction": round(fraction, 3),
        "mean_distance": round(
            sum(c["distance"] for c in comparisons) / len(comparisons), 4),
        "comparisons": comparisons,
        "verdict": (
            "probe is far outside what the thermal physics allows - inspect it"
            if detected else
            "probe is within the (wide) thermal bracket"
        ),
    }


def sensitivity_report(node: Node) -> dict:
    """Quantify how weak this method is, for the record and for the slide."""
    z1 = node.depths_temp_cm[0] / 100.0
    z2 = node.depths_temp_cm[1] / 100.0
    theta_s = TEXTURE_PARAMS[node.texture]["theta_s"]

    samples = []
    for i in range(41):
        vwc = 0.02 + (theta_s - 0.02) * i / 40
        kappa = thermal_diffusivity(vwc, node.texture, node.bulk_density)
        samples.append((round(vwc, 4), round(amplitude_ratio(kappa, z1, z2), 5)))

    ratios = [r for _, r in samples]
    peak_vwc = max(samples, key=lambda s: s[1])[0]

    return {
        "texture": node.texture.value,
        "depths_cm": node.depths_temp_cm,
        "damping_min": min(ratios),
        "damping_max": max(ratios),
        "relative_span": round((max(ratios) - min(ratios)) / max(ratios), 4),
        "monotonic": False,
        "peak_at_vwc": peak_vwc,
        "curve": samples,
        "conclusion": (
            "non-monotonic and low-sensitivity: use as a coarse bracket only, "
            "never as a precision reference"
        ),
    }


if __name__ == "__main__":
    from .models import SoilTexture

    node = Node(node_id="x", latitude=0, longitude=0,
                texture=SoilTexture.CLAY_LOAM, bulk_density=1.35)
    rep = sensitivity_report(node)
    print(f"texture        {rep['texture']}")
    print(f"depths         {rep['depths_cm']} cm")
    print(f"damping range  {rep['damping_min']:.4f} .. {rep['damping_max']:.4f}")
    print(f"relative span  {rep['relative_span']:.1%}")
    print(f"peak at vwc    {rep['peak_at_vwc']}  (so the curve turns over)")
    print(f"\n{rep['conclusion']}")
