# Sanabils (سنابل): technical structure, why each choice, and what comes next

BCG Platinion Hackathon 2026, Team 2. State on 17 October 2026, commit `832d931`.
This document is for the technical staff who will read, run, judge or continue the project: what the system is made of, why it was built this way, and what we would do next. For how to run it see `README.md`; for the API see `docs/API_CONTRACT.md`; for deployment see `docs/DEPLOY-AZURE.md` and `docs/CI-CD.md`.

---

## 1. What the product does, in one paragraph

Sanabils tells a small farmer in Morocco **what to do today, why, how sure we are, and the plan B**, in four languages (English, French, standard Arabic, Darija), by voice or by reading, on a cheap phone that is often offline. It reads the farmer's land (Sentinel-2 vigor, Open-Meteo weather, soil sensors when they exist, soil tests), produces a short list of tasks (water, feed, go look, harvest), follows up on them (done / can't / how does it look), and keeps every number honest: the rule engine decides, the language model only explains, and every piece of data is labelled real, simulated or not validated.

## 2. The shape of the system

```
                 phone / browser (PWA, offline copy, service worker)
                 ┌────────────────────────────────────────────────┐
                 │  Next.js 15 + React 19 + Tailwind 4            │
                 │  TanStack Query (reads cached in localStorage) │
                 │  simple mode (Today, My field, More)           │
                 │  full mode (Home, Field, Tasks, Sell, Alerts, Me)
                 └────────────────┬───────────────────────────────┘
                                  │ JSON over HTTPS, header X-Device
                 ┌────────────────▼───────────────────────────────┐
                 │  FastAPI (Python 3.12), 30 routes               │
                 │  api/routers  →  services  →  processing        │
                 │  SQLAlchemy 2 on SQLite (Postgres-ready)        │
                 └──┬──────────┬──────────┬──────────┬────────────┘
                    │          │          │          │
            Sentinel-2     Open-Meteo   Azure AI    optional LLM
            (Earth Search  (forecast,   Speech      (Anthropic / OpenAI-
             STAC, cached)  past 7 d)   (TTS+STT)    compatible / Ollama)
```

Two deployable units (API and web), each a Docker image, each an Azure Container App. Nothing else runs in the cloud: no queue, no cache server, no managed database yet.

## 3. Backend

### 3.1 Layout (`backend/app/`)

| Layer | Folder | Role | Rule |
|---|---|---|---|
| HTTP | `api/routers/` (state, tasks, farmer, field, copilot, voice, sync, market, places, activities, pages, health) | Parse the request, call one service, return a typed response | No business logic here |
| Services | `services/` (advice, field, farmer, season_service, tasks, sync, sensors, satellite_layer, copilot_service, chat, market, places, own_field, activities) | Load from the database, call the processing layer, persist, build the response objects | Owns the transaction; knows the models |
| Processing | `processing/` (engine, season, geo, llm, copilot, speech, `sensors/`, `satellite/`) | Pure functions: numbers in, decisions and texts out | **No database, no HTTP** (except `geo`, `speech`, `llm`, which wrap one external API each) |
| Data | `db/` (models, session, seed, scope) | 17 tables (Field, Zone, Sensor, Reading, Task, Alert, Observation, SoilTest, NdviObs, Farmer, Activity, Device, Listing, Offer, CopilotLog, Cache, PlotOffset) | SQLAlchemy 2 declarative; schema created at start-up, Alembic available |
| Contracts | `schemas/requests.py`, `schemas/responses.py` | Pydantic models for every body and every response | Exported to `openapi.json`, which generates the frontend types |
| Settings | `core/config.py` | Every tunable value, read from `FA_*` variables and `backend/.env` | No constants scattered in code |

### 3.2 The decision engine (`processing/engine.py`, `processing/season.py`)

- `estimate_moisture` combines sensor readings (with quality control from `sensors/qc.py`), manual readings, and, when the farmer has no sensors, a **rain / ET0 water balance** (`water_balance_moisture`, confidence Low). The choice is driven by the farmer's setup (`has_sensors`), not guessed.
- `build_advice` produces the tasks: irrigate (mm and pump minutes), fertilise (kg N/ha and sacks), inspect (satellite anomaly, sensor disagreement), harvest window. Every task carries `why`, `cost`, `confidence` (High / Medium / Low with the reason), `plan_b`, `when_text`.
- `season.py` builds the **season plan** from crop parameters and sowing date, **verifies** each task against today's data (`verify_task`: confirmed, adjusted, escalated) and writes the daily **briefing**.
- `what_if_wait` answers "what if I wait N days" with the same functions.
- All texts exist in the four languages inside the engine (`TEXTS[lang]`), so the API answers in the farmer's language without a model.

**Why a rule engine and not a model for the decision.** A farmer's water and fertiliser are money and yield. A rule engine is deterministic, testable (143 tests), explainable line by line, and runs on a 1-CPU container in milliseconds. A model would be none of these. The model is kept where it adds value: wording, conversation, photo description.

### 3.3 The language model, fenced (`processing/llm.py`, `processing/copilot.py`)

- Optional. Without a key the app uses the engine's own sentences; nothing degrades except conversational variety.
- Providers behind one interface: Anthropic, any OpenAI-compatible endpoint (including Azure OpenAI), Ollama for a fully local run.
- **Number check**: the model receives the facts as JSON and its answer is scanned; any number that is not in the facts (in any usual notation: 0.194, 19 %, 19.4) rejects the answer, and the engine's text is used instead. This is what makes "the code decides every number; the model only explains" a property of the system rather than a promise.
- Brakes (`core/ratelimit.py`): per-minute limits on copilot and voice calls, so a public URL cannot burn the keys.

### 3.4 Data sources and honesty

| Source | What | Real or not | Where |
|---|---|---|---|
| Sentinel-2 L2A via Element84 Earth Search (STAC, public COGs) | NDVI per zone, 5-day cadence, anomaly cells | **Real** for the demo field, cached in `backend/data/ndvi_cache.json` by `scripts/fetch_satellite.py` | `processing/satellite/`, `services/satellite_layer.py` |
| Open-Meteo | 7-day forecast, ET0, **past 7 days** (for the water balance) | **Real**, no key | `processing/geo.py` |
| Soil sensors | Moisture, temperature, with physics and QC | **Simulated** (`sensors/simulator.py`, a "sentinel node" model) unless the farmer declares sensors | `processing/sensors/` |
| Soil tests | N, P, K, pH entered by the farmer | Real when entered | `/api/soil-tests` |
| Prices and offers | Local market | **Not validated** | `services/market.py` |

Every response carries `data_notes`, and the UI shows the label (real / simulated / not validated) next to the data. Simulated data is never styled to look real.

### 3.5 Multi-tenant on one SQLite file (`db/scope.py`)

Each phone generates a random token stored in `localStorage` and sends it as `X-Device`. The server maps it to **one farmer, one field**: the demo field is cloned for a new device, so every visitor gets their own data without an account. `FA_REQUIRE_DEVICE=true` on the public server refuses requests without a token; `FA_MAX_DEVICES` and `FA_NEW_DEVICES_PER_MINUTE` cap abuse. This was the cheapest honest answer to "many people will open the public URL at the same time" without building login in a hackathon.

### 3.6 Offline writes (`/api/sync`)

The phone queues actions (task done, observation, farmer profile) in `localStorage` with a client id, and replays them in one `POST /api/sync` when back online. The server is idempotent on the client id. Reads are cached per path with their timestamp, so the app opens with yesterday's data and refreshes immediately when it can.

### 3.7 Voice (`processing/speech.py`, `/api/tts`, `/api/stt`)

Azure AI Speech (region France Central) for text-to-speech and speech-to-text in `en`, `fr`, `ar-MA`, and Darija approximated through `ar-MA`. The key lives only in `backend/.env` / a Container App secret; the browser never sees it. The browser's Web Speech API is the fallback when the server has no key. **Why server-side voice:** quality and consistency across cheap Android phones, Arabic voices that browsers do not ship, and one place to swap the provider.

### 3.8 Tests and contract

- `backend/tests/`: 16 files, **143 tests** (engine, season, layers, setup, devices, Darija texts, API, contract, speech, copilot). They use their own database.
- `openapi.json` is committed and regenerated by `scripts/export_openapi.py`; CI fails if the committed file differs from the code (API drift is caught before the frontend breaks). Changes must be additive.

## 4. Frontend

### 4.1 Stack and why

| Choice | Why |
|---|---|
| **Next.js 15 (App Router), React 19, TypeScript** | File-based routes, server render of the first paint, `output: "standalone"` for a small Docker image (88 MB compressed), strict types from the API contract |
| **Tailwind 4 with design tokens** (`app/globals.css`, `docs/DESIGN_SYSTEM.md`) | One place for colours, spacing, 48 px targets, dark mode and high contrast; logical CSS properties so RTL (Arabic, Darija) is designed, not patched |
| **TanStack Query 5** | Caching, retries, optimistic updates and background refresh of the API reads, with `localStorage` as the offline copy (`initialData` + `initialDataUpdatedAt`) |
| **No UI kit** | 48 px targets, RTL, high contrast and bilingual typography were simpler to own in ~15 small components (`components/ui/`) than to fight in a kit |
| **openapi-typescript** (`npm run types`) | `lib/api-types.d.ts` is generated from `backend/openapi.json`; a renamed field fails `tsc` instead of failing a farmer |
| **MapLibre GL + Leaflet (team's "find your field")** | Draw and measure the parcel on free OpenStreetMap tiles; kept from the team's earlier work |
| **Service worker** (`public/sw.js`) + manifest | Installable, opens offline, app icon |
| Fonts: Geist, Fraunces, Noto Naskh Arabic | Self-hosted with `next/font`; Naskh loaded only when Arabic or Darija is chosen |

### 4.2 Screens

- **`/`** landing: what it is, how it works, the AI inside, what is real, about; one "Go" action.
- **`/start`** onboarding: 8 questions (crop, sowing date, area, water, sensors, connection, ...) answered by voice (`lib/voiceAnswers.ts` matches spoken answers in four languages), by pictures, or by typing.
- **Simple mode (default)**: `/today` (the land with A/B/C/D, tap a zone to **hear what to do there**, one big card in plain words, Done / Can't, Speak, Listen to today, Call my advisor; no numbers, "See the numbers" one tap away), `/field`, and a More sheet.
- **Full mode**: Home, Field (layers: vigor, moisture, temperature, anomalies; soil line per zone), Tasks (detail, why, cost, confidence, plan B, what-if), Sell, Alerts, Me (profile, season plan, find your field on the map).
- **`/setup`**: sensors or satellite-only, connection mode, advisor phone, simple/full, look (theme), keep for offline.
- **`/design`**: the design system page, built only with `NEXT_PUBLIC_SHOW_DESIGN=1`.

### 4.3 Languages

`lib/i18n.ts` holds en / fr / ar as triplets; `lib/i18n-ary.ts` overrides 441 of 532 texts in Darija and falls back to standard Arabic for the rest. `node lib/i18n.check.mjs` fails the build if a Darija key does not exist or its `{placeholders}` differ from English. Arabic script sets `dir="rtl"`; layout uses `ms-/me-/ps-/pe-` and `text-start`, never left/right.

### 4.4 Plain words for farmers who read little (`lib/plain.ts`)

Tasks are rewritten without units ("Water zone D", "Feed the whole field"), grouped when the same action applies to several zones, and spoken with the engine's own reason. The exact figures remain one tap away. The voice path is Azure first, browser second (`lib/useVoice.ts`).

## 5. Infrastructure, delivery and operations

| Item | Choice | Why |
|---|---|---|
| Hosting | **Azure Container Apps** (API + web), **Azure Container Registry** | Scale-to-zero cost profile, HTTPS and a domain in one command, images tagged with the commit so Azure always says which code runs |
| Images | `backend/Dockerfile` (python-slim, uvicorn), `frontend/Dockerfile` (two-stage node:22-alpine, standalone server, `NEXT_PUBLIC_API_URL` baked at build) | Small, reproducible, no runtime secrets in the web image |
| Database | SQLite inside the API container (`FA_DB`), `FA_DATABASE_URL` ready for Postgres | Enough for a demo; see section 7 for the known limit |
| Secrets | Speech key as a Container App secret; nothing in Git, enforced by review | A leaked key is the fastest way to lose a hackathon budget |
| CI | GitHub Actions `backend` and `frontend` workflows: tests, contract diff, type check, Darija check, build | Green on `main` since the merge |
| CD | `.github/workflows/deploy.yml`: test, then OIDC login to Azure (no password stored), build both images, push, update both apps, verify Azure runs this commit, health check | Already trusted by Azure (identity `growmate-github`, environment `production`, 9 variables set). **Waits for one role assignment by a subscription Owner** (`scripts/azure-grant.sh`); until then `scripts/deploy-now.sh` does the same from a logged-in team account |
| Local run | `backend/run.sh`, `npm run build && next start`, or `docker compose` | Same code paths as production |

## 6. Justifications that were debated

1. **Rule engine first, model second.** See 3.2 and 3.3. Judges and agronomists can read every rule; a model could not be audited in the time we had, and a wrong litre count is a real loss for the farmer.
2. **Simple mode as the default.** Our target user reads little and uses a shared, cheap Android phone. Two tabs, pictures, voice and no numbers won over a dashboard; the full mode stays for the advisor and the demo.
3. **Darija as a first-class language**, not a dialect flag. It has its own table, its own tests, its own review document (`docs/DARIJA.md`), and its own voice path, because it is the language the farmer actually speaks.
4. **Honesty labels in the UI.** We show simulated sensors as simulated, satellite as real with its date, prices as not validated. It cost us some visual polish and gained trust with the people who tested it.
5. **One field per phone instead of login.** Login would have taken a day and a privacy review; a device token gives isolation for the demo and a clean path to accounts later (the token becomes a session).
6. **Server voice over browser voice.** Arabic voices on budget Android browsers were unreliable; Azure Speech gave the same voice everywhere and let us keep Darija approximate but usable.
7. **No UI kit, Tailwind tokens.** RTL, 48 px targets and a high-contrast theme were requirements, not nice-to-haves; owning 17 small components was cheaper than overriding a kit.
8. **Committed OpenAPI contract and generated types.** With two people working on the API and the UI at once, the contract diff in CI prevented every silent break after the first day.
9. **Images tagged with the commit, never `latest`.** Each deploy can be named, compared and rolled back with one command.
10. **Real Sentinel-2, cached.** Fetching from the public STAC at request time is slow and flaky; a script fetches and caches, the app reads the cache, and the UI shows the acquisition date.

## 7. Known limits (be honest about them in the demo)

- **Database in the container**: a redeploy or restart resets farmer data on Azure. Fix: Azure Database for PostgreSQL (one variable, `FA_DATABASE_URL`) or an Azure Files mount.
- **Darija** was written by the team and reviewed once by a native speaker; the speech recognition for Darija goes through `ar-MA` and is approximate.
- **Sensors are simulated** unless real hardware is connected; the water balance without sensors is marked Low confidence on purpose.
- **Prices** are illustrative.
- **The CD pipeline** is complete but blocked on one role assignment that only a subscription Owner can make.
- **No authentication**: the device token isolates data but does not identify a person; a lost phone is lost data.
- Lighthouse mobile on Home: 90 / 100 / 100 / 100; the land image and the map worker are the remaining weight.

## 8. Perspectives from the technical staff

### Next two weeks
1. **Postgres on Azure** and nightly backup; keep SQLite for local and tests.
2. **Phone number login (OTP by SMS)** on top of the device token, so a farmer can change phone; the advisor sees their farmers.
3. **Owner grants the role; CD goes live.** Add a staging Container App that deploys from `final-project`, production from `main` with a required reviewer.
4. **Playwright end-to-end tests** on the three farmer journeys (onboarding by voice, Today done/can't, offline then sync) in the four languages, run in CI against the built image.
5. **Native Darija review round 2** of the voice prompts and the engine texts, with recorded test phrases for the STT.

### Next quarter
6. **Real sensors**: LoRaWAN node (the `sensors/sentinel.py` model already defines the frames), MQTT ingestion into `/api/sensors/{id}/readings`, calibration per soil type.
7. **More crops and regions**: crop parameters are a table (`season.crop_params`); add wheat, olive, citrus with agronomist review, and soil maps for the water balance.
8. **Satellite pipeline as a job**: a scheduled Container App Job fetches Sentinel-2 for every registered field, not only the demo one; cloud masking with the SCL band; alerts when a zone falls behind.
9. **Advisor console**: a web view for the cooperative or the agronomist, listing their farmers' escalated tasks, with the same API and roles.
10. **Model evaluation harness**: a set of recorded questions with expected facts, run against the Copilot on each change, measuring the number-check rejection rate and answer quality per language.
11. **Observability**: structured logs with the device id hashed, Azure Monitor dashboards for API latency, voice call counts and the model brake.
12. **WhatsApp / SMS channel**: the briefing and the day's task by message for farmers who will not install an app; the engine and the texts already exist.

### Why we think this is the right base
The hard parts for the next team are not in the code we would throw away. The engine is pure and tested, the API contract is explicit and versioned, the UI is tokenised and RTL-native, the languages are tables with a check, the deployment is one commit-tagged image per service with a pipeline waiting for one click. What remains is agronomy (more crops, real sensors), identity (login), and scale (Postgres, jobs), each of which has a place reserved for it in the current structure.

---

## Appendix A. Repository map

```
backend/
  app/api/routers/      HTTP routes (thin)
  app/services/         use cases, persistence
  app/processing/       engine, season, satellite/, sensors/, geo, llm, copilot, speech
  app/db/               models, session, seed, device scope
  app/schemas/          request / response models (→ openapi.json)
  tests/                143 tests
  scripts/              export_openapi.py, fetch_satellite.py, simulate_sensors.py
  data/                 ndvi_cache.json, demo_land.*
  Dockerfile, run.sh, requirements.txt, openapi.json
frontend/
  app/                  routes: /, start, today, home, field, tasks, sell, alerts, me, setup, design
  components/           Copilot, Land, FieldFinder, SeasonPlan, ui/
  lib/                  api.ts (client, cache, queue), data.tsx (hooks), farm.tsx (store), i18n*.ts, plain.ts, useVoice.ts, voiceAnswers.ts
  public/               manifest.json, icon.svg, sw.js, images/
  Dockerfile
infra/github-oidc.bicep           the three role assignments for CD
scripts/                          deploy-now.sh, github-env.sh, azure-grant.sh
.github/workflows/                backend.yml, frontend.yml, deploy.yml
docs/                             API_CONTRACT, DESIGN_SYSTEM, DARIJA, DEPLOY-AZURE, CI-CD, SENSORS, DECISIONS, HANDOFF, ux/
ROADMAP.md, README.md
```

## Appendix B. Numbers worth quoting

- 30 API routes, 17 tables, 143 backend tests, 532 UI texts × 4 languages (441 Darija overrides).
- Latency measured locally: a full `/api/state` (engine + season + verification) in 8 ms warm, 80 ms cold.
- Images (compressed, in the registry): API 88 MB, web 88 MB; Container Apps cold start of a few seconds.
- Voice: Azure Speech, en/fr/ar/ary, TTS→STT round trip verified in en, fr, ar.
- Lighthouse mobile (Home): Performance 90, Accessibility 100, Best practices 100, SEO 100.
