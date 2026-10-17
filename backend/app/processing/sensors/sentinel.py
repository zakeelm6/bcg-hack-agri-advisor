"""Temporal stability: how one sensor serves a whole village.

The spatial pattern of soil moisture is persistent. Plot A may always sit a
few points drier than the village mean, but it stays a few points drier. So a
well-chosen sentinel plus a learned per-plot offset gives a farmer with zero
hardware a number for his own land.

    theta_zone_j(t) ~= theta_sentinel(t) + delta_j

delta_j is the mean relative difference, learned during a short calibration
campaign. The sentinel is the location that minimises the standard deviation
of that relative difference (SDRD).
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from typing import Optional, Sequence

from .models import Reading


@dataclass
class PlotOffset:
    plot_id: str
    delta: float              # mean relative difference vs the sentinel [m3/m3]
    sdrd: float               # std dev of that difference - lower is more transferable
    n_samples: int
    rmse: Optional[float] = None   # validation error, when ground truth exists

    @property
    def is_transferable(self) -> bool:
        """A plot whose offset wobbles is not well served by this sentinel."""
        return self.sdrd < 0.03


@dataclass
class SentinelChoice:
    sentinel_id: str
    sdrd: float
    ranking: list[tuple[str, float]]


def _aligned(a: Sequence[Reading], b: Sequence[Reading]) -> list[tuple[float, float]]:
    """Pair up good readings that share a timestamp."""
    index = {r.timestamp: r for r in b if r.is_good and r.vwc_shallow is not None}
    pairs: list[tuple[float, float]] = []
    for r in a:
        if not r.is_good or r.vwc_shallow is None:
            continue
        other = index.get(r.timestamp)
        if other is not None:
            pairs.append((r.vwc_shallow, other.vwc_shallow))
    return pairs


def learn_offset(sentinel: Sequence[Reading], plot: Sequence[Reading],
                 plot_id: str) -> Optional[PlotOffset]:
    """Fit delta_j over the calibration window."""
    pairs = _aligned(sentinel, plot)
    if len(pairs) < 20:
        return None

    diffs = [p - s for s, p in pairs]
    delta = statistics.mean(diffs)
    sdrd = statistics.stdev(diffs) if len(diffs) > 1 else 0.0

    return PlotOffset(plot_id=plot_id, delta=round(delta, 4),
                      sdrd=round(sdrd, 4), n_samples=len(pairs))


def choose_sentinel(candidates: dict[str, Sequence[Reading]]) -> Optional[SentinelChoice]:
    """Pick the location that best represents the others.

    For each candidate we compute the mean SDRD against every other plot. The
    winner is the one whose relationship to its neighbours is most stable -
    not the wettest, not the central one, the most *predictable* one.
    """
    ids = list(candidates)
    if len(ids) < 2:
        return None

    scores: list[tuple[str, float]] = []
    for cand in ids:
        sdrds: list[float] = []
        for other in ids:
            if other == cand:
                continue
            off = learn_offset(candidates[cand], candidates[other], other)
            if off is not None:
                sdrds.append(off.sdrd)
        if sdrds:
            scores.append((cand, round(statistics.mean(sdrds), 4)))

    if not scores:
        return None

    scores.sort(key=lambda x: x[1])
    best_id, best_score = scores[0]
    return SentinelChoice(sentinel_id=best_id, sdrd=best_score, ranking=scores)


def propagate(sentinel_reading: Reading, offset: PlotOffset) -> Optional[float]:
    """Give a hardware-free plot its own number."""
    if sentinel_reading.vwc_shallow is None or not sentinel_reading.is_good:
        return None
    return round(sentinel_reading.vwc_shallow + offset.delta, 4)


def validate_offset(sentinel: Sequence[Reading], plot: Sequence[Reading],
                    offset: PlotOffset, split: float = 0.5) -> PlotOffset:
    """Train on the first part of the record, test on the rest.

    This is the number that answers "does the shared-sensor idea actually work?"
    - and it is the number to put on the slide, not the training fit.
    """
    pairs = _aligned(sentinel, plot)
    if len(pairs) < 40:
        return offset

    cut = int(len(pairs) * split)
    train, test = pairs[:cut], pairs[cut:]

    delta = statistics.mean([p - s for s, p in train])
    errors = [(s + delta) - p for s, p in test]
    rmse = math.sqrt(sum(e * e for e in errors) / len(errors))

    return PlotOffset(
        plot_id=offset.plot_id,
        delta=round(delta, 4),
        sdrd=offset.sdrd,
        n_samples=len(train),
        rmse=round(rmse, 4),
    )
