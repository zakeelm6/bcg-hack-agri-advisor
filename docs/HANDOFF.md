# Handoff: continue this project without Claude

For another coding agent (opencode) or a person. Read this, then [README.md](../README.md), [ROADMAP.md](../ROADMAP.md), [DEPLOY-AZURE.md](DEPLOY-AZURE.md) and [GITHUB.md](GITHUB.md).

## The project in five lines
- Farm Advisor (BCG Platinion Hackathon 2026, Fighting World Hunger, Team 2): an AI that tells a small farmer what to do, when, why, what it costs, how sure it is and the plan B.
- A tested rule engine decides every number; a language model (optional) only words the answer, and a check rejects numbers that are not in the facts.
- `backend/`: FastAPI, SQLAlchemy, Alembic (migrations 0001 to 0008), SQLite by default (`FA_DATABASE_URL` for PostgreSQL). `frontend/`: Next.js 15, React 19, TypeScript, Tailwind 4, a design system (`/design`), four languages (en, fr, ar, ary = Darija), offline, Azure voice.
- Honest labels everywhere: real, simulated, not validated.
- Repository: branch `final-project` of `github.com/zakeelm6/bcg-hack-agri-advisor` (local branch `merge/team-best` while this merge is not pushed, see below). Local folder: `/home/arthur-leywin/Documents/prof/events/finalproject`.

## State on 17 October 2026
- Backend: 141 tests pass. The team's backend (activities, own field with Sentinel-2, places, devices, MAD) was merged with this project's Phase 4 (season plan, verifier, briefing).
- Frontend: all screens of the design system, now also: Activities page (watering with pictures 10/20/30 mm or not sure, money in MAD, history, undo), "Done" on a watering or fertilizer task records the activity, a field status note (demo parcel, getting the pictures, failed with Try again, not set up), the picture and the zone grid follow the picture geometry from the API, and a device token (`X-Device`) is sent on every request.
- Deployed on Azure Container Apps (resource group `CASA-team-2`, apps `farm-final-api` and `farm-final-web`, see DEPLOY-AZURE.md section 0).

## Rules (follow exactly)
- Commits as `git -c user.name=zakeelm6 -c user.email=zakariyaelmansouri40@gmail.com commit`. **No AI or tool signature** in commits, pull requests or files. **No long dashes** in text for the owner or in documents.
- The frontend never computes a number the engine decides. Honest labels stay. Four languages for every farmer-facing text: `lib/i18n.ts` rows `[en, fr, ar]`, Darija in `lib/i18n-ary.ts`, `node lib/i18n.check.mjs` must pass.
- API changes are additive: `cd backend && .venv/bin/python scripts/export_openapi.py`, then `cd frontend && npm run types`, update `docs/API_CONTRACT.md`.
- Never commit secrets (`backend/.env` is ignored). Do not create or delete Azure resources or spend money without the owner's yes. The Speech key is a Container App secret.
- Before pushing: `cd backend && .venv/bin/python -m pytest -q`, `cd frontend && node_modules/.bin/tsc --noEmit && node lib/i18n.check.mjs && npm run build`.

## Run it
```bash
cd backend && ./run.sh                          # API on 8000 (another project may already use 8000: use --port 8011)
cd frontend && npm install && npm run dev       # the app on 3000
docker compose up --build                       # everything in containers (API_PORT and WEB_PORT change the ports)
```
`NEXT_PUBLIC_API_URL` is the API address **without** `/api` in this project (the routes already start with `/api`). For the real satellite download of a farmer's own field the API needs the geospatial libraries: `backend/.venv-sat` (`pip install -r requirements-sat.txt`) or `FA_SAT_PYTHON`; `FA_SATELLITE_JOBS=0` switches the job off (tests and the API image do).

## What remains
1. **LangGraph nodes** (orchestrator, safety check, explainer, follow-up agents on top of the rule engine, see ROADMAP.md line 123 and `processing/ai-and-internal-processing.md`). Asked by the owner, not built; the owner's exact wish was not clear (a document of the nodes, or the code). Ask.
2. **Persistence on Azure:** the SQLite file is inside the container and resets on restart. Use PostgreSQL (test migrations 0001 to 0008 on it first) or an Azure Files share.
3. **Auth:** a token per phone is not a login. Set `FA_REQUIRE_DEVICE=1` on any public server (done on the Azure API once the frontend sends the token), and add a real login before real farmers use it.
4. **Real checks never done:** the microphone and the camera on a phone (Android Chrome over HTTPS), a native Darija and Arabic review of all texts, the satellite download on the server (needs the geospatial environment in the image).
5. **Not ported from the team's frontend:** the Zones view of the own field exists as the land card (picture and zone grid from the API); the team's picture-first onboarding style was kept only where this project already had it.
6. **Budget alert and monitoring** on Azure, a deploy workflow in `.github/workflows` (see DEPLOY-AZURE.md section 12).
7. Rule thresholds are demo values, sensors are simulated, the harvest forecast is not validated: keep saying so.

## Pitfalls
- `pkill -f` or `pgrep -f` with a server's name kills your own shell: use the pid from `ss -ltnp`.
- Tests use a temporary database and no live weather (`tests/conftest.py`); never point them at `backend/farm_advisor.db`.
- `az login --use-device-code` is blocked by the tenant: use `az login --tenant cdd2c4c3-eab5-47da-9e28-dde56d3af48e`. Azure CLI installed for the owner under `/tmp/claude-1000/azcli` (may be gone: reinstall with the script in DEPLOY-AZURE.md).
- The Land picture used to be read from `/static/land.png` (legacy app, absent in the API image). It now comes from `/api/field/picture`.
