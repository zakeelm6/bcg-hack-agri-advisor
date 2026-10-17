# Handoff: how to continue this project without Claude

This file is written so that another coding agent (opencode) or a person can take over at any moment. Read it fully, then read
[ROADMAP-TEAM-FRONTEND.md](ROADMAP-TEAM-FRONTEND.md) (the plan and, in section 9, a log of what each step really did).

## 1. The project in five lines

- **Farm Advisor** (BCG Platinion Hackathon 2026, Team 2, "Fighting World Hunger"): an AI that tells a small farmer what to do, when, why, what it costs, how sure it is, and the plan B.
- A tested **rule engine** decides every number. A language model (optional) only words the answer; text with a number that is not in the facts is rejected.
- **Backend** `backend/`: FastAPI, SQLAlchemy 2, Alembic, SQLite by default. **Frontend** `frontend/`: 3zden's app "growmate" (Next.js 15, React 19, TypeScript, Tailwind 4), picture-first, voice-first, local-first.
- Languages: English, French, Arabic and Darija (code `ary`). Money in MAD. Honest labels everywhere: real, simulated, not validated.
- Repository: `github.com/zakeelm6/bcg-hack-agri-advisor`. Local copy: `/home/arthur-leywin/Documents/prof/events/team-repo`.

## 2. Where things stand

| Step | What | State |
|---|---|---|
| 0 to 3 | Structure, profile to engine, "Do this now" card, activities teach the engine | Merged in `main` (PRs #4 to #7) |
| 4 | The farmer's own field with Sentinel-2 pictures and a Zones view | Pull request #8, branch `step4/own-field`, not merged yet |
| 5 | Calm data alerts, honest data lines, soil test form | Done on branch `step6/voice` (commit `663b9aa`), not pushed |
| 6 | Voice: Azure server voice first, browser fallback, talk mode, spoken orders | Done on branch `step6/voice` (commit `133fb40`), not pushed |
| 7 | Offline and weak network (service worker, banner) | Done on branch `step7/offline` (stacked on `step6/voice`), not pushed |
| 8 | One farmer, one field, one phone (device token) | **To do** (needed before anything public) |
| 9 | Professional polish in his identity | **To do** |
| 10 | Deploy on Azure | **To do** (runbook in section 7) |
| 11 | Harden: end-to-end tests, real phones, native Darija review, privacy page | **To do** |

First actions for whoever continues:
1. `git status` and `git log --oneline -5` in the repository. The branch `step6/voice` is stacked on `step4/own-field`.
2. Push: `git push -u origin step6/voice`. If PR #8 is merged by then, `git rebase origin/main` first (the step 4 commit is already in main, git will skip it).
3. Open a pull request into `main` (title "Steps 5 and 6: data alerts, soil test, server voice"). Pull requests are created in the browser on GitHub when `gh` is not logged in.

## 3. Rules of this repository (follow exactly)

- One branch and one pull request per step, named `step<N>/<name>`. Small commits. Never push to `main` directly.
- Git identity for commits: `git -c user.name=zakeelm6 -c user.email=zakariyaelmansouri40@gmail.com commit ...`. **No AI or tool signature anywhere** (no Co-Authored-By, no "generated with"), in commits, pull requests or files. The owner asked for this.
- **No long dashes** in any text written for the owner or in documents (use a comma, a colon or a full stop). The owner reads them as a mark of AI writing.
- The frontend never computes a number the engine decides. Honest labels stay. Simulated data is never decorated to look real.
- New farmer-facing text goes in `frontend/lib/i18n.ts` as `[en, fr, ar]` and, when Darija differs from standard Arabic, in `frontend/lib/i18n-ary.ts`. Placeholders such as `{z}` must be identical. `node lib/i18n.check.mjs` must pass.
- A change to the API is additive. After a change: `cd backend && python scripts/export_openapi.py` and commit `backend/openapi.json` (a contract test compares it). Update `docs/API_CONTRACT.md` for anything new.
- Never commit secrets. Keys live in `backend/.env` (ignored) and, in the cloud, in Key Vault. Do not copy the Azure Speech key into a document.
- Do not touch `/home/arthur-leywin/Documents/prof/events/finalproject/` (the owner's other local project). Its backend usually runs on port 8000.
- Before every push: `make check` (backend tests, contract, TypeScript, i18n check, voice check, build).

## 4. Run it locally

```bash
# API (use a free port; 8000 is often taken by the other project)
cd backend
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt   # no .venv exists in this folder yet
FA_CORS_ORIGINS=http://localhost:3002 FA_SATELLITE_JOBS=0 python -m uvicorn app.main:app --port 8010

# Web app
cd frontend && npm ci
NEXT_PUBLIC_API_URL=http://127.0.0.1:8010/api node_modules/.bin/next dev -p 3002
```
- `NEXT_PUBLIC_API_URL` **includes `/api`**. The frontend then calls `/state`, `/tts` and so on, which become `/api/state`, `/api/tts`. A voice call written as `${API}/api/tts` is a bug (it was one, fixed).
- Without `NEXT_PUBLIC_API_URL` the app runs alone on the phone, as it did before the engine was connected.
- The Azure voice needs `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in the API's environment (see `backend/.env.example`). The owner's Azure Speech resource (free F0, West Europe) exists; its key is in `finalproject/backend/.env`. Copy it into `backend/.env` yourself, never into git.
- To open the app past onboarding in a fresh browser origin, set `localStorage.growmate` to `{"lang":"en","profile":{"location":"El Jadida","crop":"Potato","plantedOn":"2026-08-20","area":"2.4","irrigation":"drip","challenge":"water","lat":33.27,"lon":-7.58},"tasks":[],"activities":[],"messages":[]}`.
- Tests: `cd backend && python -m pytest -q` (126 pass). `tests/conftest.py` resets the rate brakes, restores the demo field and switches satellite downloads off.
- The real satellite job needs `backend/.venv-sat` (`pip install -r requirements-sat.txt`) or `FA_SAT_PYTHON`. It takes about five minutes for the first picture.

## 5. Map of the code

- `backend/app/processing/engine.py`: the rule engine (`build_advice`), texts in four languages in one table. `copilot.py`: the Copilot (intents, facts, number check). `speech.py`: Azure voice. `sensors/` and `satellite/` layers.
- `backend/app/services/`: `advice.py` (builds `/state`, reopens a done task when the same need returns), `activities.py`, `own_field.py` (the farmer's own field and the satellite job), `farmer.py` (profile to engine), `sync.py` (the offline queue endpoint).
- `backend/app/api/routers/`: `state, tasks, activities, farmer, field, copilot, voice, sync, places, market, health`. `backend/migrations/` Alembic 0001 to 0006.
- `frontend/lib/`: `api.ts`, `queue.ts` (one offline queue replayed through `POST /sync`: task_status, observation, soil_test, listing, offer_accept, farmer, activity, activity_remove), `engine.ts` (`useEngine`), `field.ts`, `farm.tsx` (state in `localStorage` key `growmate`), `voice.ts` and `voice-pure.ts`, `money.ts`, `i18n*.ts`.
- `frontend/app/`: `farm/` (engine card, land maps, Zones view), `copilot/`, `activities/`, onboarding in `page.tsx`.

## 6. What remains, step by step (with "done when")

### Step 7: offline and weak network
- Add a service worker (Next.js 15 app router, no heavy library needed: a small hand-written worker registered from the layout, or `serwist`) that caches the app shell, fonts, images and the last `/api/state` response so the app opens in airplane mode.
- A calm banner: "Saved on your phone, will be sent" when the queue is not empty or the network is down; it disappears when `flush()` succeeds. Queue status is already in `lib/queue.ts`.
- The Co-Pilot already falls back to a local stand-in (`lib/copilot.ts`): label that answer "answered on the phone, without the satellite".
- A PWA manifest and icons (installable).
- Done when: in airplane mode the farmer opens the app, sees the saved advice, marks a task done, and it reaches the server when the network returns. Test it by hand and write a Playwright test in Step 11.

### Step 8: one farmer, one field, one phone
- Today the server holds one farmer and one field (`fields.id = 1`, `field_id=1` appears in services). Introduce `farmers` and key `fields`, `tasks`, `activities`, `soil_tests`, `observations`, `sensors` by a farmer id taken from an anonymous device token created on first launch (store in `localStorage`, send as `Authorization: Bearer` or `X-Device`). Alembic migration 0007 must move the existing demo row to a demo farmer.
- Every route is scoped to the token. `own_field` output folders become per farmer (`backend/data/own/<farmer>/`). The demo field stays shared and read-only for farmers who have not given a position.
- Rate limits per token. Later (not now): phone-number login, a cooperative agent role.
- Done when: two phones with different fields see different advice, and a test proves one farmer cannot read another's data. This is a breaking change to every route: keep the contract additive where possible and update `openapi.json`.

### Step 9: professional polish in his identity
- Re-aim `finalproject/docs/prompts/opencode-ux-pro.md`: keep his serif and green, formalise them as tokens (Tailwind 4 `@theme`), build a small component set (Button, Card, Badge, Sheet, Toast, Banner, Skeleton, EmptyState, ConfidenceMeter, FormField), dark mode, a high-contrast mode, designed loading, empty, error and offline states.
- Known rough spots: Co-Pilot chips send an English question that shows in the user's bubble (show the localized label, send the localized question); the four-language switcher is cramped on phones; the engine card and his local "Today" list are two lists of tasks (merge them); Zones and task screens must reach the standard of his welcome screens.
- Work screen by screen, check four languages at 390 px and 1440 px, keep before and after screenshots in `docs/ux/`. Lighthouse mobile: Performance 90+, Accessibility 100. 3zden reviews anything that changes a screen.

### Step 10: Azure deployment: see section 7.

### Step 11: harden
- Playwright end-to-end test of the scenario in roadmap section 5 (onboarding, advice, done, offline, voice mocked). Tests for the queue and the voice hook.
- A real-phone checklist: Android Chrome and iOS Safari, slow network, Arabic and Darija voice, noise, microphone permission, autoplay of server audio.
- A native Darija and Arabic review of every text (the owner must find a speaker; texts were written by an AI model).
- A short privacy page: position goes to the weather service and to the town lookup, map imagery providers, voice audio goes to Azure for recognition only and is not stored.
- Update the honest-limits slide and the README status table.

## 7. Deploy on Azure (runbook for Step 10)

Do Step 8 first if the URL will be shared. Without it every visitor edits the same farmer. The API has **no login**: never leave a public deployment without at least the device token and an API limit.

Target: two Azure Container Apps (api, web), Azure Container Registry, a managed database, Key Vault for secrets, the existing Azure AI Speech resource, HTTPS only.

1. **Prepare**: `az login`, pick the subscription (`az account set`), set variables: `RG=farm-advisor-rg`, `LOC=westeurope`, `ACR=<unique name>`, `ENV=farm-advisor-env`.
2. **Resource group and registry**:
   `az group create -n $RG -l $LOC` then `az acr create -g $RG -n $ACR --sku Basic`.
3. **Build the images in the cloud** (no local Docker needed):
   - API: `az acr build -r $ACR -t farm-api:1 ./backend` (the `backend/Dockerfile` also installs the satellite environment in `.venv-sat`; image size is large, if too slow build without it and set `FA_SATELLITE_JOBS=0`).
   - Web: the browser needs the public API address at build time: `az acr build -r $ACR -t farm-web:1 --build-arg NEXT_PUBLIC_API_URL=https://<api-fqdn>/api ./frontend`. So create the API app first to learn its address, then build the web image. Check that `frontend/Dockerfile` uses the standalone output (`output: "standalone"` in `next.config.ts`); add it if missing.
4. **Database**: SQLite on a container disk is lost on restart. Use Azure Database for PostgreSQL flexible server (Burstable B1ms) and set `FA_DATABASE_URL=postgresql+psycopg://...`; add `psycopg[binary]` to `backend/requirements.txt`. Run the migrations against it once (the app also runs them at start). Test the migrations on PostgreSQL before going live: they were only run on SQLite so far.
5. **Secrets**: create a Key Vault, store `AZURE_SPEECH_KEY`, the database URL and any model key; give the API's managed identity the "Key Vault Secrets User" role; reference secrets from the Container App (`--secrets` with `keyvaultref`).
6. **Container Apps**: `az containerapp env create -n $ENV -g $RG -l $LOC`, then `az containerapp create` for `api` (target port 8000, ingress external, min replicas 1, env `FA_CORS_ORIGINS=https://<web-fqdn>`, `AZURE_SPEECH_REGION=westeurope`, `FA_CURRENCY=MAD`, `FA_DATABASE_URL`, secrets) and for `web` (target port 3000, ingress external). Keep the API at **one replica** until the rate limits and the field job state are moved out of memory (they are per process).
7. **Satellite job storage**: `backend/data/own/` is written by the job. On Container Apps mount an Azure Files share there, or accept that pictures are lost on restart (the job can be retried from the app).
8. **Smoke test on the public URL from a phone**: `/api/health`, `/api/speech/status` (available true), the onboarding, a task done, the voice in Darija, the Zones view, airplane mode after the service worker (Step 7).
9. **CI/CD**: add `.github/workflows/deploy.yml`: on merge to `main`, after the backend and frontend checks, log in with OIDC (`azure/login`), `az acr build`, `az containerapp update --image`. Store the Azure identifiers as GitHub secrets, never keys in the repository.
10. **Cost**: the Speech F0 tier has a monthly free quota; Container Apps scale-to-zero is not wanted for the API (cold starts hurt the voice); Postgres B1ms and the registry are the fixed costs. Tell the owner the estimate before creating paid resources.
11. Record in `docs/DEPLOY.md` the real names, commands used and the URL; add the URL to the README.

Do not create or delete Azure resources, or spend money, without the owner's explicit yes.

## 8. Known open issues and limits (be honest about them)

- Darija and Arabic texts are unreviewed by a native speaker. The Darija voice uses Azure `ar-MA` (Jamal), there is no separate Darija locale.
- Voice: the microphone, the silence threshold in noise and iOS autoplay were never tested on a real phone. Recording uses a deprecated `ScriptProcessorNode` (works everywhere, plan an AudioWorklet).
- The own field uses the outline for the centre and size only (no pixel mask), a fixed 2 by 2 zone grid, one field and one farmer per server, and the first satellite picture takes minutes (clouds can leave nothing).
- Sensors are simulated (two, on zones A and B). Crop type is not read from the satellite. The harvest forecast and the rule thresholds are demo values, not validated.
- The soil-moisture estimate after watering is a one-layer bucket model (`mm/300` minus crop use).
- Two lists of tasks (engine card and his local list), English Co-Pilot chips in the user bubble, a cramped language switcher on phones.
- Soil tests cannot be listed or deleted in the app yet.

## 9. Pitfalls learned the hard way

- Never run `pkill -f` or `pgrep -f` with the name of a server in the same shell command: the pattern matches your own command line and kills the shell (exit 144). Use the process id from `ss -ltnp`.
- `npx tsc` can install an unrelated npm package named "tsc". Use `node_modules/.bin/tsc`.
- `node --experimental-strip-types` does not work with the Node 24 build on this machine. The voice check transpiles with the `typescript` package (`lib/voice.check.mjs`). `lib/map.check.ts` cannot run for the same reason.
- Another process may restart or overwrite dev servers and `.next`. Use your own port (3002 for the web app, 8010 for the API in this guide), run `npm run build` again if `.next` was overwritten.
- After an API change the contract test fails until `openapi.json` is regenerated.
- The demo database is shared by tests: use the fixtures in `tests/conftest.py`, never leave the field on `own`.
- Chrome automation: a JavaScript snippet's last expression is returned; a top-level `return` gives `undefined`.

## 10. If you are unsure

Prefer the smaller change, keep the honest labels, run `make check`, write what you did in section 9 of the roadmap (what was built, what was checked for real, what is not verified), and ask the owner when a choice costs money or changes a screen's look.
