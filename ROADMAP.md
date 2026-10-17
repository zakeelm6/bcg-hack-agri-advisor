# Roadmap: React frontend, framework backend, everything working together

Written after reviewing the local `finalproject/` folder and the GitHub repo `zakeelm6/bcg-hack-agri-advisor` (branch `main`,
plus the branch `add-frontend2`). Effort is given as S (hours), M (about a day), L (several days).

## 1. Where we are

### What exists, and where

| Piece | Where | State |
|---|---|---|
| Working web app (plain JavaScript) | `frontend-legacy/` here, `frontend2/` on branch `add-frontend2` | Most complete UI: land picture with zones, "do this now", tasks and follow-up with undo, alerts, sell, soil tests, GPS, offline queue, voice Copilot, English / French / Arabic, accessibility pass |
| Decision engine, Copilot, voice, API | `backend/` here, `frontend2/app` on `add-frontend2` | FastAPI + SQLite. Rule engine (water balance, doses, caps), Copilot with number check, optional language model, Azure voice with browser fallback. 50 tests |
| Next.js app "growmate" (3zden) | `frontend/` on `main` | React 19, Next 15, Tailwind 4, TypeScript. Onboarding (picture choices for low literacy), My Farm, Co-Pilot, Activities. Three languages (`lib/i18n.ts`), voice in the browser (`lib/voice.ts`), Dockerfile |
| Sensor layer (Meryy4) | `sensors/`, `docs/SENSORS.md`, `test_sensors.py` on `main` | Simulator, quality checks (bounds, spikes, jumps, plateaus, rain consistency, frozen soil, depth order), drift detection against a water balance, sentinel selection and learned offset per plot |
| Satellite layer (Meryy4) | `satellite/`, `test_satellite.py` on `main` | Indices (NDVI, NDRE, NDWI, SAVI), anomaly detection with a learned baseline, management zones, GeoJSON output |
| Notes | `processing/`, `docs/` here | Voice, sensors, AI processing of a reference design, UX changelog |

Roughly 3,000 lines of Python in `sensors/` and `satellite/` are tested but **not connected to any API**. The Next.js app is **not
connected to the engine** (its Copilot is a keyword mock, and `NEXT_PUBLIC_API_URL` expects a `/chat` route that does not exist).

### Overlaps and conflicts to resolve

| Topic | Two versions | Decision proposed |
|---|---|---|
| Frontend | Vanilla JS app and Next.js app | One React app, based on Next.js (section 2) |
| Translations | `i18n.js` (about 150 entries plus patterns) and `i18n.ts` (221 lines) | Keep `i18n.ts`, port the missing entries and the Arabic right-to-left rules |
| Voice | Mine: Azure server voice, browser fallback, talk mode, commands. Theirs: browser only | Port mine into a React hook, keep theirs as the fallback |
| Sensors | `scripts/simulate_sensors.py` and `sensors/simulator.py` | Use `sensors/` (quality checks and offset), retire the script |
| Satellite | Real Sentinel-2 download (`scripts/fetch_satellite.py`) and `satellite/` (synthetic data, anomaly detection) | Keep the real download as the data source, feed it to `satellite/` for anomalies and zones |
| Copilot | Keyword mock and engine-based Copilot | The engine-based one, behind an adapter that matches the React app's contract |
| Repo layout | `sensors/`, `satellite/` at the root; `frontend/` is Next.js | One layout, see section 3 |

### Gaps nobody has covered

No login, no database migrations, SQLite only, no continuous integration, no end-to-end tests, no written API contract, no farmer
profile form feeding the engine, no real sensor ingestion path, the language model and the Azure voice never run for real,
no deployment.

## 2. Target

**Frontend: React.** Keep the team's choice: Next.js 15 (App Router), React 19, TypeScript, Tailwind 4. Used mostly as a single-page
app. Add: a typed API client generated from the backend's OpenAPI file (`openapi-typescript`), TanStack Query for data and cache,
a service worker and an IndexedDB queue for offline (replacing my hand-written `sw.js` and `localStorage` queue), a `useVoice` hook,
the land view as an SVG over the Sentinel-2 picture.

**Backend: FastAPI, restructured.** FastAPI is already a framework (typed routes, validation, OpenAPI), so keep it and give it a
proper structure instead of one big `main.py`. If you meant another framework (Django, NestJS), say so before Phase 1: it changes the plan.

```
backend/app/
  api/          routers: state, tasks, soil, copilot, voice, sync, sensors, auth
  core/         settings (pydantic-settings), security, rate limits
  db/           SQLAlchemy 2 models, Alembic migrations (SQLite in dev, PostgreSQL in production)
  schemas/      Pydantic request and response models (the API contract)
  services/     use cases: refresh advice, record a reading, answer a question
  processing/   engine, copilot, llm, speech, sensors (quality, offset), satellite (anomalies, zones)
```
Add: login with roles (farmer, cooperative agent), background jobs for the daily refresh and the satellite download,
a device key per sensor node for readings, and LangGraph only if and when the agent sandbox is built (rule engine stays the source of numbers).

**Rule that does not change:** code decides every number, the model only explains, any model text with a number not in the facts is rejected.

## 3. Repository layout to aim for

```
bcg-hack-agri-advisor/
  frontend/     React app (Next.js)
  backend/      FastAPI app, with processing/ modules inside (sensors, satellite moved here)
  docs/         architecture diagram, SENSORS.md, VOICE.md, processing notes, UX
  README.md
```
The current vanilla app stays in `frontend-legacy/` until the React app reaches feature parity, then it is deleted.

## 4. Steps

### Phase 0: align (S) - done locally, team OK pending (see [docs/DECISIONS.md](docs/DECISIONS.md) and [docs/API_CONTRACT.md](docs/API_CONTRACT.md))
1. Agree on this plan and on the layout above. Freeze the API contract for Phase 3 (the endpoints already used by the web app).
2. Choose owners (proposal in section 6). Create a branch per phase and merge by pull request.
3. Decide the open questions in section 7.

### Phase 1: backend foundation (M) - done and tested locally (61 tests)
1. Split `main.py` into routers, services and settings. Keep every test green. **Done:** `app/api/routers/`, `app/services/`, `app/core/config.py` (settings), `app/schemas/`, `app/processing/`.
2. Add SQLAlchemy models and Alembic migrations. Keep SQLite in development. **Done:** models, baseline migration `0001`, an old database is adopted on start-up, `FA_DATABASE_URL` for another database (only SQLite is tested).
3. Export `openapi.json` in CI; add CORS for the Next.js dev server. **Done:** `.github/workflows/backend.yml` runs the tests and fails if `openapi.json` is stale; CORS for `localhost:3000`; every response is now typed in the contract.
4. **Bridge for the existing React app (S), built, not used by our frontend:** add `POST /api/chat` that accepts `{question, photo, context}` and returns `{recommendation, why, steps, missing}` built from the engine and the Copilot. This connects the Next.js app to real advice without waiting for the rewrite.
5. Done when: the backend is layered, migrated, typed and tested. The legacy frontend was checked against it in a browser (screens, Copilot, tasks, soil test, offline replay, no console errors). The Next.js app was **not** wired to it: the frontend that matters here is ours.

### Phase 1b: UX audit and fixes on the legacy app (S) - done, branch `phase2/ux-fixes`
Audit of every screen in three languages at 390 and 1440 px, then fixes: keyboard access, 48 px targets, land pins, voice
states, honest labels, offline banner, Sell value computed on the server. See [docs/ux/AUDIT-2026-10-16.md](docs/ux/AUDIT-2026-10-16.md)
and [docs/ux/CHANGELOG.md](docs/ux/CHANGELOG.md). Open: real phone and microphone, Arabic voice (needs Azure).

### Phase 2: connect the sensor and satellite layers (M to L) - done locally, branch `phase2/ux-fixes` (84 tests)
1. ~~Move `sensors/` and `satellite/` into `backend/app/processing/`, keep their tests.~~ **Done:** pulled from GitHub `main`, their 16 tests run under pytest (`tests/test_sensors_layer.py`, `tests/test_satellite_layer.py`). `docs/SENSORS.md` moved too.
2. ~~Store sensor readings with quality flags.~~ **Done:** `readings.flags` (migration `0002`), the ISMN checks run on every ingest over the last 200 readings (`services/sensors.py`); a reading is never deleted; a sensor whose last 5 readings are mostly flagged is "low" or "insufficient" and gives no number to the engine. Irrigation reported in a follow-up counts as water arriving for the rain-consistency check.
3. ~~Replace the nearest-sensor estimate with the learned offset.~~ **Done:** `plot_offsets` learned from the farmer's soil-sample moistures paired with the nearest shared sensor (within 12 h); used after 3 samples, High confidence when the spread is under 0.03 and 5 samples or more; the nearest-sensor guess stays as the fallback and says so.
4. ~~Feed the real Sentinel-2 series into the anomaly detector.~~ **Done:** `scripts/fetch_satellite.py` now saves the per-pixel NDVI (16 x 16, 18 dates for the demo parcel); `services/satellite_layer.py` runs the detector (baseline from 4 early passes, persistence 3). On the real data it finds one patch in zone D (40 pixels, 0.375 ha, 4 passes, high). The engine turns it into "Inspect zone D" pinned at the centroid; `GET /api/zones/anomalies` serves the GeoJSON; the land view draws the cells.
5. ~~Cross-layer tests.~~ **Done:** `tests/test_layers.py` (7 tests): flagged sensor -> no dose, Low, "Sensor unreliable" alert; a sample beats the flagged sensor; offsets; anomaly task; the same through the API.
6. Done when: with a faulty simulated sensor the app says it cannot be sure and shows why (**yes**: moisture "?", Low, reason with the flag codes, red "!" on the map), and with an anomaly it points to the zone (**yes**). Open: the soil texture of the node is assumed loam; the sentinel is the nearest sensor (not `choose_sentinel`, which needs 20 aligned pairs); flag codes are shown raw (C02, D06) next to the explanation.

### Phase 3: React frontend (L) - built locally, branch `phase2/ux-fixes`; parity checklist in [docs/PARITY.md](docs/PARITY.md)
Built on the team's Next.js app (onboarding, `i18n.ts`, `farm.tsx` kept; My Farm, Co-Pilot and Activities moved to `frontend/_archive-team/`).
The legacy app moved to `frontend-legacy/` and is still served by the API at `/`.
1. ~~Shell~~ **Done:** typed client generated from `openapi.json` (`npm run types`), TanStack Query, language switch with RTL, six-tab navigation, onboarding as the first screen (skippable).
2. ~~Home~~ **Done:** land view as an SVG over the Sentinel-2 picture (zones, layers, pins, sensors, anomaly cells, honest labels), "do this now", Copilot docked.
3. ~~Tasks, task detail, follow-up~~ **Done** with confidence, plan B, undo, reasons for "cannot do it", photo notes.
4. ~~Field~~ **Done:** weather, soil test form, vigor chart. GPS and walking the field edge: **open** (legacy About page only).
5. ~~Alerts and Sell~~ **Done** (server-computed values, confirm before accept).
6. Farmer profile saved to the backend and used by the engine: **open** (needs the `/api/farmer` contract addition; the answers stay on the phone).
7. ~~Offline~~ **Done** with a service worker and a localStorage queue replayed through `/api/sync`; IndexedDB **open**.
8. ~~Voice~~ **Done in code:** `useVoice` (Azure first, browser fallback, adaptive loudness, every state visible, talk mode, commands). **Not verified** with a microphone or an Azure key.
9. Accessibility and UX pass: measured at 390 and 1440 px in three languages: no overflow, no target under 44 px, no console error (`docs/ux/2026-10-17-react/`). Screen reader and real phone: **open**.
10. Parity checklist: written, 3 rows open; the legacy app stays.

### Phase 4: farmer profile and season plan (M to L) - done locally, branch `ux/pro-polish` (99 tests)
Transposed from `processing/ai-and-internal-processing.md` without the simulator, all in deterministic code (`backend/app/processing/season.py`):
1. **Missing questions**: `GET /api/farmer` lists what the farmer has not answered (`needs_input`, in the four languages) and what the plan
   assumes instead (`assumptions`). Home shows a quiet "To sharpen the advice" card that reopens the onboarding.
2. **Season plan** (`GET /api/season`): crop stages from the sowing date (FAO-56-style Kc, demo cycle lengths), irrigation depth and rhythm
   per stage from a reference ET0 climatology and the watering method, nitrogen splits that sum to the season total (adjusted by the
   soil test), inspections every 10 days, the harvest window. Shown on Field as a timeline with the assumptions behind it. Labelled demo.
3. **Verifier per task**: every engine task is re-checked independently (`verify_status`: verified / fixed / escalated, with the reason).
   An escalated task is never hidden: it keeps its place with "Ask your advisor" and no amber Done.
4. **Daily briefing** (`GET /api/briefing`): one paragraph (stage, today's tasks, weather, next planned step, escalations) in the four
   languages; shown on Home and read by the Copilot for "Read my tasks" when online (saved tasks offline).
Not done: RAG with citations, the farm simulator and the Monte Carlo judge (excluded by design).

### Phase 5: agent sandbox (optional, L)
Orchestrator, safety check, explainer and follow-up agents as LangGraph nodes, with allow-listed tools, no secrets, time and memory limits,
and "approved advice only" going to the Copilot, as in the architecture diagram. Test the model path with a real key before claiming it.

### Phase 6: deploy on Azure (M)
1. Two containers (React app and API) on Azure Container Apps, PostgreSQL flexible server, secrets in Key Vault, Azure AI Speech for voice, Azure OpenAI optional.
2. Turn authentication on before anything is public. HTTPS only (needed for GPS, microphone and the service worker).
3. GitHub Actions: tests, build, deploy on merge. Separate development and demo environments.
4. Done when: the whole demo runs from a phone on the public URL.

### Phase 7: harden and rehearse (M)
1. End-to-end tests (Playwright) for the flows in section 5. Component tests for the voice hook and the offline queue.
2. Real-device checks: Android with Chrome, bad network, airplane mode, Arabic and French voice, noisy place.
3. Real runs of the language model and the Azure voice, with the numbers checked against the facts.
4. Demo script, fallback data if the network fails, and a one-page honest-limits slide.

## 5. "Everything works" means this scenario passes

1. A new farmer opens the app on a phone, picks a language (Arabic switches to right to left), answers the onboarding with pictures.
2. The home screen shows the real Sentinel-2 picture of the field with four zones and one "do this now" card with the numbers from the engine.
3. The farmer asks by voice "Why?", hears the answer in the same language, and the Copilot never states a number that is not in the facts.
4. "Read my tasks" and talk mode work; "stop" stops.
5. A soil test typed in changes a dose and the confidence.
6. A faulty sensor reading is flagged and the app says it is not sure instead of giving a wrong dose.
7. A persistent vigor drop in one zone creates an "Inspect here" task on the map.
8. The farmer marks a task done, undoes it, marks it done again with a photo; the next advice uses the result.
9. In airplane mode the app still opens, shows saved advice, accepts actions, and syncs them when the network returns.
10. All of this runs on the public Azure URL behind a login, and the automated tests and end-to-end tests are green.

## 6. Suggested split of work

| Person | Focus |
|---|---|
| 3zden | React shell, onboarding, UX and accessibility, Phase 3 screens |
| Meryy4 | Sensor and satellite layers into the backend (Phase 2), their tests, sensor data path |
| You | Backend structure (Phase 1), engine, Copilot and voice, deployment (Phase 6), integration |
Adjust to what each person actually wants to own. The only shared contract is `openapi.json`.

## 7. Decisions needed

| Question | My default |
|---|---|
| Next.js or a plain React single-page app (Vite)? | Next.js, because it exists and has a Dockerfile |
| FastAPI or another backend framework? | FastAPI |
| PostgreSQL in production, or stay on SQLite for the demo? | SQLite for the hackathon demo, PostgreSQL if it must survive restarts and several instances |
| Is the season plan (Phase 4) and the agent sandbox (Phase 5) in scope? | Only after Phases 1 to 3 and 6 work |
| Who owns the GitHub repo layout change (moving `sensors/` and `satellite/` under `backend/`)? | The person doing Phase 2, by pull request |
| Which Azure resources do we really have (subscription, Speech, OpenAI)? | Assume Speech and Container Apps only until confirmed |

## 8. Risks

| Risk | Reduce it by |
|---|---|
| Two UIs diverge while the React app is built | Freeze the legacy app, port screen by screen, keep a parity checklist |
| The React rewrite takes longer than the time left | The Phase 1 bridge already connects the existing React app to the engine; demo that if needed |
| Voice fails on the demo phone | Test early on that phone; keep the browser fallback and typed input |
| Arabic wording is wrong | Native review before the demo |
| No login on a public URL | Do not deploy publicly before Phase 6 step 2 |
| Layers disagree on units and field names (sensors, satellite, engine) | A short data dictionary in `docs/`, and cross-layer tests in Phase 2 |
| Claims in the pitch outrun the evidence | Keep the "real, simulated, not validated" table up to date |
