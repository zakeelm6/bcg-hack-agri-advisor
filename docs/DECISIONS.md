# Decisions, owners and working rules (Phase 0)

Status of each decision: **Proposed** means it is my recommendation and needs the team's OK, because it affects work that
3zden and Meryy4 own. Nothing here has been confirmed with them yet. Change a line and the plan follows.

## 1. Decisions

| # | Decision | Status | Why | Revisit if |
|---|---|---|---|---|
| D1 | Frontend is **React with Next.js 15** (App Router), TypeScript, Tailwind 4, used mostly as a single-page app | Proposed | It already exists on `main`, has onboarding, three languages and a Dockerfile | The team prefers a plain Vite SPA (simpler offline, no Node server) |
| D2 | Backend is **FastAPI**, restructured into routers, services, db, schemas and processing | Proposed | Already built and tested (60 tests), typed routes, OpenAPI for the contract | The team wants another framework (Django, NestJS): decide before Phase 1 |
| D3 | The API contract is `backend/openapi.json`, frozen as in `API_CONTRACT.md` | **Applied** | The only shared surface between the two sides; a test enforces it | n/a |
| D4 | Database: SQLite for development and the demo, PostgreSQL for production, through SQLAlchemy and Alembic | Proposed | Keeps the demo trivial and the production path open | The demo must survive restarts on several instances |
| D5 | Season plan (Phase 4) and agent sandbox (Phase 5) are **out of scope until Phases 1 to 3 and 6 work** | Proposed | The core loop must work end to end first | The jury needs the sandbox demo earlier |
| D6 | Azure target: Container Apps (two containers), PostgreSQL, Key Vault, Azure AI Speech, Azure OpenAI optional | Proposed | Matches what was said to be available; Speech is already coded | Subscription or quota differs |
| D7 | `sensors/` and `satellite/` move under `backend/app/processing/` by pull request in Phase 2 | **Applied locally** (Phase 2) | One backend package, one test run | Meryy4 prefers separate packages |
| D8 | The legacy vanilla app is frozen and renamed `frontend-legacy/` once the React app starts; deleted at parity | **Applied locally** (renamed in Phase 3; parity in `PARITY.md`) | Avoids two UIs diverging | n/a |
| D9 | The rule "code decides every number, the model only explains" stays | **Applied** | It is the core of the pitch and is tested | n/a |

## 2. Layout to reach

```
bcg-hack-agri-advisor/
  frontend/          React app (Next.js)
  frontend-legacy/   current plain JavaScript app, until parity
  backend/           FastAPI app, with app/processing/ (engine, copilot, llm, speech, sensors, satellite)
  docs/              architecture, API contract, decisions, sensors, voice, processing notes, UX
  README.md  ROADMAP.md
```
On GitHub today: `frontend/` is the Next.js app, `sensors/` and `satellite/` sit at the root, and the legacy app and the backend are on the
branch `add-frontend2` under `frontend2/`. The local `finalproject/` folder has the target shape since Phase 3 (`frontend/` React, `frontend-legacy/` plain JavaScript).

## 3. Owners (suggested)

| Area | Owner | Backup |
|---|---|---|
| React app, onboarding, UX and accessibility | 3zden | You |
| Sensors and satellite layers, their integration in the backend | Meryy4 | You |
| Backend structure, engine, Copilot, voice, API contract | You | Meryy4 |
| Azure deployment and CI | You | 3zden |
| Honest-limits slide, demo script | Whole team | |

## 4. Working rules

1. **Branches:** one branch per task, named `phase<N>/<short-name>` (for example `phase1/backend-structure`). Nobody pushes to `main` directly.
2. **Pull requests:** small, one reviewer from the other side when the API contract is touched. Merge when the tests pass.
3. **Tests:** `cd backend && python -m pytest -q` must stay green. A new behavior brings a test. A change to the API regenerates `openapi.json`.
4. **Secrets:** never in the repo. Keys go in `backend/.env` (ignored) locally and in Key Vault or app settings on Azure.
5. **No made-up numbers:** the frontend shows what the server returns; the model never produces a quantity.
6. **Honest labels:** anything simulated says so in the app and in the docs.
7. **Commits:** no tool or assistant signatures in commit messages or pull requests.
8. **Language:** code and docs in English; the app in English, French and Arabic.

## 5. Phase 0 checklist

| Step | State |
|---|---|
| Agree on the plan and the layout | Written here, **waiting for team OK** |
| Freeze the API contract (`openapi.json`, `API_CONTRACT.md`, contract test) | **Done** |
| Choose owners | Proposed in section 3, **waiting for team OK** |
| Create a branch per phase and merge by pull request | Rules written; branches are created when each phase starts, and nothing has been pushed |
| Settle the open questions | Defaults chosen in section 1; **D1, D2, D4, D6 need an explicit yes** |
