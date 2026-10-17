# API contract (frozen for Phase 3)

The machine-readable contract is [`backend/openapi.json`](../backend/openapi.json), generated from the FastAPI app.
The React app and the backend only meet here. A test (`backend/tests/test_contract.py`) fails when a route or a request model
changes without regenerating the file, and when one of the endpoints below disappears.

## Rules for changing it
1. Additive changes only during Phase 3: new endpoints, new optional fields, new response keys. No rename, no removal, no change of meaning.
2. A breaking change needs a pull request that says so, the regenerated `openapi.json`, and the owner of the frontend as reviewer.
3. After any API change: `cd backend && python scripts/export_openapi.py`, then commit `openapi.json`.
4. Every text the farmer reads (titles, reasons, answers) comes from the server in the requested language (`lang=en|fr|ar`). The frontend only translates its own interface labels.
5. Numbers are never computed in the frontend. It displays what the server returns.

## Endpoints

Language parameter: `lang` is `en`, `fr`, `ar` or `ary` (Darija, Moroccan Arabic; falls back to Arabic then English) (default `en`). Errors are JSON `{"detail": "..."}` with 422 (invalid input), 429 (too many requests), 503 (service not configured), 502 (a service behind the API failed).

| Method and path | Request | Response (keys) | Used by |
|---|---|---|---|
| `GET /api/health` | none | `ok` | start-up check |
| `GET /api/state?lang&refresh` | `refresh=true` forces new weather and new advice | `field`, `zones[]`, `sensors[]`, `tasks[]`, `alerts[]`, `weather`, `soil_tests[]`, `generated_at`, `data_notes` | Home, Field, Tasks, Alerts |
| `POST /api/tasks/{task_id}/status` | `{status: "open" \| "done" \| "skipped"}` | `ok` | task detail, undo |
| `POST /api/observations` | `{task_id?, result?, note?, photo?, yield_kg?}` | `ok` | follow-up |
| `POST /api/soil-tests` | `{zone_code, ph?, om_pct?, moisture?}` (ranges validated) | `ok` | soil test form |
| `POST /api/sensors/{sensor_id}/readings` | `{moisture, temp_c?}` | `ok` | sensor nodes, demo script |
| `GET /api/ndvi-series?lang` | none | `real`, `source`, `points[]`, and a summary | Field (vigor over time) |
| `GET /api/forecast?lang` | none | forecast days with notes and a harvest estimate | Field |
| `GET /api/offers` | none | `simulated`, `offers[]` | Sell |
| `POST /api/listings` | none | `ok` | Sell |
| `POST /api/offers/{offer_id}/accept` | none | `ok` | Sell |
| `POST /api/copilot` | `{question, task_id?, lang}` | `text`, `source` (`engine` / `model` / `saved`), `numbers_ok`, `intent`, `actions[]`, `note` | Copilot |
| `GET /api/copilot/status` | none | `mode`, `provider`, `vision`, `note` | Copilot header |
| `POST /api/vision` | `{photo (data URL), zone}` | `available` and observations or a reason | photo reading |
| `GET /api/speech/status` | none | `available`, `provider`, `langs` | voice |
| `POST /api/stt?lang` | raw WAV body (16 kHz mono, under 2 MB) | `text` | voice in |
| `POST /api/tts` | `{text, lang}` | audio (MP3) | voice out |
| `POST /api/sync` | `{actions: [{type, payload}]}` where `type` is `task_status`, `observation`, `soil_test`, `listing` or `offer_accept` | `results[]` | offline replay |
| `GET /api/audit` | none | `entries[]` | audit view |
| `GET /api/zones/anomalies?lang` | none | GeoJSON `FeatureCollection` + `available`, `source`, `dates`, `grid`, `note`; each feature has `zone_code`, `severity`, `persistence`, `cells[]`, `x`, `y`, `why` | land view (Phase 2) |

`GET /` serves the legacy web app and `GET /sw.js` its service worker. They are not in `openapi.json` and disappear when the React app replaces it.

Added in Phase 1: `POST /api/chat` with `{question (max 400), photo?, context, lang}` returning `recommendation`, `why`, `steps[]`, `missing[]`. It is an adapter for the Next.js Co-Pilot and is not used by our frontend.

## Known weaknesses of the contract
- Response models allow extra keys and many fields are optional, so they are looser than the ideal contract; tighten them as the React app uses them (fixed in Phase 1: responses are now typed in `openapi.json`).
- `POST /api/listings` and `POST /api/offers/{offer_id}/accept` take no body and act on the demo field.
- There is one field and one farmer (`field_id = 1`). Multi-user needs a farmer id and authentication.
- There is no login, so every endpoint is open. Do not expose the API publicly before Phase 6.

Added in Phase 2 (additive): `GET /api/zones/anomalies`; in `GET /api/state`, `sensors[].quality / flags / flag_text / good_share`,
`zones[].sensor_quality / offset`, `data_notes.anomalies`; in `GET /api/offers`, `offers[].est_value_mad` and `harvest_mid_t`.
`POST /api/sensors/{id}/readings` now accepts any plausible fraction (about -0.2 to 1.5) and **flags** impossible values instead of refusing them (422 only beyond that range).

Added in Phase 3 / 4 (additive): `GET /api/farmer?lang` (profile + `needs_input[]` questions + `assumptions[]`), `POST /api/farmer`,
`GET /api/season?lang` (deterministic season plan: stages, irrigation rhythm, nitrogen splits, inspections, harvest window, assumptions),
`GET /api/briefing?lang` (one paragraph for the day), `tasks[].verify_status` / `verify_detail` in `GET /api/state` (independent re-check:
verified, fixed, escalated), `farmer` action in `/api/sync`.

## Planned additions (not frozen yet)
Authentication routes.

## Added when the team's engine work was merged (October 2026)

All additive: nothing above changed. The machine-readable file is still `backend/openapi.json`.

- **`X-Device` header.** The app makes a random token on first launch (`fa_device` in `localStorage`, 22 to 128 URL-safe characters) and sends it on every request. The server keeps only its SHA-256, gives the phone a field of its own on first sight and limits every route to it. A request without the header uses the shared demo field (id 1), unless the server runs with `FA_REQUIRE_DEVICE=1` (then 401). Limits: `FA_MAX_DEVICES` (503), `FA_NEW_DEVICES_PER_MINUTE` (429).
- **Activities:** `GET /api/activities`, `POST /api/activities` (`client_id`, `type`, `date`, `note`, `cost`, `zone`, `amount_mm`; sending the same `client_id` again is harmless), `DELETE /api/activities/{client_id}`. Also through `/api/sync` as `activity` and `activity_remove`. A watering with an amount raises the estimated moisture; without it the engine waits two days.
- **The farmer's own field:** `GET /api/field` (source `demo` or `own`, `satellite_status` ready, pending, failed or none, a note, and `picture` = date, side of the picture and side of the field square), `POST /api/field/satellite` (try the download again), `GET /api/field/picture` (PNG, the farmer's own or the demo parcel's). `POST /api/farmer` with a position (and optionally `boundary`) moves the engine to a square of the farmer's area centred there and starts a Sentinel-2 download in the background; until it ends, `zones[].ndvi` is `null` and the engine says so.
- **Tasks** carry `qty` and `unit` (mm of water, kg of nitrogen per hectare). **Places:** `GET /api/place` (town name at a position).
- **Money:** the Copilot answers spending questions in `FA_CURRENCY` (MAD by default).
