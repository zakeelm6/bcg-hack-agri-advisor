# Farm Advisor

**An AI that reads your land and tells you what to do, when, and why. Then it follows up.**

BCG Platinion Hackathon 2026 - Fighting World Hunger - Team 2

> The default branch contains a deployable Next.js farmer interface plus standalone sensor and satellite-analysis
> libraries. It does not currently contain the FastAPI/SQLite product described in the longer-term architecture.

---

## The problem

Small farmers often decide by instinct: when to irrigate, how much fertilizer to apply, when to check a field.
A wrong call can cost a harvest, and the advice that exists is either general ("water your crops") or tied to
expensive equipment that smallholders cannot afford.

For scale, an FAO estimate from 2011 puts crop losses in Sub-Saharan Africa above 30% of production, mostly before
the produce leaves the farm. It is old data: read it as an order of magnitude, not a current figure.

## The idea

Farm Advisor combines what is already available for free or at low cost:

- **Satellite images** (Sentinel-2) for crop vigor, zone by zone;
- **Weather forecasts** (Open-Meteo);
- **A few shared soil sensors** per village, used as calibration points for the neighbours who have no sensor;
- **Soil tests** typed by the farmer from a lab report or their own sample;
- **Photos** of the land.

It then gives **one clear action at a time**, always with:

| | |
|---|---|
| **What** | for example "Irrigate zone D, 25 mm" |
| **When** | a precise window, set around the forecast |
| **Why** | one plain sentence with the numbers behind it |
| **Cost** | what it takes, for example pump time or kilos of fertilizer |
| **Confidence** | high, medium or low, with the reason, and what would raise it |
| **Plan B** | what to do if the farmer cannot follow the advice |

Then the farmer marks the task done, adds a photo and the result, and the next advice uses what really happened.

## How it works

```
 INPUTS                      SANDBOX (isolated, allow-listed tools)               OUTPUTS
 satellite images  ---+
 weather APIs      ---+--> Data agent --> Decision engine --> Safety check --> Task cards
 soil sensors      ---+          ^              ^   |              |  \         Map layers and alerts
 soil tests        ---+          |              |   |              |   \        Harvest forecast, sale offer
 photos ----> Vision agent ------+--------------+   |              |    +-----> Copilot in the app
 task results ---> Follow-up agent (updates confidence)             |           Advice in FR, darija, EN
 questions from the Copilot ---> Orchestrator                       +---------> Escalation, audit log
```

![Farm Advisor architecture: inputs, the sandbox with its agents, and outputs including the in-app Copilot](docs/architecture-diagram.png)

*Inputs on the left, the sandbox with its agents in the middle, outputs on the right. The Copilot is both an output (it receives the approved advice and reasons) and the source of the farmer's questions, which go back to the orchestrator.*

Design rules:

1. **Code decides the numbers, a language model only explains.** Doses, dates and quantities come from a tested
   rule engine (water balance, caps). A model never invents a number, and a check rejects any text containing a
   number that is not in the facts.
2. **Every piece of advice says how sure it is** and what would make it surer (a soil test, a sensor reading).
3. **A sandbox limits what agents can do:** allow-listed tools only, no secrets, limits on time and memory, and
   no direct write to the farmer's data. Agents return proposals, and only the safety check can approve them.
4. **Photos are described, never diagnosed.** The vision agent reports what is visible and what to check.
5. **Works offline.** Once opened, the website keeps working: data is cached on the device and actions are queued,
   then sent when the connection returns. Without any language model, the app still shows the engine's full advice.
6. **Honest labels.** Simulated data is labelled as simulated, in the app and here.

## Where the team's AI sits

| Agent | Job | Language model? |
|---|---|---|
| Orchestrator | Routes each request, stops loops | Small model or plain code |
| Data agent | Collects satellite, weather, sensors, soil tests and checks their quality | No |
| Vision agent | Describes a photo (visible symptoms, location, confidence) | Yes, multimodal |
| Decision engine | Computes what, when, how much, cost, confidence, plan B | No (rules, tested) |
| Safety check | Approves or rejects each proposal: caps, consistency, number check, escalation | No (code) |
| Explainer agent | Writes the advice in the farmer's language | Yes |
| Market agent | Harvest forecast and sale offers | Optional |
| Follow-up agent | Learns from results and photos, schedules the next check | Optional |

The in-app **Copilot** receives only the approved advice, the reasons and the facts behind them. It can explain,
simulate "what if I wait two days?" (by asking the engine again), translate, and ask for more data. It cannot change
a task or state a number that is not in the facts.

## Status: what is real, simulated and planned

| Part | Status |
|---|---|
| Responsive website (onboarding, My Farm, Co-Pilot, Activities) | **Built** in `frontend/` |
| English, French and Arabic interface with browser voice | **Built** |
| Satellite photo, field measurement and 3D terrain views | **Built** with Esri imagery, Leaflet and MapLibre |
| Weather forecast | **Real** through Open-Meteo, with a labelled fallback |
| Co-Pilot advice | **Simulated** by an in-browser keyword engine; the optional backend is not present |
| Farmer profile, tasks, activities and conversations | **Browser-local only** (`localStorage`) |
| Sensor quality, drift detection and village calibration | **Built as a standalone Python library**, 29 checks |
| Satellite indices, anomaly detection and management zones | **Built as a standalone Python library**, 39 checks using synthetic scenes |
| FastAPI API, database, authentication and durable sync | **Not present on the default branch** |
| Orchestrator, vision agent, explainer model and sandbox isolation | **Designed, not built** |

## Technology

- **Front end:** Next.js 16, React 19, TypeScript and Tailwind CSS
- **Maps:** Leaflet, MapLibre, Esri World Imagery and AWS/Mapzen terrain
- **Sensor and satellite analysis:** Python and NumPy libraries, not network services
- **Weather:** Open-Meteo (no account needed)
- **Deployment:** Docker on Azure Container Apps
- **Models (planned):** a hosted multimodal model online and the interface's local fallback when no model is available

## Next steps

1. Build the safety check on generated text and the explainer agent behind a swappable model interface.
2. Add the Copilot panel, starting with fixed questions ("Why?", "Plan B?", "When?").
3. Prove the sensor-calibration idea on public soil-moisture data.
4. French and darija interface and voice output.
5. Real buyers through a cooperative.

## Limits and disclaimer

This is a hackathon prototype. Data are partly simulated, thresholds are demo values and the harvest forecast is not
validated. **It is not agronomic advice for real fields.**

## Team

Team 2 - BCG Platinion Hackathon 2026.
