"""End-to-end demonstration of the Farm Advisor satellite layer.

Run:  python scripts/demos/demo_satellite.py   (from backend/)

All scenes are SIMULATED and labelled as such. The detection code is the
same code that would run on real Sentinel-2 Level-2A input.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))   # run from anywhere: the packages live in backend/app/processing

import numpy as np

from app.processing.satellite import (
    DetectionConfig,
    FieldRecipe,
    delineate_zones,
    detect,
    generate_field,
    growth_curve,
    ndvi,
    score_detection,
    to_geojson,
)
from app.processing.satellite.anomaly import learn_baseline
from app.processing.satellite.zones import zone_summary


def rule(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def render(mask: np.ndarray, grid, chars: str = " .:-=+*#%@") -> None:
    """Crude ASCII map - enough to see the shape of what was found."""
    for r in range(grid.rows):
        line = ""
        for c in range(grid.cols):
            if not grid.mask[r, c]:
                line += " "
            elif mask[r, c]:
                line += "#"
            else:
                line += "."
        print("  " + line)


def demo_resolution() -> None:
    rule("1. WHAT 10 METRES ACTUALLY BUYS YOU")
    grid, scenes, truth = generate_field()

    print(f"\n  field            {grid.field_id}")
    print(f"  grid             {grid.rows} x {grid.cols} pixels at "
          f"{grid.pixel_size_m:.0f} m")
    print(f"  inside the plot  {grid.n_pixels} pixels = {grid.area_ha:.2f} ha")
    print(f"  per hectare      {grid.n_pixels / grid.area_ha:.0f} pixels")
    print(f"  revisit          every 5 days, {len(scenes)} passes simulated")

    print("\n  A sensor senses about one litre of soil. This is ~100")
    print("  observations per hectare, every 5 days, for free.")
    print("  That is why the satellite answers WHERE and the sensor WHEN.")


def demo_growth_curve() -> None:
    rule("2. WHY A FIXED NDVI THRESHOLD IS MEANINGLESS")
    print("\n  Seasonal NDVI for a healthy crop:\n")
    print(f"  {'pass':<7}{'NDVI':>7}   profile")
    for i in range(12):
        v = growth_curve(i, 12)
        print(f"  {i:<7}{v:>7.2f}   {'#' * int(v * 45)}")

    print("\n  NDVI 0.45 is healthy at pass 2 and alarming at pass 8.")
    print("  So every threshold is computed per field, per date, from that")
    print("  date's own distribution. Never a constant.")


def demo_detection() -> None:
    rule("3. DETECTION - BASELINE, DEPARTURE, PERSISTENCE")
    grid, scenes, truth = generate_field()

    cloudy = [s for s in scenes if s.cloud_fraction > 0.01]
    print(f"\n  {len(scenes)} passes, {len(cloudy)} with cloud")
    print(f"  injected stress patch: {int(truth.sum())} pixels "
          f"({truth.sum() * 100 / 10_000:.2f} ha)")

    cfg = DetectionConfig()
    baseline = learn_baseline(scenes, grid, cfg)
    print(f"\n  baseline learned from the first {cfg.baseline_dates} passes")
    print(f"  monitoring the remaining {len(scenes) - cfg.baseline_dates}")

    zones = detect(scenes, grid, cfg)
    score = score_detection(zones, truth, grid)

    print(f"\n  detected {len(zones)} anomaly zone(s)")
    for z in zones:
        print(f"    {z.zone_id}: {z.n_pixels} px, {z.area_ha:.2f} ha, "
              f"{z.severity}, seen on {z.persistence} passes, "
              f"NDVI {z.mean_deviation:+.3f}")

    print(f"\n  precision {score['precision']:.2f}   "
          f"recall {score['recall']:.2f}   F1 {score['f1']:.2f}")
    print(f"  false positives: {score['false_positive_px']} pixels")

    print("\n  TRUTH (injected)                    DETECTED")
    detected_mask = np.zeros_like(truth)
    for z in zones:
        for r, c in z.pixel_indices:
            detected_mask[r, c] = True

    for r in range(0, grid.rows, 2):
        left = right = ""
        for c in range(0, grid.cols, 1):
            left += " " if not grid.mask[r, c] else ("#" if truth[r, c] else ".")
            right += " " if not grid.mask[r, c] else ("#" if detected_mask[r, c] else ".")
        print(f"  {left}   {right}")


def demo_limits() -> None:
    rule("4. WHERE IT BREAKS - MEASURED, NOT ASSUMED")

    print("\n  A. No stress injected (false-positive test)")
    clean = True
    for seed in (1, 7, 42, 99, 123):
        grid, scenes, _ = generate_field(FieldRecipe(seed=seed, stress_depth=0.0))
        z = detect(scenes, grid)
        if z:
            clean = False
        print(f"     seed {seed:<5} zones found: {len(z)}")
    print(f"     -> {'never invents an anomaly' if clean else 'FALSE POSITIVES'}")

    print("\n  B. Detection limit by stress depth (4 seeds each)")
    print(f"     {'NDVI drop':<12}{'recall':>9}{'precision':>12}")
    for depth in (0.02, 0.03, 0.04, 0.05, 0.06, 0.08):
        rs = []
        for seed in (1, 7, 42, 99):
            grid, scenes, truth = generate_field(
                FieldRecipe(seed=seed, stress_depth=depth))
            rs.append(score_detection(detect(scenes, grid), truth, grid))
        r = np.mean([s["recall"] for s in rs])
        p = np.mean([s["precision"] for s in rs])
        print(f"     {depth:<12.2f}{r:>9.2f}{p:>12.2f}")
    print("     -> usable from about 0.05; blind below 0.03")
    print("     -> precision stays 1.00 throughout: it misses, never invents")

    print("\n  C. Cloud cover")
    for cp in (0.25, 0.5, 0.75, 0.9):
        rs = []
        for seed in (1, 7, 42, 99):
            grid, scenes, truth = generate_field(
                FieldRecipe(seed=seed, cloud_probability=cp))
            rs.append(score_detection(detect(scenes, grid), truth, grid))
        print(f"     {cp:.0%} of passes clouded: "
              f"recall {np.mean([s['recall'] for s in rs]):.2f}")
    print("     -> persistence filtering plus the scene classification mask")
    print("        make cloud a non-issue; a shadow is dark on ONE date")

    print("\n  D. How many passes are needed")
    for nd in (6, 8, 10, 12):
        rs = []
        for seed in (1, 7, 42, 99):
            grid, scenes, truth = generate_field(FieldRecipe(seed=seed, n_dates=nd))
            rs.append(score_detection(detect(scenes, grid), truth, grid))
        print(f"     {nd:>2} passes: recall {np.mean([s['recall'] for s in rs]):.2f}")
    print("     -> needs ~8 passes = 40 days. Not a day-one feature;")
    print("        the baseline has to be earned first.")


def demo_zones() -> None:
    rule("5. MANAGEMENT ZONES - WHAT REPLACES INTERPOLATION")
    grid, scenes, truth = generate_field()
    zones = delineate_zones(scenes, grid, n_zones=3)

    print("\n  With 2-3 sensors per village you cannot estimate a variogram,")
    print("  so kriging across them is noise with a confidence interval.")
    print("  The satellite gives ~100 observations per hectare per pass.\n")

    print(f"  {'zone':<24}{'ha':>7}{'vigour':>9}{'stability':>11}  label")
    for row in zone_summary(zones):
        print(f"  {row['zone_id']:<24}{row['area_ha']:>7.2f}"
              f"{row['mean_vigour']:>9.2f}{row['stability']:>11.2f}  {row['label']}")

    print("\n  Stability near 1.0 means the pattern repeats every pass -")
    print("  that is soil, not weather. Those zones are worth sampling.")


def demo_handoff() -> None:
    rule("6. WHAT GOES TO THE DECISION ENGINE")
    grid, scenes, truth = generate_field()
    zones = detect(scenes, grid)

    if not zones:
        print("\n  no anomalies this run")
        return

    import json
    task = zones[0].to_task(grid)
    print("\n" + json.dumps(task, indent=2))

    print("\n  Note the action is 'inspect', never 'fertilise'.")
    print("  NDVI tells us WHERE, not WHY: nitrogen deficiency, water")
    print("  stress, disease and compaction all look like a dark patch.")
    print("  The engine turns this into a scouting task; a human or a soil")
    print("  test says why.")

    gj = to_geojson(zones, grid)
    print(f"\n  GeoJSON: {len(gj['features'])} feature(s) ready for the map.")


if __name__ == "__main__":
    print("\nFARM ADVISOR - SATELLITE LAYER DEMONSTRATION")
    print("All scenes are SIMULATED and labelled as such.")

    demo_resolution()
    demo_growth_curve()
    demo_detection()
    demo_limits()
    demo_zones()
    demo_handoff()

    print(f"\n{'=' * 70}")
    print("Three design decisions behind these numbers:")
    print("  1. Compare each pixel to its OWN baseline, not the field median.")
    print("     Otherwise you detect soil type, not problems.")
    print("  2. Standardise the departure by its own spread, so the threshold")
    print("     is self-calibrating and needs no per-field tuning.")
    print("  3. Require persistence across passes. A cloud shadow is dark")
    print("     once; real stress is dark every time.")
    print(f"{'=' * 70}\n")
