# Farm Advisor — Sensor Specification

**Team 2 — BCG Platinion Hackathon 2026**
Sentinel node hardware, measurement rationale, and what we deliberately do not measure.

---

## Design principle

> A sensor is not a mapping instrument. It is a **temporal calibration instrument**.

A buried probe senses roughly one litre of soil. A one-hectare plot is 10,000 m². No realistic number of sensors covers a field.

So each data source does only what it is good at:

| Source | Answers | Resolution |
|---|---|---|
| Sentinel-2 satellite | **where** the problem is | 10 m, every 5 days |
| Ground sensors | **when** and **how much** it changes | one point, every 15 min |
| Laboratory / field tests | **what** chemically | one sample, once a season |
| Agronomic model | **what to do** | per management zone |

We never ask a sensor to answer a question from another row.

---

## 1. Sentinel node — bill of materials

One node is shared per village or per management zone, not per farm.

| # | Component | Part | Measures | Unit price |
|---|---|---|---|---|
| 1 | Soil moisture (shallow) | DFRobot **SEN0193** @ 15 cm | Volumetric water content | €5 |
| 2 | Soil moisture (deep) | DFRobot **SEN0193** @ 30 cm | Volumetric water content | €5 |
| 3 | Soil temperature (shallow) | **DS18B20** @ 5 cm | Temperature | €3 |
| 4 | Soil temperature (deep) | **DS18B20** @ 30 cm | Temperature | €3 |
| 5 | Soil tension ×2 | **Watermark 200SS** @ 15 / 30 cm | Matric potential (kPa) | €70 |
| 6 | Canopy temperature | **MLX90614** (IR, non-contact) | Leaf-minus-air temperature | €8 |
| 7 | Leaf wetness | Leaf wetness sensor | Hours of leaf surface wetness | €25 |
| 8 | Rainfall | Tipping-bucket rain gauge | mm, locally measured | €15 |
| 9 | MCU + radio | **Heltec WiFi LoRa 32 V3** (ESP32 + SX1262) | — | €20 |
| 10 | Power | 2 W solar panel + TP4056 + 18650 cell | — | €8 |

**Node total ≈ €160**, shared across a village.

**Gateway:** Dragino LPS8 or RAK7268 (8-channel LoRaWAN), mounted on the cooperative roof.
Network server: ChirpStack or The Things Network. Gateway ≈ €150, serves 5–50 nodes.

---

## 2. What each sensor is actually for

### 2.1 Soil moisture — SEN0193 (capacitive, FDR)

Measures the **dielectric permittivity** of the soil, not water directly. Water has a permittivity near 80; dry soil 3–5. The sensor infers water content from that contrast.

**Critical: the response depends on soil texture.** Published calibration results:

| Calibration strategy | RMSE (m³/m³) |
|---|---|
| Lab calibration applied directly in field | 0.055 – 0.191 ❌ unusable |
| Soil-specific **field** calibration | 0.005 – 0.036 ✅ |
| Simplified **one-point** calibration | 0.006 – 0.078 ✅ |

One-point calibration gives most of the benefit for a fraction of the effort. This is the same logic as our shared-sentinel architecture, applied at the sensor level.

**Known limits:** degraded accuracy in saline soils and near saturation; sensor-to-sensor variability; drift from moisture ingress (see §4).

### 2.2 Soil temperature — DS18B20

The only sensor in the kit that effectively cannot lie. Digital, factory-calibrated, sealed stainless probe, no drift, no calibration required.

Three jobs:
1. **Growing degree-days** → crop growth stage, which drives every timed recommendation.
2. **Germination and frost risk.**
3. **Virtual moisture sensor** (see §3) — a drift-free cross-check on the capacitive probes.

### 2.3 Soil tension — Watermark 200SS

The most important sensor in the kit, and the one usually missing from these projects.

Moisture content tells you *how much water is present*. Tension tells you *how hard the plant must pull to get it*. These are not the same:

- 18% water in **sand** → water is free, the plant drinks easily
- 18% water in **clay** → water is bound to particles, the plant is starving

Tension (kPa) is **largely soil-independent**: "irrigate at −50 kPa" is a valid instruction in sand and in clay. It removes the texture-calibration problem physically rather than statistically.

No battery, no maintenance, lasts years. Read with AC excitation from the ESP32 to prevent electrolysis of the gypsum block.

> *"Others measure how much water is there. We measure whether the plant can drink it."*

### 2.4 Canopy temperature — MLX90614

Non-contact infrared thermometer. A well-watered plant transpires and runs cool; a stressed plant closes its stomata and heats up.

$$\text{CWSI} \propto T_{\text{canopy}} - T_{\text{air}}$$

This is the Crop Water Stress Index, established since the 1980s. Decisive advantage: **the plant reports stress before the soil looks dry and before NDVI moves.**

### 2.5 Leaf wetness

Fungal disease is not triggered by rain — it is triggered by a number of hours of leaf wetness at a given temperature. Those risk models are decades old and reliable, and almost nobody measures the input for smallholders.

This is what moves the platform from **curative** to **preventive**: warn three days before symptoms appear.

### 2.6 Rain gauge

The cheapest high-value sensor in the kit. Gridded forecasts are poor at convective rainfall, which is intensely local in semi-arid climates. Without a local measurement, the FAO-56 water balance drifts within two weeks.

**Design rule:** use the free model for everything, and buy a sensor only for the term the model gets wrong locally.

---

## 3. Virtual sensors — replacing expensive hardware with physics

Rather than buying an instrument that measures the target quantity, measure something cheap that the target quantity visibly changes, then invert the physics.

### 3.1 Soil moisture from two thermometers

Wet soil stores heat; dry soil does not. The daily surface temperature wave propagates downward, and both its **damping** and its **phase lag** depend on water content.

$$\frac{A_{z_2}}{A_{z_1}} = e^{-(z_2 - z_1)/d}, \qquad d = \sqrt{\frac{2\kappa}{\omega}}$$

where $d$ is the damping depth, $\omega$ the diurnal angular frequency, and $\kappa$ the thermal diffusivity — a known function of water content for a given texture and bulk density.

Measure the damping between the 5 cm and 30 cm probes, solve for $\kappa$, recover moisture.

| | SEN0193 capacitive | 2 × DS18B20 |
|---|---|---|
| Cost | €10 | €6 |
| Drifts over time | yes, significantly | no |
| Corrodes | yes | sealed probe |
| Soil-specific calibration | mandatory | texture from maps |
| Fails silently | yes | essentially never |

**We run both.** The capacitive probe gives a fast direct reading; the thermal method gives an independent, drift-free reference. Divergence between the two *is* our sensor-fault detector.

### 3.2 Other substitutions in the design

| Expensive instrument | Our substitute | Why it works |
|---|---|---|
| Moisture probe (€200) | 2 × DS18B20 (€6) | thermal damping ∝ water content |
| Thermal camera (€3,000) | MLX90614 (€8) | we need a mean, not an image |
| SPAD chlorophyll meter (€2,000) | printed colour card + phone photo (€0) | a reference patch fixes white balance |
| Weather station (€1,000) | Open-Meteo API + rain gauge (€15) | buy only the local term |
| Grain quality grading | phone photo + OpenCV (€0) | defects are geometry and colour |

> *"We didn't make sensors cheaper. We stopped measuring the quantity and started measuring its shadow."*

---

## 4. Hardware reliability

| Failure mode | Mitigation |
|---|---|
| Moisture ingress → trace corrosion → silent calibration drift | **Epoxy-pot** the upper board; never cover the two sensing pads |
| Air gap around the probe → false readings | Tamp and grout the installation hole with slurry of the same soil |
| Battery sag → analog reading drift before node death | Transmit battery voltage and RSSI in every frame |
| One depth fails undetected | Two depths cross-check: the 30 cm probe **cannot** respond to rain before the 5 cm probe |
| Whole node dies | DS18B20 responding while moisture reads flat ⇒ the moisture sensor is dead, not the node |

**Sensor placement rule.** The sentinel point must be representative, or the offset model collapses. Hilltops and steep slopes systematically **underestimate** field-mean moisture; sandy spots underestimate, clay spots overestimate. Place on a **gentle slope with texture close to the field mean**, and never at a field boundary — an edge sensor wastes half its information radius.

---

## 5. From one sensor to a whole village

**Temporal stability.** The spatial pattern of soil moisture persists even as absolute values change. A well-chosen point tracks the area mean with R² of 0.96–0.998 and RMSE of 0.12–0.81 % vol/vol.

So each plot is served by the sentinel plus a learned offset:

$$\theta_{\text{zone } j}(t) \approx \theta_{\text{sentinel}}(t) + \delta_j$$

where $\delta_j$ is the m  ean relative difference, learned during a short calibration campaign. The sentinel is chosen by minimising the standard deviation of that relative difference.

**Result: a farmer with zero hardware still receives a plot-specific number.**

Management zones themselves come from ECa, slope and NDVI history clustered with fuzzy c-means — computed once per season, not from the sensors.

---

## 6. Data quality control

No measurement enters a dose calculation without passing QC. We follow the **ISMN** convention: *never delete a reading — flag it.*

| Check | Rule | Catches |
|---|---|---|
| Physical bounds | 0 ≤ θ ≤ 0.6 m³/m³; −60 °C ≤ T ≤ 60 °C | wiring faults, ADC errors |
| Saturation bound | θ > soil saturation point | flooded or failed probe |
| Rain consistency | moisture rises with **no rainfall in prior 24 h** | drift, parasitic signal |
| Frozen-soil consistency | moisture varies while soil T < 0 °C | physically impossible |
| Spike | isolated peak in the 2nd derivative | electrical noise, bad contact |
| Jump | step change in the series | probe moved or dug up |
| Saturated plateau | constant high value ≥ 12 h | drowned probe |
| Low constant | constant low value ≥ 12 h | probe out of soil, cut cable |

**Library:** [`saqc`](https://git.ufz.de/rdm-software/saqc) (UFZ) implements the spike, plateau and break detectors directly from the ISMN methodology. We call it rather than reimplementing it.

**Escalation rule:** if every sensor serving a zone is flagged, the platform reports *insufficient confidence* and recommends a soil test. **It does not guess a dose.**

---

## 7. What we deliberately do NOT measure with sensors

### 7.1 NPK — no sensor, ever

Cheap electrochemical NPK probes are not validated. Evaluated against laboratory methods across 28 soils: pH showed only moderate correlation, measured moisture had no linear relationship with the reference, and the device **did not demonstrate sufficient accuracy to replace conventional laboratory methods** for fertility assessment.

The price gap is structural, not incremental: dedicated nutrient probes cost **$1,000–5,000** versus **$50–200** for a basic soil sensor. There is no reliable middle tier. Either go to the laboratory or do not measure.

**Our rule: no nutrient figure is ever displayed from a sensor reading.** N, P and K come from laboratory analysis plus SoilGrids / iSDAsoil maps.

### 7.2 pH and carbonate — field test, not a buried probe

These are soil *properties*, not *states*. They barely change over years, so streaming them is pointless.

- **Carbonate:** the fizz test. A few drops of dilute HCl on a soil sample. Effervescence grades as none / slight / moderate / strong. Ten seconds, essentially free.
- **pH:** a €20 calibrated pH pen on a 1:2.5 soil-to-water slurry — close to the laboratory procedure. Calibrate with pH 4 and 7 buffer sachets.

**Zinc availability rule** (derived, not sensed):

```python
def is_zinc_limited(ph, fizz):      # fizz: 0 none, 1 slight, 2 moderate, 3 strong
    if ph > 7.5 and fizz >= 2:
        return "deficient"
    if ph > 7.5:
        return "uncertain"          # recommend a lab DTPA test
    return "sufficient"
```

High pH plus free calcium carbonate locks zinc away from the plant even when it is physically present in the soil. There is no viable in-situ zinc sensor — we infer availability from chemistry we *can* measure cheaply.

### 7.3 Spatial coverage — satellite, not sensors

Within-field variability is detected from Sentinel-2 NDVI using dynamic per-field thresholds and persistence filtering across multiple dates. NDVI localises a problem; it does **not** diagnose its cause.

**No IDW. No kriging on 2–3 points.** With a handful of sensors per village there is not enough data to estimate a variogram. Spatial structure comes from zones; temporal dynamics come from the sentinel.

---

## 8. Tiered deployment — the system degrades gracefully

| Level | Available data | Cost | Advice confidence |
|---|---|---|---|
| **0** | GPS, Open-Meteo, SoilGrids / iSDAsoil, Sentinel-2, farmer's voice replies and photos | ≈ €0 | Low — regional defaults |
| **1** | + pH pen, fizz test, lab soil analysis | low, one-off | Medium — plot-specific |
| **2** | + shared sentinel node over LoRaWAN | shared per village | High — continuous and local |
| **3** | + harvest grain analysis | one sample/season | Verified — outcome measured |

**A farmer with no hardware still gets a recommendation on day one.** Hardware improves confidence; it is never a prerequisite.

---

## 9. Network

- **LoRa range:** 1–5 km in open farmland; 500 m – 2 km through dense vegetation; 5–15 km line-of-sight with an elevated antenna.
- **Antenna height:** every 6 m of additional height roughly doubles effective range on flat terrain.
- **Capacity:** 5–50 nodes per gateway in practice; an 8-channel gateway handles far more at low duty cycle.
- **Transmission interval:** 15 minutes. Soil moisture is slow; faster sampling buys nothing and costs battery.
- **Offline-first:** the gateway runs a local network server so the system keeps functioning without internet.

---

## 10. Summary

```
LAYER            MEASURES              INSTRUMENT             COST
──────────────────────────────────────────────────────────────────
Space            where                 Sentinel-2             free
Time             when / how much       sentinel node          shared
Chemistry        what                  lab + pH pen + HCl     one-off
Decision         what to do            FAO-56 + QUEFTS        code
Language         how to say it         LLM                    per call
──────────────────────────────────────────────────────────────────
```

**Three rules that govern every sensor decision in this project:**

1. **Continuous sensors for what changes. One-off field tests for what doesn't. Laboratory for what neither can see.**
2. **No number shown to a farmer comes from an unvalidated sensor, and no dose comes from a language model.**
3. **A suspect sensor does not produce a bad recommendation — it produces a request for verification.**

---

## References

- [Field Performance and Calibration Strategies for Low-Cost Capacitive Soil Moisture Sensors](https://lup.lub.lu.se/record/15fe8ddb-e3d2-4f54-bd30-f915bfc798b9)
- [Calibration of an Arduino-based low-cost capacitive soil moisture sensor](https://reference-global.com/article/10.2478/johh-2022-0014)
- [Soil-Specific Calibration and Solar-Powered Sensor Node, Ghana (LoRaWAN field deployment)](https://www.citedrive.com/en/discovery/soil-specific-calibration-and-integration-of-low-cost-capacitive-soil-moisture-sensors-into-a-solar-powered-sensor-node/)
- [Avaliação de um sensor NPK de baixo custo — 28 soils vs laboratory methods](https://locus.ufv.br/items/e9a8cd7b-0f73-45b8-b566-9eea3bd55e32)
- [In Situ Soil Moisture Sensors in Undisturbed Soils — sensing volume](https://www.jove.com/t/64498/in-situ-soil-moisture-sensors-in-undisturbed-soils)
- [Penetration Depth of a Soil Moisture Profile Probe](https://depositonce.tu-berlin.de/bitstream/11303/10610/1/sensors-19-05485.pdf)
- [Temporal stability of surface soil moisture (Zhang & Shao)](https://agris.fao.org/search/en/records/65dfcf6f63b8185d9caf1a09)
- [SMEX02: Field scale variability and time stability of soil moisture](https://scholars.unh.edu/faculty_pubs/611)
- [ISMN quality flags — methodology overview](https://ismn.bafg.de/data/flag-overview)
- [Xaver (2015), Automated quality control procedures for the ISMN](https://repositum.tuwien.at/handle/20.500.12708/14884?mode=full)
- [saqc — implemented QC functions (UFZ)](https://git.ufz.de/rdm-software/saqc)
- [Unsupervised detection of crop stress using Sentinel-2 and Isolation Forest (EGU 2026)](https://meetingorganizer.copernicus.org/EGU26/EGU26-6052.html)
- [IoT LoRaWAN Soil Sensors for Agricultural Monitoring — ranges and nutrient probe costs](https://industrialmonitordirect.com/blogs/knowledgebase/iot-lorawan-soil-sensors-for-agricultural-monitoring)
- [LoRa farm sensor network — range and deployment](https://zbotic.in/lora-farm-sensor-network-wide-area-coverage-on-budget/)
