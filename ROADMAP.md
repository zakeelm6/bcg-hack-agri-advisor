# Roadmap: React frontend, framework backend, everything working together

Written after reviewing the local `finalproject/` folder and the GitHub repo `zakeelm6/bcg-hack-agri-advisor` (branch `main`,
plus the branch `add-frontend2`). Effort is given as S (hours), M (about a day), L (several days).

## 1. Where we are

### What exists, and where

| Piece | Where | State |
|---|---|---|
| Working web app (plain JavaScript) | `frontend/` here, `frontend2/` on branch `add-frontend2` | Most complete UI: land picture with zones, "do this now", tasks and follow-up with undo, alerts, sell, soil tests, GPS, offline queue, voice Copilot, English / French / Arabic, accessibility pass |
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

### Phase 1: backend foundation (M) - done and tested locally (60 tests)
1. Split `main.py` into routers, services and settings. Keep every test green. **Done:** `app/api/routers/`, `app/services/`, `app/core/config.py` (settings), `app/schemas/`, `app/processing/`.
2. Add SQLAlchemy models and Alembic migrations. Keep SQLite in development. **Done:** models, baseline migration `0001`, an old database is adopted on start-up, `FA_DATABASE_URL` for another database (only SQLite is tested).
3. Export `openapi.json` in CI; add CORS for the Next.js dev server. **Done:** `.github/workflows/backend.yml` runs the tests and fails if `openapi.json` is stale; CORS for `localhost:3000`; every response is now typed in the contract.
4. **Bridge for the existing React app (S), built, not used by our frontend:** add `POST /api/chat` that accepts `{question, photo, context}` and returns `{recommendation, why, steps, missing}` built from the engine and the Copilot. This connects the Next.js app to real advice without waiting for the rewrite.
5. Done when: the backend is layered, migrated, typed and tested. The legacy frontend was checked against it in a browser (screens, Copilot, tasks, soil test, offline replay, no console errors). The Next.js app was **not** wired to it: the frontend that matters here is ours.

### Phase 2: connect the sensor and satellite layers (M to L)
1. Move `sensors/` and `satellite/` into `backend/app/processing/`, keep their tests.
2. Store sensor readings with quality flags from the checks (never delete a reading, flag it). A flagged reading does not enter a dose calculation.
3. Replace the "nearest sensor and vigor" estimate in the engine with the learned offset per plot from the sentinel layer, with its confidence.
4. Feed the real Sentinel-2 series into the anomaly detector. A persistent anomaly creates the "Inspect here" task and a map layer (GeoJSON).
5. Add tests that cross layers (bad sensor gives low confidence and "soil test recommended", not a dose).
6. Done when: with a faulty simulated sensor the app says it cannot be sure and shows why, and with an anomaly it points to the zone.

### Phase 3: React frontend (L)
Port in this order; each step ends with the screen working against the real API in three languages.
1. Shell: API client, data cache, language switch with right-to-left, navigation. Use the team's onboarding as the first screen.
2. Home: land view with zones, sensor dots and task pins, the "do this now" card, and the Copilot docked next to it.
3. Tasks, task detail with confidence and plan B, follow-up with photo, undo after "done".
4. Field: weather, soil test form, vigor over time chart, GPS and walking the field edge.
5. Alerts and Sell.
6. Farmer profile (crop, sowing date, area, soil, irrigation, water source) saved to the backend and used by the engine instead of the demo values.
7. Offline: service worker, IndexedDB queue, replay through `/api/sync`, calm offline banner.
8. Voice: `useVoice` with Azure first and the browser as fallback, talk mode, commands, "Listen" on a task (see `processing/VOICE.md`).
9. Accessibility and UX pass with `docs/prompts/ux-redesign.md`, screenshots before and after.
10. Parity checklist against the legacy app, then remove it.

### Phase 4: farmer profile and season plan (optional, M to L)
From `processing/ai-and-internal-processing.md`: a farmer form with "needs input" questions when an answer is missing, a season
calendar computed by deterministic tools (irrigation and fertilizer by crop stage and weather), a verifier per task
(verified, fixed, escalated), and a daily step that merges the plan with live satellite, sensor and weather data.
Do this only after Phases 1 to 3 work end to end.

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
