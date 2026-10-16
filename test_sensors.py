"""Tests for the sensor layer. Run: python3 test_sensors.py

These lock in the properties we claim on stage. Each one failed at least
once during development, which is why it is here.
"""

from __future__ import annotations

import sys

from sensors import (
    TENSION_FLOOR_KPA,
    FaultType,
    Node,
    NodeSimulator,
    SimConfig,
    SoilTexture,
    choose_sentinel,
    detect_drift,
    estimate_daily,
    field_capacity,
    learn_offset,
    qc_summary,
    run_qc,
    sensitivity_report,
    simulate_village,
    validate_offset,
    vwc_to_tension_kpa,
    wilting_point,
)

SEEDS = (7, 11, 23, 42, 77)
PASSED: list[str] = []
FAILED: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    (PASSED if condition else FAILED).append(f"{name}  {detail}".rstrip())
    print(f"  {'PASS' if condition else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def node(texture=SoilTexture.CLAY_LOAM) -> Node:
    return Node(node_id="test", latitude=33.2, longitude=-7.6,
                texture=texture, bulk_density=1.35)


# ---------------------------------------------------------------------------

def test_physics() -> None:
    print("\nPHYSICS")

    # Retention curve must be monotonic: wetter soil is always easier to drink
    for texture in SoilTexture:
        tensions = [vwc_to_tension_kpa(v / 100, texture) for v in range(10, 40)]
        monotonic = all(b >= a for a, b in zip(tensions, tensions[1:]))
        check(f"retention monotonic ({texture.value})", monotonic)

    # Wilting point must sit below field capacity for every texture
    for texture in SoilTexture:
        wp, fc = wilting_point(texture), field_capacity(texture)
        check(f"wp < fc ({texture.value})", wp < fc, f"{wp:.3f} < {fc:.3f}")

    # The clamp exists because clay at vwc 0.18 otherwise returns -1e6 kPa
    t = vwc_to_tension_kpa(0.18, SoilTexture.CLAY)
    check("extreme tension clamped", t >= TENSION_FLOOR_KPA, f"{t:.0f} kPa")

    # Same moisture, opposite meaning - the core claim of section 1
    sand = vwc_to_tension_kpa(0.18, SoilTexture.SAND)
    clay_loam = vwc_to_tension_kpa(0.18, SoilTexture.CLAY_LOAM)
    check("same vwc differs by texture", abs(clay_loam) > 50 * abs(sand),
          f"sand {sand:.1f} vs clay loam {clay_loam:.1f} kPa")


def test_qc_no_false_positives() -> None:
    print("\nQC - FALSE POSITIVES")
    n = node()
    total = good = 0
    for seed in SEEDS:
        data = list(NodeSimulator(n, SimConfig(days=30, seed=seed)).run())
        run_qc(data, n)
        s = qc_summary(data)
        total += s["_total"]
        good += s["_good"]

    rate = (total - good) / total
    check("healthy nodes raise no flags", rate < 0.001,
          f"{total - good}/{total} = {100 * rate:.3f}%")


def test_qc_detects_faults() -> None:
    print("\nQC - DETECTION")
    n = node()

    for fault, min_rate in ((FaultType.DROWNED, 0.95),
                            (FaultType.CABLE_CUT, 0.95)):
        rates = []
        for seed in SEEDS:
            data = list(NodeSimulator(n, SimConfig(days=30, seed=seed),
                                      fault=fault, fault_start_day=15).run())
            run_qc(data, n)
            post = data[len(data) // 2:]
            rates.append(sum(1 for r in post if r.flags) / len(post))
        avg = sum(rates) / len(rates)
        check(f"{fault.value} detected", avg >= min_rate, f"{100 * avg:.1f}%")

    # Spikes: at least some isolated samples must be caught
    caught = 0
    for seed in SEEDS:
        data = list(NodeSimulator(n, SimConfig(days=30, seed=seed),
                                  fault=FaultType.SPIKE, fault_start_day=15).run())
        run_qc(data, n)
        caught += sum(1 for r in data[len(data) // 2:] if "D03" in r.flags)
    check("spikes detected", caught > 20, f"{caught} readings")

    # Drift must be INVISIBLE to QC - that is the whole point of 3b
    missed = True
    for seed in SEEDS:
        data = list(NodeSimulator(n, SimConfig(days=30, seed=seed),
                                  fault=FaultType.DRIFT, fault_start_day=15).run())
        run_qc(data, n)
        if sum(1 for r in data if r.flags) > 5:
            missed = False
    check("drift is invisible to per-reading QC", missed,
          "expected: QC cannot see it")


def test_water_balance_drift() -> None:
    print("\nWATER-BALANCE DRIFT DETECTOR")
    n = node()

    false_alarms = 0
    for seed in SEEDS:
        data = list(NodeSimulator(n, SimConfig(days=50, seed=seed)).run())
        if detect_drift(data, n).drift_detected:
            false_alarms += 1
    check("no false alarm on healthy nodes", false_alarms == 0,
          f"{false_alarms}/{len(SEEDS)} seeds")

    detected = 0
    latencies = []
    for seed in SEEDS:
        data = list(NodeSimulator(n, SimConfig(days=50, seed=seed),
                                  fault=FaultType.DRIFT, fault_start_day=15).run())
        res = detect_drift(data, n)
        if res.drift_detected:
            detected += 1
            latencies.append(res.detection_day - 15)
    check("corrosion drift detected", detected >= len(SEEDS) - 1,
          f"{detected}/{len(SEEDS)} seeds")
    if latencies:
        check("detection within 15 days", max(latencies) <= 15,
              f"latency {min(latencies)}-{max(latencies)} days")

    # Spikes must not masquerade as drift - the daily median handles them
    spike_alarms = 0
    for seed in SEEDS:
        data = list(NodeSimulator(n, SimConfig(days=50, seed=seed),
                                  fault=FaultType.SPIKE, fault_start_day=15).run())
        if detect_drift(data, n).drift_detected:
            spike_alarms += 1
    check("spikes do not trigger drift", spike_alarms == 0,
          f"{spike_alarms}/{len(SEEDS)} seeds")


def test_thermal_honesty() -> None:
    print("\nTHERMAL VIRTUAL SENSOR - HONESTY CHECKS")
    n = node()
    rep = sensitivity_report(n)

    # These assertions exist to stop anyone re-selling this as precise
    check("forward model is non-monotonic", rep["monotonic"] is False,
          f"peaks at vwc {rep['peak_at_vwc']}")
    check("sensitivity is low", rep["relative_span"] < 0.35,
          f"span {rep['relative_span']:.1%} of signal")

    data = list(NodeSimulator(n, SimConfig(days=20, seed=11)).run())
    estimates = estimate_daily(data, n)
    ambiguous = sum(1 for e in estimates if e.ambiguous)
    check("ambiguity is reported, not hidden", ambiguous > 0,
          f"{ambiguous}/{len(estimates)} days ambiguous")


def test_sentinel_offset() -> None:
    print("\nSENTINEL OFFSET MODEL")
    _, plots = simulate_village(n_plots=6, days=40, seed=3)
    for pid, readings in plots.items():
        run_qc(readings, node())

    choice = choose_sentinel(plots)
    check("a sentinel is selected", choice is not None, choice.sentinel_id)

    sentinel = plots[choice.sentinel_id]
    rmses = []
    for pid, readings in plots.items():
        if pid == choice.sentinel_id:
            continue
        off = learn_offset(sentinel, readings, pid)
        if off is None:
            continue
        off = validate_offset(sentinel, readings, off)
        if off.rmse is not None:
            rmses.append(off.rmse)

    mean_rmse = sum(rmses) / len(rmses)
    # Must beat the lab-calibration-in-field error we quote in SENSORS.md
    check("held-out RMSE beats uncalibrated probe", mean_rmse < 0.055,
          f"{mean_rmse:.4f} vs 0.055-0.191 m3/m3")
    check("every plot validated", len(rmses) == len(plots) - 1,
          f"{len(rmses)} plots")


if __name__ == "__main__":
    print("FARM ADVISOR - SENSOR LAYER TESTS")
    test_physics()
    test_qc_no_false_positives()
    test_qc_detects_faults()
    test_water_balance_drift()
    test_thermal_honesty()
    test_sentinel_offset()

    print(f"\n{'=' * 60}")
    print(f"{len(PASSED)} passed, {len(FAILED)} failed")
    if FAILED:
        for f in FAILED:
            print(f"  FAILED: {f}")
    print(f"{'=' * 60}")
    sys.exit(1 if FAILED else 0)
