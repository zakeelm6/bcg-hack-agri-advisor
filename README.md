# Farm Advisor: final project

BCG Platinion Hackathon 2026, Fighting World Hunger, Team 2.
An AI that reads a small farmer's land (satellite, weather, shared soil sensors, soil tests, photos) and says what to do,
when, why, how much it costs, how sure it is and what the plan B is. Then it follows up. A voice Copilot explains it.

## The three layers

```
 FRONTEND  (what the farmer sees and hears)
   web app: land view, "do this now", tasks, follow-up, sell, voice Copilot, English / French / Arabic, offline
        |                      HTTP / JSON
 BACKEND   (FastAPI: API, data, security)
   routes, SQLite, offline sync, brakes (rate limits), audit log, voice routes, serves the web app
        |
 PROCESSING (the AI and internal treatment)
   rule engine (water balance, doses, caps) -> Copilot (explains, never invents a number) -> language model (optional)
   sensors quality and calibration, satellite zones, speech to text and text to speech
```

Where each part lives in the code:

| Layer | Folder | Main files |
|---|---|---|
| Frontend | [frontend/](frontend/) | `app.js`, `i18n.js`, `style.css`, `sw.js` |
| Backend | [backend/](backend/) | `app/api/routers/` (routes), `app/services/`, `app/db/` (models, migrations in `migrations/`), `app/schemas/`, `scripts/`, `tests/` |
| Processing | [backend/app/processing/](backend/app/processing/) and [processing/](processing/) | `engine.py` (decisions), `copilot.py`, `llm.py`, `speech.py`, `geo.py` (weather), `sensors/` (quality flags, learned offset), `satellite/` (anomaly detection, zones); the notes are in `processing/` and [docs/SENSORS.md](docs/SENSORS.md) |

![Architecture](processing/architecture-diagram.png)

## Run it

```bash
cd backend
./run.sh                 # creates .venv, installs dependencies, serves http://127.0.0.1:8000
python -m pytest -q      # 84 tests (activate .venv first)
```
Optional: copy `backend/.env.example` to `backend/.env` for a language model and for the Azure voice.

## Read next

| Document | What it explains |
|---|---|
| [ROADMAP.md](ROADMAP.md) | The steps to go forward: React frontend, backend framework, everything working together |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Phase 0: decisions, owners, working rules, checklist |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | The frozen API between frontend and backend (`backend/openapi.json`) |
| [processing/ai-and-internal-processing.md](processing/ai-and-internal-processing.md) | How the AI and the internal treatment work in a reference design (planning graph, daily loop, verifier) and what could be reused |
| [processing/VOICE.md](processing/VOICE.md) | How the Copilot talks and listens, setup, tests, limits |
| [processing/sensors-and-differentiators.md](processing/sensors-and-differentiators.md) | Which sensors, how to detect errors, ideas that differentiate the project |
| [backend/README.md](backend/README.md) | API, what is real and what is simulated, satellite data, Copilot |
| [docs/ux/CHANGELOG.md](docs/ux/CHANGELOG.md) | UX redesign and the October 2026 audit fixes, with before and after screenshots ([audit table](docs/ux/AUDIT-2026-10-16.md)) |
| [docs/prompts/](docs/prompts/) | Prompts used for the UX work in Cursor |
| [docs/reference/](docs/reference/) | The hackathon brief and a reference handoff note from another project |

## Honest status

Real: Sentinel-2 vigor per zone and per pixel for one parcel (18 dates), the anomaly detector on those pixels, Open-Meteo weather, the rule engine, the sensor quality checks, offline queue, GPS. 84 tests.
Simulated: the two soil-moisture sensors (their readings still go through the real quality checks), buyers and prices. Not validated: harvest forecast, rule thresholds (demo values), the detector's thresholds on other fields.
Not tested for real yet: a real language model, the Azure voice with a real key, a real microphone, a phone.
Tested for real on 17 Oct 2026: browser read-aloud in Google Chrome on Linux (English and French voices; no Arabic voice without Azure).
It is a hackathon prototype, not agronomic advice for real fields.

`_archive/` holds files that are not part of the project (loose images, an earlier copy of the README). Nothing in it is needed to run.
