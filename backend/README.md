# Backend (FastAPI)

Part of the final project, see `../README.md`. This folder holds the API, the decision engine, the Copilot and voice, the data scripts and the tests. The web app it serves is in `../frontend/`.

# Farm Advisor (Team 2, BCG Platinion Hackathon 2026)

A **website** that reads a field's data and tells the farmer what to do, when, and why, then follows up. It is built like a device: few words, the home page shows the land (real Sentinel-2 picture, four zones) next to a voice Copilot. Full-window layout on a computer, compact with a bottom bar on a phone. Interface and Copilot in English, French and Arabic (right to left). It keeps working offline once opened (service worker, local cache and a write queue).
The mobile screens of the design are in Figma: https://www.figma.com/design/CGzdTv7gS5AgLfYLVsDmfN. The home page is `/`.

## Run
```bash
./run.sh            # creates .venv, installs deps, serves http://127.0.0.1:8000
```
Open it at `http://localhost:8000` (browsers only allow GPS on HTTPS or localhost).

**Exposure:** `./run.sh` listens on this computer only (127.0.0.1). `FA_HOST=0.0.0.0 ./run.sh` opens it to everyone on the same Wi-Fi, for a phone demo. The app has **no login yet**, so anyone who can reach it can read the data, write soil tests and tasks, and (if a model key is configured) spend it, within a 30-calls-per-minute brake. Do not put it on the internet (port forwarding, tunnel, public server) before adding authentication, HTTPS and per-user data.
Tests (84): `source .venv/bin/activate && python -m pytest -q`

## What is real and what is simulated
| Part | Status |
|---|---|
| Weather and 5-day forecast | **Real**: Open-Meteo, cached in SQLite, with a labelled fallback when offline |
| Decision engine (irrigation, fertilizer, inspection, alerts, harvest estimate) | **Real code**, rule based, unit tested (`tests/`). No language model computes any number |
| Crop vigor (NDVI) per zone | **Real Sentinel-2** after you run `scripts/fetch_satellite.py` (see below). Before that, seeded and **simulated**. 10 m pixels are coarse for a 2.4 ha field (about 55 pixels per zone) |
| Crop type and harvest date | **Not identified**: a satellite shows vigor, not the species. The harvest forecast is a placeholder until the crop is known |
| Two soil-moisture sensors | **Simulated** (`scripts/simulate_sensors.py` posts readings to the API). Every reading goes through the **quality checks** of the sensor layer (bounds, spikes, jumps, plateaus, rain consistency, frozen soil, depth order) and keeps its flags; a flagged sensor gives no dose |
| Moisture of a zone without a sensor | **Learned offset** to the shared sensor from the farmer's soil samples (3 or more), else the nearest-sensor estimate, each with its confidence and reason |
| Satellite anomaly detection | **Real Sentinel-2 pixels** through the detector of the satellite layer (baseline, persistence); a persistent patch becomes "Inspect zone X" and a GeoJSON layer |
| Buyers, offers and prices | **Simulated** |
| Soil tests | **Typed by the user** (pH, organic matter, moisture). pH warns outside 5.5 to 7.5; organic matter shifts the nitrogen dose by 10 kg/ha and raises the confidence; moisture counts as a measurement for 3 days. No file upload or OCR yet |
| Harvest forecast | Simple model, **not validated** |
| GPS: find position, walk the field edge | Real (browser Geolocation API, works without internet on a phone) |
| Offline queue | Real: actions are stored on the phone and replayed through `/api/sync` |

## Copilot and the AI layer
On the home page the **Copilot** sits beside the land picture, with a microphone (speech in, answers read aloud); on other pages a button opens it as a panel (it knows which task you are looking at). It answers from the
approved advice and the facts behind it: "Why?", "Plan B?", "When?", "How much?", "How sure are you?", "My plan for
today", "What if I wait 2 days?" (the engine is run again, nothing changes), and "How can I be more precise?" (opens the
soil-test form). It refuses to diagnose a disease and cannot change a task.

- **Default: no model needed.** Answers come from the rule engine (labelled "Rule engine"). Offline, saved answers for the
  fixed questions still work (labelled "Saved on this device").
- **Optional model** (`.env`, see `.env.example`): `anthropic`, any OpenAI-compatible API, or a local Ollama. The model only
  rewrites and widens the answer. **Any model text containing a number that is not in the facts is rejected** and the
  engine's text is shown instead, with a note. Keys stay on the server; the model gets no tools and no database access.
- **Voice.** The microphone sends what you say to the Copilot; answers can be read aloud (speaker button, or the play
  button on each answer). **"Read my tasks"** (chip or by voice) reads today's tasks from the saved advice. **Talk mode**
  (chat button in the Copilot header) reads the tasks, then listens, answers aloud and listens again; say "stop" or press
  the mic to end it, and it ends by itself after two silences. On a task page, **Listen** reads that task. Voice commands:
  read my tasks, repeat, stop (English, French, Arabic). Voice input uses the browser's speech service (Chrome or Edge, internet needed);
  voice output uses the voices installed on the device, and Arabic may have none (the app says so).
- **Server voice (Azure AI Speech), works in every browser and in Arabic.** Put `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`
  in `.env` (see `.env.example`). The page then records a short WAV (it stops by itself after 1.4 s of silence), sends it to
  `POST /api/stt`, and the Copilot's words come back from `POST /api/tts` as MP3 (voices ar-MA, fr-FR, en-US, changeable with
  `AZURE_SPEECH_VOICE_AR/FR/EN`). The key stays on the server, audio is not stored, the same sentence is cached in memory, and a limit of
  60 voice calls per minute protects the quota. If the server voice fails or is not configured, the app falls back to the browser's own speech.
  It needs HTTPS or localhost for the microphone. Tested with a faked Azure (8 automated tests and a browser run with a generated tone);
  **not yet tested against a real Azure key or with a real voice.**
- **Photo reading** (vision model only): after a task, a photo is described as observations and things to check, never a
  diagnosis. Without a vision model the photo is saved and the app says reading is off.
- Every question and answer is stored in an audit log (`GET /api/audit`). A simple limit of 30 calls per minute protects a paid key.

Status of the model path: the code, the number check and the fallbacks are covered by tests with a fake model. **It has not
been run against a real model API yet**, because no key was configured here. Try it with your own key, then check the answers.

## Real satellite data (Sentinel-2)
Free, no account. A second environment keeps the geospatial libraries away from the web server:
```bash
python3 -m venv .venv-sat && .venv-sat/bin/pip install -r requirements.txt numpy rasterio pystac-client pyproj
.venv-sat/bin/python scripts/fetch_satellite.py --lat 32.6328 --lon -8.4368 [--crop Potato]
.venv-sat/bin/python scripts/fetch_satellite.py --from-cache      # re-apply the last download with no internet
```
The Field page then shows a **Vigor over time** chart (one line per zone, `GET /api/ndvi-series`), a one-line summary of the weakest zone, and the dashed demo target of 0.70. Gaps are cloudy dates.
The cache also keeps the **per-pixel NDVI** of every date, which feeds the anomaly detector (`GET /api/zones/anomalies`, the red cells on the land view).
It downloads only the field's pixels from the Earth Search catalog, drops clouds, shadows, water and very dark pixels, averages NDVI over the 4 zones and keeps the last 4 clear dates per zone. The coordinates in the example are a real irrigated parcel near El Jadida found by scanning Sentinel-2 for homogeneous, vigorous 175 m blocks on 2026-10-12. The sowing date, the crop and the two soil sensors of the demo are still assumptions or simulations.
The thresholds of the rules (vigor target 0.70, fertilizer band 0.45 to 0.62, moisture trigger 23%) are demo values: they need calibrating on real fields before any real use.

## How it works
```
Phone (PWA, localStorage cache + queue)  <->  FastAPI  <->  SQLite
                                               |
                       engine.py (rules + water balance), geo.py (Open-Meteo)
```
- `GET /api/state` returns field, zones (moisture estimate and confidence), sensors, tasks, alerts, weather.
- Moisture of a zone without a sensor comes from the **learned offset** to the shared sensor (after 3 soil samples), else is **estimated** from the nearest sensor and crop vigor, with a lower confidence. A sensor whose recent readings are flagged gives **no** moisture: the zone says "?" and asks for a soil sample.
- Irrigation needs moisture under 23% and no useful rain; depth is capped at 30 mm. Fertilizer is skipped before heavy rain and dose is capped at 60 kg N/ha.
- Every task carries what, when, why, cost, confidence (with the reason) and a plan B.
- `POST /api/sensors/{id}/readings` accepts a new reading and the advice is recomputed.
- `POST /api/soil-tests` accepts a soil test for a zone (validated ranges) and the advice is recomputed. A zone between two measurements gets the average of their estimates.

## Try the offline mode
1. Open the app, go to Tasks, open a task and press Done.
2. Stop the server, press Done on another task: the banner says you are offline and the update waits on the phone.
3. Restart the server and press "Sync now" in Me: the queue is replayed.

## Next steps
1. ~~Connect real Sentinel-2 imagery~~ done; next: a cloud-free time series chart, a 10 m grid view, and a field boundary drawn by the farmer.
2. Prove the sensor calibration claim on public soil-moisture data.
3. Darija interface; test the voice on real phones (the browser's speech service needs internet, Chrome or Edge).
3b. Reading a lab report PDF (OCR) instead of typing values; water analysis; photo-based disease screening (needs a real vision model).
4. Real buyers through a cooperative.

## Code layout (Phase 1)

```
app/
  main.py          creates the app: CORS, middleware, routers, start-up
  core/            settings (config.py, env prefix FA_) and the rate-limit brakes
  db/              SQLAlchemy models, session, demo data; schema changes only through migrations/
  schemas/         requests.py and responses.py: the API contract (typed in openapi.json)
  services/        the use cases: advice and state, tasks, soil tests, market, sync, Copilot, chat adapter
  api/routers/     one file per area: health, state, tasks, market, copilot, voice, sync, pages
  processing/      engine (decisions), copilot, llm, speech, geo (weather), sensors/ (quality, offset, simulator), satellite/ (indices, anomalies, zones)
migrations/        Alembic: 0001 is the baseline; a database made before migrations existed is adopted on start-up
openapi.json       the frozen contract, regenerate with  python scripts/export_openapi.py
```
Database: SQLite by default (`FA_DB` or `backend/farm_advisor.db`). Set `FA_DATABASE_URL` to use another database such as PostgreSQL
(install its driver first; the SQL is portable but only SQLite is tested so far).
Schema change: edit `app/db/models.py`, then `alembic revision --autogenerate -m "what changed"` and commit the new file in `migrations/versions/`.

### Connecting the React app (Co-Pilot)
`POST /api/chat` accepts what `frontend/lib/copilot.ts` of the Next.js app sends (`{question, photo?, context, lang}`) and returns
`{recommendation, why, steps, missing}` built from the engine. Run the React app with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api`.
The browser is allowed by CORS for `http://localhost:3000` (change `FA_CORS_ORIGINS`). The React app's own profile (town, crop) is not used yet:
the engine works on the demo field.
