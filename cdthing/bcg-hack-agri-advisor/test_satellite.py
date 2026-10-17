"""Tests for the satellite layer. Run: python3 test_satellite.py

Each assertion corresponds to a claim we make on stage.
"""

from __future__ import annotations

import sys

import numpy as np

from satellite import (
    DetectionConfig,
    FieldRecipe,
    delineate_zones,
    detect,
    generate_field,
    growth_curve,
    ndvi,
    ndwi,
    savi,
    score_detection,
    to_geojson,
)
from satellite.anomaly import learn_baseline, robust_stats

SEEDS = (1, 7, 42, 99)
PASSED: list[str] = []
FAILED: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    (PASSED if condition else FAILED).append(f"{name} {detail}".rstrip())
    print(f"  {'PASS' if condition else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def test_indices() -> None:
    print("\nINDICES")
    red = np.array([0.05, 0.25, 0.04])
    nir = np.array([0.45, 0.30, 0.50])
    v = ndvi(red, nir)

    check("NDVI in [-1, 1]", bool(np.all((v >= -1) & (v <= 1))))
    check("dense canopy reads high", v[0] > 0.6, f"{v[0]:.2f}")
    check("bare soil reads low", v[1] < 0.2, f"{v[1]:.2f}")

    # Division guard: equal and opposite bands must not raise or return inf
    safe = ndvi(np.array([0.0]), np.array([0.0]))
    check("zero denominator handled", bool(np.isnan(safe[0]) or np.isfinite(safe[0])))

    # SAVI should damp the soil background relative to NDVI on a sparse canopy
    sparse_red, sparse_nir = np.array([0.20]), np.array([0.28])
    check("SAVI differs from NDVI on sparse canopy",
          abs(float(savi(sparse_red, sparse_nir)[0] - ndvi(sparse_red, sparse_nir)[0])) > 0.01)


def test_growth_curve() -> None:
    print("\nSEASONAL CURVE")
    vals = [growth_curve(i, 12) for i in range(12)]
    check("starts near bare soil", vals[0] < 0.25, f"{vals[0]:.2f}")
    check("peaks at canopy closure", max(vals) > 0.8, f"{max(vals):.2f}")
    check("senesces at the end", vals[-1] < max(vals) - 0.3, f"{vals[-1]:.2f}")
    check("peak is mid-season", 4 <= int(np.argmax(vals)) <= 9,
          f"pass {int(np.argmax(vals))}")


def test_no_false_positives() -> None:
    print("\nFALSE POSITIVES - the test that matters most")
    total_zones = 0
    for seed in (1, 7, 42, 99, 123, 256):
        grid, scenes, _ = generate_field(FieldRecipe(seed=seed, stress_depth=0.0))
        total_zones += len(detect(scenes, grid))
    check("no anomalies on healthy fields", total_zones == 0,
          f"{total_zones} zones across 6 seeds")


def test_detects_injected_stress() -> None:
    print("\nDETECTION")
    recalls, precisions = [], []
    for seed in SEEDS:
        grid, scenes, truth = generate_field(FieldRecipe(seed=seed))
        s = score_detection(detect(scenes, grid), truth, grid)
        recalls.append(s["recall"])
        precisions.append(s["precision"])

    check("recall high on a clear patch", np.mean(recalls) > 0.85,
          f"{np.mean(recalls):.2f}")
    check("precision high", np.mean(precisions) > 0.9,
          f"{np.mean(precisions):.2f}")

    # The patch must be found as ONE zone, not scattered fragments
    grid, scenes, truth = generate_field()
    zones = detect(scenes, grid)
    check("patch found as a single zone", len(zones) == 1, f"{len(zones)} zones")


def test_detection_limit() -> None:
    print("\nDETECTION LIMIT - documented, not hidden")
    results = {}
    for depth in (0.03, 0.05, 0.08):
        rs = [score_detection(*_run(seed, depth)) for seed in SEEDS]
        results[depth] = float(np.mean([r["recall"] for r in rs]))

    check("blind below 0.03 NDVI", results[0.03] < 0.4, f"recall {results[0.03]:.2f}")
    check("usable at 0.05 NDVI", results[0.05] > 0.6, f"recall {results[0.05]:.2f}")
    check("reliable at 0.08 NDVI", results[0.08] > 0.9, f"recall {results[0.08]:.2f}")

    # Failure mode must be misses, never invented anomalies
    faint = [score_detection(*_run(seed, 0.03)) for seed in SEEDS]
    fp = sum(r["false_positive_px"] for r in faint)
    check("fails by missing, not by inventing", fp < 20, f"{fp} false positive px")


def _run(seed: int, depth: float):
    grid, scenes, truth = generate_field(
        FieldRecipe(seed=seed, stress_depth=depth))
    return detect(scenes, grid), truth, grid


def test_cloud_robustness() -> None:
    print("\nCLOUD ROBUSTNESS")
    for cp in (0.5, 0.9):
        rs = []
        for seed in SEEDS:
            grid, scenes, truth = generate_field(
                FieldRecipe(seed=seed, cloud_probability=cp))
            rs.append(score_detection(detect(scenes, grid), truth, grid))
        r = float(np.mean([x["recall"] for x in rs]))
        p = float(np.mean([x["precision"] for x in rs]))
        check(f"survives {cp:.0%} clouded passes", r > 0.8 and p > 0.9,
              f"recall {r:.2f} precision {p:.2f}")


def test_baseline_requirement() -> None:
    print("\nBASELINE REQUIREMENT")
    short = []
    for seed in SEEDS:
        grid, scenes, truth = generate_field(FieldRecipe(seed=seed, n_dates=6))
        short.append(score_detection(detect(scenes, grid), truth, grid)["recall"])
    check("too few passes = no detection", float(np.mean(short)) < 0.4,
          f"recall {np.mean(short):.2f} with 6 passes")

    long_ = []
    for seed in SEEDS:
        grid, scenes, truth = generate_field(FieldRecipe(seed=seed, n_dates=10))
        long_.append(score_detection(detect(scenes, grid), truth, grid)["recall"])
    check("10 passes is enough", float(np.mean(long_)) > 0.9,
          f"recall {np.mean(long_):.2f}")

    grid, scenes, _ = generate_field()
    b = learn_baseline(scenes, grid, DetectionConfig())
    check("baseline is learned", b is not None and np.isfinite(b).any())


def test_edge_exclusion() -> None:
    print("\nEDGE HANDLING")
    grid, scenes, _ = generate_field()
    interior = grid.interior(1)
    check("interior is smaller than the plot", interior.sum() < grid.mask.sum(),
          f"{int(interior.sum())} vs {int(grid.mask.sum())} px")

    zones = detect(scenes, grid)
    on_edge = any(not interior[r, c] for z in zones for r, c in z.pixel_indices)
    check("no anomaly sits on the boundary", not on_edge)


def test_zones() -> None:
    print("\nMANAGEMENT ZONES")
    grid, scenes, _ = generate_field()
    zones = delineate_zones(scenes, grid, n_zones=3)

    check("three zones delineated", len(zones) == 3, f"{len(zones)}")
    check("zones are ranked by vigour",
          all(a.mean_vigour <= b.mean_vigour for a, b in zip(zones, zones[1:])))
    check("zones are stable across passes",
          all(z.stability > 0.5 for z in zones),
          f"min {min(z.stability for z in zones):.2f}")

    covered = sum(z.n_pixels for z in zones)
    check("zones cover the interior", covered > 0.9 * grid.interior(1).sum(),
          f"{covered}/{int(grid.interior(1).sum())} px")


def test_handoff_contract() -> None:
    print("\nENGINE HANDOFF")
    grid, scenes, _ = generate_field()
    zones = detect(scenes, grid)
    check("at least one zone to hand off", len(zones) > 0)

    task = zones[0].to_task(grid)
    for key in ("action", "zone_id", "location", "area_ha", "why",
                "severity", "confidence"):
        check(f"task has '{key}'", key in task)

    check("action is inspect, never a dose", task["action"] == "inspect",
          task["action"])
    check("no dose field leaks in",
          not any(k in task for k in ("amount", "dose", "kg_ha")))

    gj = to_geojson(zones, grid)
    check("GeoJSON is well formed",
          gj["type"] == "FeatureCollection" and len(gj["features"]) == len(zones))


if __name__ == "__main__":
    print("FARM ADVISOR - SATELLITE LAYER TESTS")
    test_indices()
    test_growth_curve()
    test_no_false_positives()
    test_detects_injected_stress()
    test_detection_limit()
    test_cloud_robustness()
    test_baseline_requirement()
    test_edge_exclusion()
    test_zones()
    test_handoff_contract()

    print(f"\n{'=' * 60}")
    print(f"{len(PASSED)} passed, {len(FAILED)} failed")
    for f in FAILED:
        print(f"  FAILED: {f}")
    print(f"{'=' * 60}")
    sys.exit(1 if FAILED else 0)
