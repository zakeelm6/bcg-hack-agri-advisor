"""Generate the figures for the deck.

Run:  python3 make_figures.py

Produces figures/ containing:
  satellite_detection.png  - the NDVI time series, baseline, and detection
  sensor_timeline.png      - moisture, tension and QC flags over a month
"""

from __future__ import annotations

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

from satellite import (
    DetectionConfig,
    delineate_zones,
    detect,
    generate_field,
    score_detection,
)
from satellite.anomaly import learn_baseline
from sensors import (
    FaultType,
    Node,
    NodeSimulator,
    SimConfig,
    SoilTexture,
    detect_drift,
    field_capacity,
    run_qc,
    wilting_point,
)

OUT = "figures"
NDVI_CMAP = LinearSegmentedColormap.from_list(
    "ndvi", ["#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#5ab4ac", "#1a7a3e"])


def satellite_figure() -> str:
    grid, scenes, truth = generate_field()
    cfg = DetectionConfig()
    zones = detect(scenes, grid, cfg)
    score = score_detection(zones, truth, grid)
    baseline = learn_baseline(scenes, grid, cfg)

    detected = np.zeros((grid.rows, grid.cols), dtype=bool)
    for z in zones:
        for r, c in z.pixel_indices:
            detected[r, c] = True

    fig, axes = plt.subplots(2, 3, figsize=(15, 7.5))
    fig.suptitle("Farm Advisor — within-field anomaly detection (SIMULATED data)",
                 fontsize=14, fontweight="bold")

    def show(ax, data, title, cmap=NDVI_CMAP, vmin=0, vmax=1):
        d = np.where(grid.mask, data, np.nan)
        im = ax.imshow(d, cmap=cmap, vmin=vmin, vmax=vmax, interpolation="nearest")
        ax.set_title(title, fontsize=10)
        ax.set_xticks([])
        ax.set_yticks([])
        return im

    early, late = scenes[1], scenes[-3]
    im = show(axes[0, 0], early.ndvi, f"NDVI — {early.acquired}\n(before stress)")
    show(axes[0, 1], late.ndvi, f"NDVI — {late.acquired}\n(stress present)")
    fig.colorbar(im, ax=axes[0, :2].tolist(), fraction=0.025, label="NDVI")

    b = np.where(grid.interior(1), baseline, np.nan)
    im2 = axes[0, 2].imshow(b, cmap="RdYlGn", vmin=-2, vmax=2, interpolation="nearest")
    axes[0, 2].set_title("Learned baseline\n(each pixel's normal standing)", fontsize=10)
    axes[0, 2].set_xticks([]); axes[0, 2].set_yticks([])
    fig.colorbar(im2, ax=axes[0, 2], fraction=0.046, label="robust z")

    show(axes[1, 0], truth.astype(float), f"Injected stress (truth)\n{int(truth.sum())} px",
         cmap="Reds", vmin=0, vmax=1)
    show(axes[1, 1], detected.astype(float),
         f"Detected\nprecision {score['precision']:.2f} · recall {score['recall']:.2f}",
         cmap="Reds", vmin=0, vmax=1)

    mz = delineate_zones(scenes, grid, n_zones=3)
    zmap = np.full((grid.rows, grid.cols), np.nan)
    for z in mz:
        for r, c in z.pixel_indices:
            zmap[r, c] = z.rank
    axes[1, 2].imshow(zmap, cmap="viridis", interpolation="nearest")
    axes[1, 2].set_title(f"Management zones\n{len(mz)} stable zones", fontsize=10)
    axes[1, 2].set_xticks([]); axes[1, 2].set_yticks([])

    fig.text(0.5, 0.015,
             "Baseline from the first 4 passes · departure standardised per date · "
             "persistence ≥ 3 passes · edge pixels excluded",
             ha="center", fontsize=9, style="italic", color="#444")

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "satellite_detection.png")
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def sensor_figure() -> str:
    node = Node(node_id="sentinel-01", latitude=33.21, longitude=-7.58,
                texture=SoilTexture.CLAY_LOAM, bulk_density=1.35)
    cfg = SimConfig(days=40, seed=11)

    healthy = list(NodeSimulator(node, cfg).run())
    run_qc(healthy, node)
    drifting = list(NodeSimulator(node, cfg, fault=FaultType.DRIFT,
                                  fault_start_day=15).run())
    run_qc(drifting, node)
    res = detect_drift(drifting, node)

    t = [r.timestamp for r in healthy]
    fig, axes = plt.subplots(3, 1, figsize=(13, 8), sharex=True)
    fig.suptitle("Farm Advisor — sentinel node, 40 days (SIMULATED data)",
                 fontsize=14, fontweight="bold")

    ax = axes[0]
    ax.plot(t, [r.vwc_shallow for r in healthy], lw=1.1, color="#1f77b4",
            label="15 cm")
    ax.plot(t, [r.vwc_deep for r in healthy], lw=1.1, color="#2a9d8f",
            label="30 cm")
    ax.axhline(field_capacity(node.texture), ls="--", color="#888", lw=1)
    ax.axhline(wilting_point(node.texture), ls="--", color="#c0392b", lw=1)
    ax.text(t[2], field_capacity(node.texture) + 0.004, "field capacity",
            fontsize=8, color="#555")
    ax.text(t[2], wilting_point(node.texture) + 0.004, "wilting point",
            fontsize=8, color="#c0392b")
    rain = [r.rainfall_mm or 0 for r in healthy]
    ax2 = ax.twinx()
    ax2.bar(t, rain, width=0.02, color="#9ecae1", alpha=0.8)
    ax2.set_ylabel("rain (mm)", fontsize=9)
    ax2.set_ylim(0, max(rain) * 4 + 1)
    ax.set_ylabel("vol. water content\n(m³/m³)", fontsize=9)
    ax.legend(loc="upper right", fontsize=8)
    ax.set_title("Soil moisture and rainfall", fontsize=10, loc="left")

    ax = axes[1]
    ax.plot(t, [r.tension_shallow for r in healthy], lw=1.1, color="#6a4c93")
    ax.axhline(-50, ls="--", color="#e76f51", lw=1)
    ax.text(t[2], -47, "irrigation trigger (−50 kPa)", fontsize=8, color="#e76f51")
    ax.set_ylabel("matric potential\n(kPa)", fontsize=9)
    ax.set_title("Tension — what the plant actually feels", fontsize=10, loc="left")

    ax = axes[2]
    ax.plot(t, [r.vwc_shallow for r in healthy], lw=1.1, color="#1f77b4",
            label="healthy probe")
    ax.plot(t, [r.vwc_shallow for r in drifting], lw=1.1, color="#c0392b",
            label="corroding probe")
    if res.detection_day is not None:
        idx = min(int(res.detection_day * 96), len(t) - 1)
        ax.axvline(t[idx], color="#c0392b", ls=":", lw=1.6)
        ax.text(t[idx], 0.30, f"  drift detected\n  day {res.detection_day}",
                fontsize=8, color="#c0392b", va="top")
    ax.axvline(t[15 * 96], color="#888", ls="--", lw=1.2)
    ax.text(t[15 * 96], 0.13, "  fault injected\n  day 15", fontsize=8, color="#555")
    ax.set_ylabel("vol. water content\n(m³/m³)", fontsize=9)
    ax.legend(loc="upper right", fontsize=8)
    ax.set_title("Drift is invisible per reading — caught by the water balance",
                 fontsize=10, loc="left")

    fig.autofmt_xdate()
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "sensor_timeline.png")
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


if __name__ == "__main__":
    print("generating figures...")
    print(" ", satellite_figure())
    print(" ", sensor_figure())
    print("done")
