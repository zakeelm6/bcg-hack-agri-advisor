"""Sentinel node simulator.

Generates a labelled synthetic stream so the whole pipeline can be demonstrated
without hardware. Every frame carries ground truth alongside the "measured"
value, so the QC module can be scored rather than merely demonstrated.

The output is always labelled as simulated. We never present it as field data.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Iterator, Optional

from .models import TEXTURE_PARAMS, Node, Reading, SoilTexture
from .physics import (
    amplitude_ratio,
    field_capacity,
    phase_lag_hours,
    thermal_diffusivity,
    vwc_to_tension_kpa,
    wilting_point,
)


class FaultType(str, Enum):
    """The failure modes we actually see on cheap capacitive probes."""

    NONE = "none"
    SPIKE = "spike"               # electrical noise, bad contact
    DROWNED = "drowned"           # saturated plateau, probe under water
    CABLE_CUT = "cable_cut"       # low constant, probe out of soil
    DRIFT = "drift"               # slow corrosion drift - the dangerous one
    DUG_UP = "dug_up"             # step jump, probe moved


@dataclass
class SimConfig:
    days: int = 30
    interval_minutes: int = 15
    start: datetime = datetime(2026, 3, 1, 0, 0)

    # Climate
    mean_air_temp: float = 18.0
    diurnal_amplitude: float = 9.0
    et0_mm_day: float = 4.5                 # reference evapotranspiration
    rain_probability_per_day: float = 0.12
    rain_mm_when_it_rains: tuple[float, float] = (4.0, 28.0)

    # Initial state
    initial_vwc: float = 0.28

    # Noise
    vwc_noise: float = 0.004
    temp_noise: float = 0.15

    seed: Optional[int] = 42


class NodeSimulator:
    """Simulates one sentinel node with a simple but honest water balance."""

    def __init__(self, node: Node, config: SimConfig | None = None,
                 fault: FaultType = FaultType.NONE,
                 fault_start_day: int = 15):
        self.node = node
        self.cfg = config or SimConfig()
        self.fault = fault
        self.fault_start_day = fault_start_day
        self.rng = random.Random(self.cfg.seed)

        self.theta_s = TEXTURE_PARAMS[node.texture]["theta_s"]
        self.wp = wilting_point(node.texture)
        self.fc = field_capacity(node.texture)

        # Two layers: 0-22 cm and 22-45 cm, centred on the two probe depths
        self.vwc_shallow = self.cfg.initial_vwc
        self.vwc_deep = self.cfg.initial_vwc + 0.02   # deeper layers run slightly wetter
        self.layer_depth_m = 0.22

    # -- climate -----------------------------------------------------------

    def _rain_for_step(self, t: datetime, step_hours: float) -> float:
        """Rain arrives as short convective bursts, not as a daily average."""
        p_step = self.cfg.rain_probability_per_day * step_hours / 24.0
        if self.rng.random() < p_step:
            lo, hi = self.cfg.rain_mm_when_it_rains
            return self.rng.uniform(lo, hi)
        return 0.0

    def _air_temp(self, t: datetime) -> float:
        hour = t.hour + t.minute / 60.0
        # peak at 15:00
        diurnal = self.cfg.diurnal_amplitude * math.sin(2 * math.pi * (hour - 9.0) / 24.0)
        seasonal = 3.0 * math.sin(2 * math.pi * (t.timetuple().tm_yday - 80) / 365.0)
        return self.cfg.mean_air_temp + diurnal + seasonal

    def _soil_temps(self, t: datetime, vwc: float) -> tuple[float, float]:
        """Diurnal wave propagated downward.

        The damping and the lag both depend on moisture through the thermal
        diffusivity. This is exactly the signal the virtual sensor inverts.
        """
        kappa = thermal_diffusivity(vwc, self.node.texture, self.node.bulk_density)
        z1 = self.node.depths_temp_cm[0] / 100.0
        z2 = self.node.depths_temp_cm[1] / 100.0

        surface_mean = self.cfg.mean_air_temp + 1.5
        surface_amp = self.cfg.diurnal_amplitude * 0.8

        hour = t.hour + t.minute / 60.0

        a1 = surface_amp * amplitude_ratio(kappa, 0.0, z1)
        a2 = surface_amp * amplitude_ratio(kappa, 0.0, z2)
        lag1 = phase_lag_hours(kappa, 0.0, z1)
        lag2 = phase_lag_hours(kappa, 0.0, z2)

        t1 = surface_mean + a1 * math.sin(2 * math.pi * (hour - 9.0 - lag1) / 24.0)
        t2 = surface_mean + a2 * math.sin(2 * math.pi * (hour - 9.0 - lag2) / 24.0)
        return t1, t2

    # -- water balance -----------------------------------------------------

    def _step_water_balance(self, rain_mm: float, step_hours: float, air_temp: float) -> None:
        """Rain in at the top, ET out of both layers, drainage above field capacity."""
        # Evapotranspiration scaled by temperature and by how much water is left
        et_mm = self.cfg.et0_mm_day * (step_hours / 24.0)
        et_mm *= max(0.3, min(1.6, air_temp / self.cfg.mean_air_temp))

        stress = (self.vwc_shallow - self.wp) / max(self.fc - self.wp, 1e-6)
        et_mm *= min(max(stress, 0.0), 1.0)

        layer_mm = self.layer_depth_m * 1000.0

        # Infiltration into the shallow layer
        self.vwc_shallow += rain_mm / layer_mm
        # 70% of ET from shallow, 30% from deep
        self.vwc_shallow -= 0.7 * et_mm / layer_mm
        self.vwc_deep -= 0.3 * et_mm / layer_mm

        # Drainage: anything above field capacity moves down within the hour
        if self.vwc_shallow > self.fc:
            excess = (self.vwc_shallow - self.fc) * 0.5
            self.vwc_shallow -= excess
            self.vwc_deep += excess

        if self.vwc_deep > self.theta_s:
            self.vwc_deep = self.theta_s  # deep drainage out of the profile

        self.vwc_shallow = min(max(self.vwc_shallow, self.wp * 0.8), self.theta_s)
        self.vwc_deep = min(max(self.vwc_deep, self.wp * 0.8), self.theta_s)

    # -- faults ------------------------------------------------------------

    def _apply_fault(self, reading: Reading, day: int, step: int) -> Reading:
        if self.fault is FaultType.NONE or day < self.fault_start_day:
            return reading

        elapsed_days = day - self.fault_start_day

        if self.fault is FaultType.SPIKE:
            # one isolated bad sample every ~40 steps
            if step % 40 == 0:
                reading.vwc_shallow = min(0.59, (reading.vwc_shallow or 0) + 0.25)

        elif self.fault is FaultType.DROWNED:
            reading.vwc_shallow = self.theta_s - 0.001

        elif self.fault is FaultType.CABLE_CUT:
            reading.vwc_shallow = 0.012
            reading.tension_shallow = None

        elif self.fault is FaultType.DRIFT:
            # ~0.004 m3/m3 per day of corrosion drift: invisible per-sample,
            # catastrophic after a month. Caught only by cross-checks.
            reading.vwc_shallow = (reading.vwc_shallow or 0) - 0.004 * elapsed_days

        elif self.fault is FaultType.DUG_UP:
            reading.vwc_shallow = (reading.vwc_shallow or 0) - 0.09

        return reading

    # -- main loop ---------------------------------------------------------

    def run(self) -> Iterator[Reading]:
        step_hours = self.cfg.interval_minutes / 60.0
        n_steps = int(self.cfg.days * 24 / step_hours)
        t = self.cfg.start
        battery = 4.15

        for step in range(n_steps):
            day = step * self.cfg.interval_minutes // (24 * 60)

            air_temp = self._air_temp(t)
            rain = self._rain_for_step(t, step_hours)
            self._step_water_balance(rain, step_hours, air_temp)

            ts, td = self._soil_temps(t, self.vwc_shallow)

            # Measured values = truth + sensor noise + calibration offset
            vwc_s = self.vwc_shallow + self.rng.gauss(0, self.cfg.vwc_noise)
            vwc_s += self.node.calibration_offset
            vwc_d = self.vwc_deep + self.rng.gauss(0, self.cfg.vwc_noise)

            stress = 1.0 - (self.vwc_shallow - self.wp) / max(self.fc - self.wp, 1e-6)
            stress = min(max(stress, 0.0), 1.0)

            reading = Reading(
                node_id=self.node.node_id,
                timestamp=t,
                vwc_shallow=round(vwc_s, 4),
                vwc_deep=round(vwc_d, 4),
                temp_shallow=round(ts + self.rng.gauss(0, self.cfg.temp_noise), 2),
                temp_deep=round(td + self.rng.gauss(0, self.cfg.temp_noise), 2),
                tension_shallow=round(vwc_to_tension_kpa(self.vwc_shallow, self.node.texture), 1),
                tension_deep=round(vwc_to_tension_kpa(self.vwc_deep, self.node.texture), 1),
                canopy_temp=round(air_temp + (-2.0 + 6.0 * stress), 2),
                air_temp=round(air_temp, 2),
                leaf_wetness=round(1.0 if rain > 0 else max(0.0, 1.0 - (t.hour - 6) / 6.0), 2),
                rainfall_mm=round(rain, 2),
                battery_v=round(battery, 3),
                rssi_dbm=self.rng.randint(-118, -95),
            )

            reading = self._apply_fault(reading, day, step)

            # Battery sags slowly, faster when cold
            battery -= 0.00012 + (0.00008 if air_temp < 8 else 0.0)
            battery = max(battery, 3.2)

            yield reading
            t += timedelta(minutes=self.cfg.interval_minutes)


def simulate_village(n_plots: int = 6, days: int = 30,
                     seed: int = 42) -> tuple[list[Reading], dict[str, list[Reading]]]:
    """One sentinel node plus several plots that have no hardware.

    The plots are simulated so we can *measure* how well the offset model
    serves a farmer who owns nothing. In production those plots are unobserved.
    """
    rng = random.Random(seed)
    sentinel_node = Node(
        node_id="sentinel-01",
        latitude=33.21, longitude=-7.58,
        texture=SoilTexture.CLAY_LOAM,
        bulk_density=1.35,
    )
    cfg = SimConfig(days=days, seed=seed)
    sentinel = list(NodeSimulator(sentinel_node, cfg).run())

    plots: dict[str, list[Reading]] = {}
    textures = [SoilTexture.SANDY_LOAM, SoilTexture.CLAY_LOAM, SoilTexture.LOAM,
                SoilTexture.CLAY, SoilTexture.LOAMY_SAND, SoilTexture.LOAM]

    for i in range(n_plots):
        texture = textures[i % len(textures)]
        node = Node(
            node_id=f"plot-{i+1:02d}",
            latitude=33.21 + rng.uniform(-0.01, 0.01),
            longitude=-7.58 + rng.uniform(-0.01, 0.01),
            texture=texture,
            bulk_density=rng.uniform(1.25, 1.45),
        )
        # Same weather, different soil and slightly different starting water
        plot_cfg = SimConfig(
            days=days, seed=seed,  # same seed -> same rainfall, as in one village
            initial_vwc=0.28 + rng.uniform(-0.05, 0.05),
        )
        plots[node.node_id] = list(NodeSimulator(node, plot_cfg).run())

    return sentinel, plots
