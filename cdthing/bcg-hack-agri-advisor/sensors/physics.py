"""Soil physics shared by the simulator and the virtual sensors.

Nothing here is machine-learned. These are closed-form relations a jury can check.
"""

from __future__ import annotations

import math

from .models import TEXTURE_PARAMS, SoilTexture

# ---------------------------------------------------------------------------
# Water retention: moisture <-> tension
# ---------------------------------------------------------------------------

# Oven-dry limit. Tensions beyond this are reported as "air dry" rather than
# as a number: the retention curve is extrapolating past anything measurable.
TENSION_FLOOR_KPA = -10000.0


def vwc_to_tension_kpa(vwc: float, texture: SoilTexture) -> float:
    """van Genuchten retention curve, inverted to give matric potential.

    This is the reason tension is worth measuring: the same vwc means
    'comfortable' in sand and 'starving' in clay.

    Returns a negative value in kPa (suction).
    """
    p = TEXTURE_PARAMS[texture]
    theta_r, theta_s, alpha, n = p["theta_r"], p["theta_s"], p["alpha"], p["n"]

    se = (vwc - theta_r) / (theta_s - theta_r)
    se = min(max(se, 1e-6), 1.0 - 1e-9)

    m = 1.0 - 1.0 / n
    head_cm = (1.0 / alpha) * (se ** (-1.0 / m) - 1.0) ** (1.0 / n)

    # 1 cm of water head ~ 0.0981 kPa
    tension = -head_cm * 0.0981

    # Clamp to the oven-dry limit. Below the wilting point the van Genuchten
    # extrapolation explodes (clay with n=1.09 gives -1e6 kPa at vwc 0.18),
    # which is numerically true and physically meaningless: the plant died
    # long before. Anything past -10000 kPa is reported as "air dry".
    return max(tension, TENSION_FLOOR_KPA)


def wilting_point(texture: SoilTexture) -> float:
    """vwc at -1500 kPa. Water below this exists but the plant cannot extract it."""
    return _vwc_at_tension(-1500.0, texture)


def field_capacity(texture: SoilTexture) -> float:
    """vwc at -33 kPa. The upper bound of water the soil holds against gravity."""
    return _vwc_at_tension(-33.0, texture)


def _vwc_at_tension(tension_kpa: float, texture: SoilTexture) -> float:
    p = TEXTURE_PARAMS[texture]
    theta_r, theta_s, alpha, n = p["theta_r"], p["theta_s"], p["alpha"], p["n"]
    m = 1.0 - 1.0 / n

    head_cm = abs(tension_kpa) / 0.0981
    se = (1.0 + (alpha * head_cm) ** n) ** (-m)
    return theta_r + se * (theta_s - theta_r)


def plant_available_water(vwc: float, texture: SoilTexture, depth_m: float) -> float:
    """Usable water stored in a layer [mm]. Drives the pre-season crop choice card."""
    usable = max(vwc - wilting_point(texture), 0.0)
    return usable * depth_m * 1000.0


# ---------------------------------------------------------------------------
# Thermal properties: this is what lets two thermometers replace a moisture probe
# ---------------------------------------------------------------------------

# Volumetric heat capacity [MJ m-3 K-1]
C_WATER = 4.18
C_MINERAL = 2.0


def volumetric_heat_capacity(vwc: float, bulk_density: float) -> float:
    """de Vries mixing model, simplified to mineral + water."""
    mineral_fraction = bulk_density / 2.65  # 2.65 t/m3 = particle density
    return mineral_fraction * C_MINERAL + vwc * C_WATER


def thermal_conductivity(vwc: float, texture: SoilTexture) -> float:
    """Campbell-style conductivity [W m-1 K-1].

    Rises steeply with the first water added (bridging air gaps between grains),
    then saturates. That steep early rise is what makes the inversion work.
    """
    theta_s = TEXTURE_PARAMS[texture]["theta_s"]
    saturation = min(max(vwc / theta_s, 0.0), 1.0)
    dry, wet = 0.25, 1.60
    return dry + (wet - dry) * (saturation ** 0.5)


def thermal_diffusivity(vwc: float, texture: SoilTexture, bulk_density: float) -> float:
    """kappa = lambda / C, in m2/s."""
    lam = thermal_conductivity(vwc, texture)                 # W m-1 K-1
    c = volumetric_heat_capacity(vwc, bulk_density) * 1e6    # J m-3 K-1
    return lam / c


def damping_depth(kappa: float, period_s: float = 86400.0) -> float:
    """d = sqrt(2*kappa/omega). The depth at which the daily wave falls to 1/e."""
    omega = 2.0 * math.pi / period_s
    return math.sqrt(2.0 * kappa / omega)


def amplitude_ratio(kappa: float, z1_m: float, z2_m: float) -> float:
    """A(z2)/A(z1) for the diurnal wave. Deeper and drier -> more damping."""
    d = damping_depth(kappa)
    return math.exp(-(z2_m - z1_m) / d)


def phase_lag_hours(kappa: float, z1_m: float, z2_m: float) -> float:
    """How many hours later the daily peak arrives at the deeper probe."""
    d = damping_depth(kappa)
    return (z2_m - z1_m) / d * (24.0 / (2.0 * math.pi))


# ---------------------------------------------------------------------------
# Crop water stress
# ---------------------------------------------------------------------------


def cwsi(canopy_temp: float, air_temp: float, vpd_kpa: float = 2.0) -> float:
    """Crop Water Stress Index from the MLX90614, clipped to [0, 1].

    A transpiring plant runs cooler than the air. A stressed one closes its
    stomata and heats up - and it does so before the soil looks dry.
    """
    dt = canopy_temp - air_temp
    lower = -2.0 - 1.5 * vpd_kpa   # fully watered baseline
    upper = 5.0                    # non-transpiring baseline
    return min(max((dt - lower) / (upper - lower), 0.0), 1.0)
