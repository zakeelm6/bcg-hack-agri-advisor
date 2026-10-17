# Working in this repository

## Branches and pull requests
- One branch per task, named `step<N>/<name>` for the plan in `docs/ROADMAP-TEAM-FRONTEND.md`, `fix/<name>` or `chore/<name>` otherwise.
  Nobody pushes to `main` directly; open a pull request and merge when the checks pass.
- Small commits with a message that says what changed and why. No tool or assistant signatures in commit messages or pull requests.
- 3zden owns screens and wording; whoever changes the backend owns routes and the API contract. A contract change is additive and reviewed by both sides.

## Checks (run `make check`, or the lines below)
| Where | Command |
|---|---|
| Backend tests (100) | `cd backend && python -m pytest -q` |
| API contract up to date | `cd backend && python scripts/export_openapi.py && git diff --exit-code openapi.json` |
| Front-end types | `cd frontend && npx tsc --noEmit` |
| Darija texts match the main texts | `cd frontend && node lib/i18n.check.mjs` |
| Front-end build | `cd frontend && npm run build` |

GitHub Actions runs the same checks on every push (`.github/workflows/`).

## Rules that keep the product honest
- **Code decides every number; a model only words the answer.** The front end never computes a quantity the engine decides.
- **Honest labels:** anything simulated says so in the app and in the docs.
- **Four languages for everything the farmer reads** (`en`, `fr`, `ar`, `ary`): one row `[en, fr, ar]` in `frontend/lib/i18n.ts`, the Darija version in `frontend/lib/i18n-ary.ts`.
  Right to left uses logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`), never left and right.
- **No secrets in the repository.** Keys go in `backend/.env` (ignored) and in the cloud's secret store; templates are the `.env.example` files.
- **Database changes go through a migration:** edit `backend/app/db/models.py`, then `alembic revision --autogenerate -m "what changed"` and commit the file in `backend/migrations/versions/`.
- Use `npm run dev` (not `npx next dev`) in `frontend/`: it copies the worker file the 3D map needs.

## Where things live
See the table in the root [README](README.md) and the index in [docs/README.md](docs/README.md).
