# Prompt for opencode (Fable 5.1): follow the roadmap and improve the UX

Paste everything below the line into opencode, with `finalproject/` as the working folder.

---

You are a senior full-stack engineer and product designer working on **Farm Advisor**, a hackathon project (BCG Platinion 2026, theme
"Fighting World Hunger"). It tells a small farmer what to do on their land, when, why, how much it costs, how sure it is and the plan B,
using Sentinel-2 satellite data, weather, shared soil sensors, soil tests and photos. A voice Copilot explains the advice.
The user is a farmer on a mid-range Android phone, outdoors, hands dirty, weak or no network, may read little and prefer voice,
and may speak Arabic, French or English.

## Read first, in this order
1. `README.md` (map of the project), `ROADMAP.md` (the plan you follow), `docs/DECISIONS.md` (decisions and working rules),
   `docs/API_CONTRACT.md` (the frozen API between frontend and backend).
2. `backend/README.md`, then `backend/app/` (layers: `api/routers`, `services`, `db`, `schemas`, `processing`).
3. `frontend/` (current plain JavaScript web app: `app.js`, `i18n.js`, `style.css`, `sw.js`).
4. `processing/VOICE.md`, `processing/sensors-and-differentiators.md`, `processing/ai-and-internal-processing.md`,
   `docs/prompts/ux-redesign.md` and `docs/ux/CHANGELOG.md`.

## Where the project stands
Phase 0 (align) and Phase 1 (backend foundation) are done locally: layered FastAPI, SQLAlchemy + Alembic, typed `openapi.json`
with a contract test, CORS, CI file. 60 tests pass. The voice (Azure server voice with browser fallback, talk mode) is coded but
never tested with a real key, a real microphone or a phone. The language-model path was only tested with a fake model.
Next in the roadmap: **Phase 2** (connect the sensor and satellite layers), then **Phase 3** (React frontend).

## Non-negotiable rules
- **Code decides every number, the model only explains.** Quantities come from `backend/app/processing/engine.py` and similar tools. Any
  model text with a number that is not in the facts is rejected. Never move this logic into the frontend or into a prompt.
- **Do not change `backend/app/processing/engine.py` or `copilot.py` behavior** unless a roadmap step says so, and then add tests.
- `cd backend && python -m pytest -q` must stay green (60 now). New behavior brings new tests.
- After any API change: `python scripts/export_openapi.py` and commit `openapi.json`. Changes to the contract are additive in Phase 3.
- All farmer-facing text exists in **English, French and Arabic** (Arabic right to left, use logical CSS properties). No text in one language only.
- **Honest labels:** keep "real / simulated / not validated" visible. Never present simulated data as real.
- No secrets in the repo (keys go in `backend/.env`, ignored). No signatures or tool names in commit messages or pull requests.
- Accessibility: touch targets of at least 48 px, contrast AA, visible focus, `prefers-reduced-motion`, text that survives a 200 % zoom.
- Offline first: the app must open and accept actions with no network and sync them later (`/api/sync`).
- Work on a branch per task named `phase<N>/<short-name>`. Do not push to `main`. Do not push at all unless I ask.

## What I want, in this order
**A. UX improvements on the current frontend (do these first, they are cheap and visible)**
1. Run the app (`cd backend && ./run.sh`, open http://127.0.0.1:8000) and audit every screen in the three languages at 390 px and 1440 px.
   Write a table: screen, problem, rule broken, severity 1 to 3, fix. Do not code before I see it.
2. Fix what the audit finds, one screen at a time, starting with Home. Known issues to check first: the zone pins overlapping the vigor
   numbers on the land view (partly fixed), the loudness threshold of the voice recorder in noise, empty and loading states, the offline banner,
   long Arabic text wrapping, focus order. Fewer words, icon plus short label, one primary action per screen.
3. Voice: make the microphone and talk mode states obvious (idle, listening, thinking, speaking, error, offline). Test it for real on a phone if you can.
4. Save before and after screenshots in `docs/ux/` and update `docs/ux/CHANGELOG.md`.

**B. Follow the roadmap**
5. **Phase 2:** move the tested `sensors/` and `satellite/` packages (from the GitHub `main` branch, by Meryy4) into `backend/app/processing/`.
   Store sensor readings with quality flags (never delete a reading, flag it), replace the "nearest sensor and vigor" moisture estimate with the
   learned offset per plot and its confidence, feed the real Sentinel-2 series into the anomaly detector so a persistent anomaly creates the
   "Inspect here" task and a GeoJSON map layer. Add cross-layer tests (a faulty sensor gives low confidence and "soil test recommended", not a dose).
   If the code from `main` is not in this folder, ask me for it instead of inventing it.
6. **Phase 3:** only after A and B5 are accepted. Build the React frontend (Next.js, TypeScript, Tailwind) screen by screen against the frozen API,
   as listed in `ROADMAP.md`. Keep the legacy app until a parity checklist passes. Ask me before choosing a different framework.

## How to work
- Make a short plan for each step and wait for my OK before starting a phase. After each screen or step: show what changed, run the tests,
  list what is not verified. Say plainly when something failed or was skipped.
- Prefer small, reviewable commits. Do not refactor code you were not asked to touch. Do not delete my files; move them to `_archive/` if needed.
- Before claiming something works, run it. Do not claim the voice, the Azure speech, the language model or the phone behavior works unless you
  tested it for real; otherwise write "not verified".
- If the roadmap and the code disagree, tell me and propose the fix instead of silently choosing.

## Definition of done for each step
Tests green, `openapi.json` up to date, three languages complete, screenshots for UI changes, docs updated (`ROADMAP.md` status, `README.md`,
`docs/ux/CHANGELOG.md`), and a short note of what remains open.
