# The team's React app connected to the engine (branch `integrate/engine`)

This branch keeps 3zden's frontend (growmate: welcome, six picture questions, My Farm, Co-Pilot, Activities) and adds the backend
(decision engine, sensor and satellite layers, Copilot, voice routes) behind it. Nothing in his structure was moved.

## What changed in `frontend/`
| File | Change |
|---|---|
| `lib/copilot.ts` | The Co-Pilot asks `POST {NEXT_PUBLIC_API_URL}/chat`: advice from the engine (`recommendation`, `why`, `steps`, `missing`) in the farmer's language. His local keyword stand-in answers only if the variable is unset or the server cannot be reached (offline, server down). A real server error (limit reached) is shown as an error. |
| `lib/i18n.ts`, `lib/i18n-ary.ts` | Darija (`ary`, "الدارجة") as a fourth language: 166 of his 174 texts have a Darija version, the rest read standard Arabic. `isRtl()` and `intlLocale()` helpers. |
| `app/shell.tsx`, `app/page.tsx` | Right to left for Arabic and Darija; four language buttons on the welcome screen and in the header. |
| `app/farm/*`, `app/activities/page.tsx` | Dates and numbers formatted with the right locale for Darija. |
| `.env.example` | `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api` |
| `lib/i18n.check.mjs` | `node lib/i18n.check.mjs`: every Darija key exists and has the same placeholders as English. |

## What was added
`backend/` (FastAPI, 95 tests, see `backend/README.md`), `docs/API_CONTRACT.md`, `docs/DARIJA.md`, `docs/VOICE.md`,
`.github/workflows/backend.yml`. The backend also works without a frontend: `GET /` answers with a small JSON pointing to `/docs`.

## Run it (two terminals)
```bash
cd backend && ./run.sh                       # API on http://127.0.0.1:8000
cd frontend && cp .env.example .env.local && npm ci && npm run dev    # app on http://localhost:3000
```
The browser origin must be allowed: the API accepts `localhost:3000` by default (`FA_CORS_ORIGINS` for others).
Use `npm run dev`, not `npx next dev`: the script copies the worker file the 3D map needs.

## Checked
Backend tests (95), TypeScript, the Darija check, and in a browser: Darija welcome screen, the six questions in Darija, then the Co-Pilot answering
"واش نسقي اليوم؟" with the engine's task (irrigate zone D, 20 mm, time, pump cost, plan B) in his answer card.

## Known gaps (next stages)
1. The engine still works on its demo parcel: his profile (town, GPS, crop, planting date, area) stays on the phone. The backend already has `GET/POST /api/farmer` (see `docs/API_CONTRACT.md`); his onboarding does not call it yet.
2. His My Farm "Today" list and Activities are local; the engine's tasks (with confidence and plan B) are not shown there yet.
3. The land view (Sentinel-2 picture with zones, sensors and anomalies) is not in his My Farm yet; his Photo / Measure / 3D map is.
4. Voice is still the browser's own in his app; the Azure server voice, talk mode and commands are not ported.
5. No offline queue for actions; the Co-Pilot falls back to his local stand-in when the server is unreachable.
6. The repository root still has Meryy4's `sensors/` and `satellite/` and their demos; the backend carries its own copies in `backend/app/processing/`. They should become one.
7. Darija texts are written by an AI model and need a native review.
