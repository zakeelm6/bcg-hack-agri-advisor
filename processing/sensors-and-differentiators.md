# Soil sensors, error control and differentiators (Farm Advisor)

Summary of the research chat pasted on 2026-10-16, with a status column and a list of claims still to verify.
Written to feed the sandbox / architecture work. Nothing here is built yet unless stated.

## 1. The one idea to keep

A soil sensor sees about one litre of soil. A hectare is 10,000 m2. So a sensor cannot draw a map of a plot.
Each source does what it is good at:

| Source | Answers | Why |
|---|---|---|
| Satellite (Sentinel-2, 10 m, every 5 days) | **Where** is the problem | Covers the whole plot for free. Greenness (NDVI) shows that something is wrong, not what. |
| Sentinel soil sensor | **When** and **how much** | Continuous in time (hourly), but one point. |
| Lab test or strips | **What** to add (N, P, K, pH) | Cheap NPK probes are not reliable enough. |
| Water balance (FAO-56) + rules | **Dose** | Code computes the numbers. |
| Language model | **Explains** | Never calculates. |

Consequence for the design: no "interpolate three sensors into a map" (kriging has nothing to work with at 2 or 3
points per village). Use stable zones, plus a temporal link between a sentinel sensor and each plot.

## 2. How a sensor can still help plots that have none (temporal stability)

Soil moisture patterns persist: a plot that is 4 points drier than the village sensor tends to stay about 4 points
drier. Measure that gap once during a short calibration, then:

`moisture of plot j (t) = moisture of the sentinel (t) + delta_j`

Rules for placing the sentinel (from the pasted research, to confirm): not on a hilltop or steep slope, not at the
plot edge, not in very sandy or very clayey spots, flat to gentle slope with medium clay. Pick the sentinel plot
that minimises the spread of `delta_j`.

## 3. Finding the affected part of a plot

1. Split the plot into stable management zones once per season (electrical conductivity survey or soil maps, slope,
   NDVI history).
2. Watch NDVI per zone over several dates. Flag a zone only when it stays abnormal over time (persistence removes
   clouds and noise). An unsupervised detector (Isolation Forest) or adaptive thresholds can do this.
3. The system says "this zone diverges", not why. The task becomes "Inspect here" plus a photo or a soil test.
4. The sentinel sensor and the water balance then say whether water is the likely cause.

## 4. Sensors: use, add, avoid

| Sensor | Role | Approx. price | Decision |
|---|---|---|---|
| Capacitive moisture (e.g. DFRobot SEN0193), 2 depths (15 and 30 cm) | Moisture for the water balance | ~5 EUR each | Use. Needs soil-specific calibration. |
| Soil temperature (DS18B20) | Germination, health check of the node | ~3 EUR | Use. |
| Soil water tension (Watermark 200SS) | Whether the plant can actually drink, mostly independent of soil type | ~30 to 40 EUR | Add. The neglected fundamental one. |
| Tipping-bucket rain gauge | Real rain, keeps the water balance from drifting | ~15 EUR | Add. Best value. |
| Leaf wetness | Fungal disease risk hours, makes advice preventive | ~25 EUR | Add if time. |
| Infrared canopy temperature (MLX90614) | Early water stress (crop water stress index) | ~8 EUR | Optional. |
| Low-cost NPK probe (JXCT, RS485 7-in-1) | n/a | ~30 EUR | **Do not use.** Not validated. Never state N, P or K from a sensor. |
| Electrical conductivity | Zone mapping, not nutrients | one-off survey | Survey once, not a permanent sensor. |

Node: ESP32 + LoRa, solar, about 130 EUR with the full set, shared per village. Gateway on a cooperative roof.

## 5. Preventing sensor errors

Rule: never delete a measurement, flag it. A flagged value does not enter a dose calculation but stays visible.

Hardware: pot the electronics in epoxy (or hot glue plus heat-shrink for a quick version) so moisture does not
corrode the board and cause slow drift; leave the sensing area uncovered. Pack soil tightly around the probe (an air
gap spoils the reading). Send battery voltage and signal strength in every message. Use two depths so they check
each other. Use a more expensive sealed sensor (e.g. METER TEROS) only for the village reference.

Software checks, from cheapest to most valuable:
1. Physical limits (moisture between 0 and about 0.6, soil temperature plausible).
2. Moisture rises with no rain in the last 24 h (cross-check with the weather API).
3. Moisture changes while soil temperature is below 0 C.
4. Signal shape: isolated spike, sudden jump, long constant high (flooded) or constant low (out of the ground, cut cable).
5. Deep sensor reacting before the shallow one after rain.
6. Sensor versus water-balance estimate (persistent gap means drift or unreported irrigation).
7. Sensor versus satellite (NDVI collapses while the sensor says wet: the cause is not water).
8. Predict each sentinel from the others; the one predicted badly is suspect.
9. Low confidence means no advice: show "soil test recommended" instead of guessing.
10. Audit log of measurements, flags, rule and confidence for every piece of advice.

## 6. Ideas that would differentiate the project

1. **Split-field trial.** Apply a recommendation on half the plot, leave the other half as usual. Compare mean NDVI
   of both halves over time: `delta(t) = NDVI treated - NDVI control`. Before the action, `delta` should be about
   zero (the halves were comparable). After, its sign is the effect: positive helped, flat did nothing, negative
   hurt. Split within one zone, ignore pixels within 10 to 20 m of the line, randomise which half is treated, and do
   not trial safety actions such as frost or pest warnings. One trial proves little; many across a network do.
2. **Learn the farmer's constraints.** When a farmer declines a task, ask why (money, product not available, labour,
   distrust) and use it in the next advice. Prefer plans he can afford to be wrong about.
3. **Aggregate village demand** (for example fertiliser needed in the same 10 days) for collective orders. Gives the
   cooperative a reason to adopt the platform.
4. **Pre-season decision** from the water stored in the soil at sowing (what to plant, how much).
5. **False start of season** (rain then a dry spell): "wait" or "sow now".
6. **Water rotation (tour d'eau).** Advise inside the farmer's turn, and order turns by need at cooperative level.
7. **Learn from the best local farmer** (satellite ranks plots; ask the top ones what they do).
8. **Be willing to recommend nothing** ("do not fertilise this week, rain will leach it").

Warning from the same chat: the deck already has many features. Pick one differentiator for the pitch
(the split-field trial is the cheapest and easiest to show).

## 7. How this compares with the current prototype (`backend` and `frontend`)

| Topic | Today |
|---|---|
| Moisture | Two **simulated** sensors. Zones without a sensor: learned offset `delta_j` from the farmer's soil samples (Phase 2), else the nearest-sensor estimate with lower confidence. |
| Satellite | Real Sentinel-2 NDVI per zone and per pixel; persistence-based anomaly detection on the pixels (Phase 2). |
| Sensor quality control | Items 1 to 5 of section 5 run on every reading (Phase 2); flagged readings are kept and shown, never used for a dose. |
| Water tension, rain gauge, leaf wetness | Not in the data model. |
| Split-field trial | Not built. |
| Soil tests | Typed by the user, change warnings, doses and confidence. |
| Good fit already | Code decides the numbers, the model only explains; confidence on every advice; "inspect here" task; honest real/simulated labels. |

Suggested order of work: (1) sensor quality flags (items 1 to 4 of section 5), (2) `delta_j` calibration replacing
nearest-sensor estimation, (3) NDVI persistence per zone, (4) split-field trial screen, (5) extra sensor types.

## 8. To verify before presenting (not checked by me)

All figures and citations below come from the pasted chat and were not independently verified:
- Calibration error ranges (RMSE 0.055 to 0.191 lab calibration versus 0.005 to 0.036 field calibration), the Ghana
  LoRa result (R2 0.92 to 0.94), the NPK probe evaluation on 28 soils, the temporal-stability R2 values.
- Prices and product names (SEN0193, Watermark 200SS, TEROS, Heltec V3, Dragino LPS8, RAK7268).
- Function names in `saqc` (the chat said `flagPlateau` and `flagSpikes`; check the real names in the saqc documentation,
  constants detection may be called something else).
- LoRa frequency: the chat mentions 433 MHz in Ghana. Check which band is legal and usable in Morocco.
- The Farmer.Chat randomised trial in Kenya, the EGU 2026 Isolation Forest paper, and how common the water
  rotation (tour d'eau) really is in the target region.
- The "no kriging" claim is reasonable for 2 to 3 points, but confirm with a variogram test if you get real data.
