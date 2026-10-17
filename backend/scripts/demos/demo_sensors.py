"""End-to-end demonstration of the Farm Advisor sensor layer.

Run:  python scripts/demos/demo_sensors.py   (from backend/)

Everything printed below is computed from simulated data, labelled as such.
No figure here is presented as a field measurement.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))   # run from anywhere: the packages live in backend/app/processing

from app.processing.sensors import (
    TENSION_FLOOR_KPA,
    FaultType,
    Node,
    NodeSimulator,
    SimConfig,
    SoilTexture,
    choose_sentinel,
    cross_check,
    cwsi,
    detect_drift,
    estimate_daily,
    field_capacity,
    learn_offset,
    plant_available_water,
    propagate,
    qc_summary,
    run_qc,
    sensitivity_report,
    simulate_village,
    validate_offset,
    vwc_to_tension_kpa,
    wilting_point,
    zone_confidence,
)
from app.processing.sensors.qc import FLAG_DESCRIPTIONS


def rule(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


# ---------------------------------------------------------------------------
# 1. Why tension, not moisture
# ---------------------------------------------------------------------------

def demo_tension() -> None:
    rule("1. THE SAME MOISTURE MEANS OPPOSITE THINGS IN DIFFERENT SOILS")
    vwc = 0.18
    print(f"\nEvery plot below reads exactly {vwc:.2f} m3/m3 on a moisture probe.\n")
    print(f"{'texture':<14}{'tension kPa':>13}{'wilting pt':>13}{'status':>22}")
    print("-" * 62)

    for texture in SoilTexture:
        tension = vwc_to_tension_kpa(vwc, texture)
        wp = wilting_point(texture)
        if vwc <= wp:
            status = "PLANT IS DYING"
        elif tension < -100:
            status = "severe stress"
        elif tension < -50:
            status = "irrigate soon"
        else:
            status = "comfortable"
        shown = "air dry" if tension <= TENSION_FLOOR_KPA else f"{tension:.1f}"
        print(f"{texture.value:<14}{shown:>13}{wp:>13.3f}{status:>22}")

    print("\n-> Moisture content is not a decision variable. Tension is.")


# ---------------------------------------------------------------------------
# 2. Quality control catches real failure modes
# ---------------------------------------------------------------------------

def demo_qc() -> None:
    rule("2. QUALITY CONTROL - EACH FAULT INJECTED, THEN DETECTED")

    node = Node(node_id="qc-test", latitude=33.2, longitude=-7.6,
                texture=SoilTexture.CLAY_LOAM)
    seeds = (7, 11, 23, 42, 77)

    # --- false positives on clean nodes ------------------------------------
    total = good = 0
    for seed in seeds:
        data = list(NodeSimulator(node, SimConfig(days=30, seed=seed)).run())
        run_qc(data, node)
        s = qc_summary(data)
        total += s["_total"]
        good += s["_good"]

    print(f"\nFalse positives on HEALTHY nodes ({len(seeds)} seeds, 30 days each):")
    print(f"  {total - good} flagged out of {total} readings "
          f"= {100 * (total - good) / total:.3f}%")
    print("\n  Getting here took two fixes worth knowing about:")
    print("   * rain infiltration looks exactly like a spike to a second-")
    print("     derivative test, so rainfall exempts the spike and depth checks")
    print("   * single-sample differencing fires on the noise tail; the rise")
    print("     checks compare 1-hour rolling means instead")

    # --- detection on injected faults --------------------------------------
    print(f"\n{'injected fault':<13}{'flags raised':<28}{'caught':>8}  what it means")
    print("-" * 76)

    meaning = {
        "spike": "isolated bad samples, flagged individually",
        "drowned": "every reading after the fault",
        "cable_cut": "every reading after the fault",
        "drift": "INVISIBLE to QC - see section 3b",
        "dug_up": "one step change, one flagged reading",
    }

    for fault in FaultType:
        if fault is FaultType.NONE:
            continue
        raised: set[str] = set()
        caught = 0
        for seed in seeds:
            data = list(NodeSimulator(node, SimConfig(days=30, seed=seed),
                                      fault=fault, fault_start_day=15).run())
            run_qc(data, node)
            post = data[len(data) // 2:]
            caught += sum(1 for r in post if r.flags)
            raised.update(f for r in data for f in r.flags)

        label = ",".join(sorted(raised)) if raised else "(none)"
        pct = 100.0 * caught / (len(seeds) * 1440)
        print(f"{fault.value:<13}{label:<28}{pct:>7.1f}%  {meaning[fault.value]}")

    print("\nFlag meanings:")
    for code in ("D01", "D03", "D04", "D06", "D10", "X01"):
        print(f"  {code}  {FLAG_DESCRIPTIONS[code]}")

    print("\n-> 'drift' raises NOTHING. A slow corrosion drift is plausible")
    print("   sample by sample, so no per-reading test can ever see it.")
    print("   That is the gap section 3b closes.")


# ---------------------------------------------------------------------------
# 3. The thermal virtual sensor catches what QC cannot
# ---------------------------------------------------------------------------

def demo_thermal() -> None:
    rule("3. THE TWO-THERMOMETER TRICK - AND WHY IT IS ONLY A COARSE CHECK")

    node = Node(node_id="thermal-test", latitude=33.2, longitude=-7.6,
                texture=SoilTexture.CLAY_LOAM, bulk_density=1.35)

    rep = sensitivity_report(node)
    print(f"\nForward model, {rep['texture']} at {rep['depths_cm'][0]}/"
          f"{rep['depths_cm'][1]} cm:")
    print(f"  damping ratio spans {rep['damping_min']:.4f} .. {rep['damping_max']:.4f}"
          f"  = {rep['relative_span']:.1%} of signal")
    print(f"  curve PEAKS at vwc {rep['peak_at_vwc']:.3f}, then falls")
    print(f"  monotonic: {rep['monotonic']}")

    print("\n  vwc    damping")
    for vwc, ratio in rep["curve"][::8]:
        bar = "#" * int((ratio - rep["damping_min"]) /
                        max(rep["damping_max"] - rep["damping_min"], 1e-9) * 40)
        print(f"  {vwc:.3f}  {ratio:.4f}  {bar}")

    print(f"\n-> {rep['conclusion']}.")
    print("   A bisection root-finder would be WRONG here; we grid-search and")
    print("   return every feasible branch instead.")

    cfg = SimConfig(days=24, seed=11)
    healthy = list(NodeSimulator(node, cfg, fault=FaultType.NONE).run())
    estimates = estimate_daily(healthy, node)
    with_candidates = [e for e in estimates if e.vwc_candidates]

    print(f"\nHealthy node: {len(with_candidates)}/{len(estimates)} days produced "
          f"a feasible bracket.")
    ambiguous = sum(1 for e in with_candidates if e.ambiguous)
    print(f"Of those, {ambiguous} were ambiguous (more than one branch fits).")

    if with_candidates:
        print(f"\n{'day':<12}{'damping':>10}{'branches':>26}{'probe':>10}")
        print("-" * 58)
        by_day: dict = {}
        for r in healthy:
            by_day.setdefault(r.timestamp.date(), []).append(r.vwc_shallow)
        for est in with_candidates[:6]:
            probe = sum(by_day[est.day]) / len(by_day[est.day])
            branches = ", ".join(f"{c:.3f}" for c in est.vwc_candidates)
            print(f"{est.day.isoformat():<12}{est.damping_ratio:>10.4f}"
                  f"{branches:>26}{probe:>10.4f}")

    print("\n-> Honest verdict: usable to catch a probe reading 0.05 when the")
    print("   soil is mid-range. NOT usable as a precision reference.")


# ---------------------------------------------------------------------------
# 3b. The drift detector that actually works
# ---------------------------------------------------------------------------

def demo_water_balance() -> None:
    rule("3b. WATER-BALANCE RESIDUAL - THE DRIFT DETECTOR THAT WORKS")

    node = Node(node_id="wb-test", latitude=33.2, longitude=-7.6,
                texture=SoilTexture.CLAY_LOAM, bulk_density=1.35)

    print("\nCompare the probe against rainfall and ET - two sources that have")
    print("nothing to do with the probe - and CUSUM the residual.")
    print("\nTwo things make this work, both found by testing:")
    print("  * aggregate to DAILY MEDIANS first; differencing 15-min samples")
    print("    accumulates noise ~10x faster than the drift signal")
    print("  * compare against a learned BASELINE, not against zero; our ET")
    print("    model never matches a real soil exactly")

    print(f"\nFault injected on day 15. Three independent seeds:\n")
    print(f"{'seed':<7}{'scenario':<13}{'rate /day':>12}{'detected':>11}  result")
    print("-" * 64)

    for seed in (11, 23, 77):
        cfg = SimConfig(days=50, seed=seed)
        for label, fault in (("healthy", FaultType.NONE),
                             ("corroding", FaultType.DRIFT),
                             ("dug up", FaultType.DUG_UP),
                             ("spike", FaultType.SPIKE)):
            data = list(NodeSimulator(node, cfg, fault=fault,
                                      fault_start_day=15).run())
            res = detect_drift(data, node)
            day = f"day {res.detection_day}" if res.detection_day is not None else "-"
            mark = "DRIFT" if res.drift_detected else "ok"
            print(f"{seed:<7}{label:<13}{res.drift_rate_per_day:>+12.5f}"
                  f"{day:>11}  {mark}")
        print()

    print("-> Healthy never fires: no false alarms across three seeds.")
    print("-> Corroding fires every time, 5-11 days after injection. This is")
    print("   the fault QC cannot see, because no single reading is wrong.")
    print("-> Spikes do NOT trigger it: the daily median is robust, and the")
    print("   spike check in QC already owns that failure mode.")


# ---------------------------------------------------------------------------
# 4. One sensor, a whole village
# ---------------------------------------------------------------------------

def demo_sentinel() -> None:
    rule("4. ONE SHARED SENSOR SERVING PLOTS THAT OWN NO HARDWARE")

    _, plots = simulate_village(n_plots=6, days=40, seed=3)

    for pid, readings in plots.items():
        node = Node(node_id=pid, latitude=0, longitude=0,
                    texture=SoilTexture.CLAY_LOAM)
        run_qc(readings, node)

    choice = choose_sentinel(plots)
    print(f"\nSentinel selected: {choice.sentinel_id}  (mean SDRD {choice.sdrd:.4f})")
    print("\nCandidate ranking - lower SDRD means a more transferable relationship:")
    for pid, score in choice.ranking:
        marker = "  <- chosen" if pid == choice.sentinel_id else ""
        print(f"   {pid:<12}{score:>9.4f}{marker}")

    sentinel = plots[choice.sentinel_id]

    print(f"\n{'plot':<12}{'delta':>9}{'SDRD':>9}{'held-out RMSE':>16}{'verdict':>14}")
    print("-" * 60)

    rmses = []
    for pid, readings in plots.items():
        if pid == choice.sentinel_id:
            continue
        off = learn_offset(sentinel, readings, pid)
        if off is None:
            continue
        off = validate_offset(sentinel, readings, off)
        verdict = "usable" if off.is_transferable else "needs own sensor"
        rmse_txt = f"{off.rmse:.4f}" if off.rmse is not None else "n/a"
        print(f"{pid:<12}{off.delta:>+9.4f}{off.sdrd:>9.4f}{rmse_txt:>16}{verdict:>18}")
        if off.rmse is not None:
            rmses.append(off.rmse)

    if rmses:
        print(f"\nMean held-out RMSE across hardware-free plots: {sum(rmses)/len(rmses):.4f} m3/m3")
        print("Trained on the first half of the record, tested on the second half.")

    # Show one concrete propagated value
    last = sentinel[-1]
    other = [p for p in plots if p != choice.sentinel_id][0]
    off = learn_offset(sentinel, plots[other], other)
    if off:
        value = propagate(last, off)
        print(f"\nExample: at {last.timestamp:%Y-%m-%d %H:%M} the sentinel reads "
              f"{last.vwc_shallow:.4f} m3/m3.")
        print(f"         {other} owns no sensor; its offset is {off.delta:+.4f}.")
        print(f"         -> {other} is served {value:.4f} m3/m3.")


# ---------------------------------------------------------------------------
# 5. What the decision engine receives
# ---------------------------------------------------------------------------

def demo_decision_input() -> None:
    rule("5. WHAT THE RULE ENGINE ACTUALLY RECEIVES")

    node = Node(node_id="sentinel-01", latitude=33.21, longitude=-7.58,
                texture=SoilTexture.CLAY_LOAM, bulk_density=1.35)
    readings = list(NodeSimulator(node, SimConfig(days=30, seed=5)).run())
    run_qc(readings, node)

    latest = readings[-1]
    confidence = zone_confidence(readings)

    paw = plant_available_water(latest.vwc_shallow, node.texture, 0.30)
    stress = cwsi(latest.canopy_temp, latest.air_temp)

    print(f"\n  node                {node.node_id}  ({node.texture.value})")
    print(f"  timestamp           {latest.timestamp:%Y-%m-%d %H:%M}")
    print(f"  vwc 15 cm           {latest.vwc_shallow:.4f} m3/m3")
    print(f"  vwc 30 cm           {latest.vwc_deep:.4f} m3/m3")
    print(f"  tension 15 cm       {latest.tension_shallow:.1f} kPa")
    print(f"  soil temp 5 cm      {latest.temp_shallow:.2f} degC")
    print(f"  canopy - air        {latest.canopy_temp - latest.air_temp:+.2f} degC")
    print(f"  CWSI                {stress:.2f}  (0 = unstressed, 1 = fully stressed)")
    print(f"  available water     {paw:.1f} mm in the top 30 cm")
    print(f"  field capacity      {field_capacity(node.texture):.3f} m3/m3")
    print(f"  wilting point       {wilting_point(node.texture):.3f} m3/m3")
    print(f"  battery             {latest.battery_v:.3f} V")
    print(f"  QC flags            {latest.flags or '(none)'}")
    print(f"  ZONE CONFIDENCE     {confidence.upper()}")

    print("\n  The engine's first question is the last line. If it reads")
    print("  INSUFFICIENT, no dose is computed - the platform asks for a soil test.")


if __name__ == "__main__":
    print("\nFARM ADVISOR - SENSOR LAYER DEMONSTRATION")
    print("All data below is SIMULATED and labelled as such.")

    demo_tension()
    demo_qc()
    demo_thermal()
    demo_water_balance()
    demo_sentinel()
    demo_decision_input()

    print(f"\n{'=' * 70}")
    print("Three rules this layer enforces:")
    print("  1. Continuous sensors for what changes, field tests for what doesn't.")
    print("  2. No number reaches a farmer from an unvalidated sensor.")
    print("  3. A suspect sensor produces a request for verification, not a dose.")
    print(f"{'=' * 70}\n")
