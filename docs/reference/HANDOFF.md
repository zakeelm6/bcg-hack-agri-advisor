# AgriMind: handoff for frontend / backend teammates

Everything the UI shows comes from **one JSON document** produced by `backend/runner.py::run_all()`. Frontend and backend only meet at that contract, so each side can be replaced or extended independently.

```
farmer answers (JSON) ──► planning graph (LangGraph) ──► season loop (daily LangGraph) ──► run JSON ──► UI
                          ~50 s, cached on disk          ~0.5 s                                          turn = 1 week
```

## 1. Run it

```bash
pip install -r requirements.txt
uvicorn backend.api:app --port 8000        # UI at http://localhost:8000
python scripts/build_demo.py               # recompute frontend/demo_run.js (offline demo)
pytest -q                                  # 38 tests, about 1 min
```

No API key is needed. With a key in `.env` the LLM nodes switch on automatically (`backend/llm.py`).

| env var | effect |
|---|---|
| `AGRIMIND_OFFLINE=1` | never call an LLM even if a key exists |
| `AGRIMIND_ONLINE=1` | climate normals from Open-Meteo and soil check from SoilGrids for the farmer's GPS position |
| `AGRIMIND_FAST=1` | 6+6 weather scenarios instead of 20+20 (tests) |
| `AGRIMIND_DEBUG=1` | enables the dev-only `POST /api/_debug_save` (canvas snapshots). Never set in production |
| `LLM_PROVIDER` / `LLM_MODEL` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | live LLM |

## 2. HTTP API (`backend/api.py`)

| method | path | purpose |
|---|---|---|
| POST | `/api/run` | body `{farmer?, shocks?, seed?, fault_rate?}` returns the run JSON. First call per farmer input takes about 50 s (planning), then it is cached |
| GET | `/api/farmer/demo` | the demo farmer input |
| GET | `/api/tts?text=...&lang=fr\|en\|ar` | `audio/mpeg`, or **204** when offline (client must fall back to browser speech) |
| GET | `/api/kb?q=...&k=3` | RAG search; `/api/kb/{id}` returns one cited chunk |
| GET | `/api/skills` | list of skills (name, description, tools, rag) |
| GET | `/api/evals` | `evals_report.json` (from `python scripts/run_evals.py`) |
| GET | `/api/health` | `{ok, llm_mode, demo_shocks}` |

* Planning is **cached** in `cache/plan_<hash>.pkl`. The key covers the farmer input, LLM mode, FAST flag and the newest mtime of any file under `backend/`, so editing code or data invalidates it.
* If a required answer is missing, `/api/run` returns `{"status":"needs_input","questions":[{"field","question","problem"}]}` instead of guessing. The question text is in the farmer's language. The UI should show the questions and re-post.
* `frontend/demo_run.js` is `window.DEMO_RUN = {...}`, which makes `index.html` work with no server.

### Farmer input (validated by `backend/schemas.py::FarmerInput`)

Required: `lat, lon, size_ha, soil_type (sandy|clay|medium), water_source (well|river|dam|canal|rain_only), water_quota_m3, start_date (YYYY-MM-DD), budget_usd, distance_to_market (<1h|1-3h|>3h)`.
Optional with defaults: `slope_pct, frost_risk, wind_risk, water_cost_m3 (computed from pump_head_m and energy_price_kwh if null), water_ec_dS_m, irrigation_method (flood|sprinkler|drip), can_install_drip, pump_flow_m3h, soil_test{ph, ec_dS_m, organic_matter_pct, nitrate_ppm, p_olsen_ppm, k_ppm}, family_workers, hired_wage_day, has_cold_storage, has_shade, previous_crop, habit_crop, language (fr|en|ar), name, region`. See `backend/data/demo_farmer.json`.

Shock objects (for `shocks`): `{"type":"frost","day":24,"nights":2,"tmin":-1.0}`, `{"type":"dry","day":38,"days":35,"et0_mult":1.12}`, `{"type":"heatwave","day":90,"days":5,"delta":7}`. `[]` means a normal season; omit to use `DEMO_SHOCKS`.

## 3. Run JSON contract

```
status                "ok"
meta                  {llm_mode, seed, shocks, weeks, lang, start_date, skills[], fault_rate}
farmer, assumptions[] validated input; assumptions the agent had to make (e.g. "no soil test")
profile               A1 output: texture, taw_mm_per_m, ph, om_pct, insights[{text, evidence[]}], climate_source
water                 A2 output: cost_m3, quota_m3, recommended_method, method_reason, scarcity, need_m3_ha_by_crop
candidates[]          viable vegetables with economics (profit_ha, water_m3_ha, risk, suitability, ...)
strategies[]          V1/V2/V3: {id, name, goal, assign[16], sow_day[16], method, crops, planted_parcels,
                       metrics{profit_mean, profit_cvar10, p_loss, water_mean, labor_peak_hours, ...},
                       judge{utility, norm{profit,downside,water,labor}, feasible, violations[]}, care[], capex, labor}
baseline              metrics of the farmer's usual practice on the same Monte Carlo seasons
decision              Judge: winner, runner_up, ranking, weights, stability, by_id, explanation, explained_by,
                       evaluation{rows[0].metrics[]}   (DeepEval-style checks, see section 5)
optimization          Optimizer: moves[], accepted, reason, holdout_gain, record{train_*, holdout_*}, evaluation
final_plan, trad_plan {assign[16] (crop or null), sow_day[16], method, fert_events, crops, season_days}
buyers[]              {name, type, pickup, contact, crops_offered, volume_kg, est_value_usd}
expected              {by_crop_kg, profit, water_m3} for a median season
trace[]               planning log: {agent, name, kind (LLM|Tool), summary, ms}
kb                    {chunk_id: {title, text}} for every source cited in tasks and insights
weeks[]               the replay (below)
outcome               {agent, trad, savings}   final economics for both farms
tasks_eval            verifier statistics for the whole season
```

### `weeks[i]` (turn i+1)

```
week, day_start, day_end, date_start, date_end
weather   {tmin, tmax, rain, et0}
agent     {parcels[16], water_cum, mode ("normal"|"watch"|"drought"), events[]}
trad      {parcels[16], water_cum, events[]}           same shape without mode
days[7]   {day, date, tmin, tmax, rain, et0, water_agent, water_trad, tasks[], briefing{fr,en,ar}|null}
```

A parcel snapshot: `{id 1..16 (row-major 4x4), crop|null, stage, canopy 0..1, moisture 0..1, health 0..1, stress 0..1, irrigated_mm (this week), water_m3 (cumulative), yield_kg, harvested, covered}`.
`stage` is one of `fallow, bare, prep, sprouting, growing, flowering, ripening, harvest, harvested, failed`.

Events: `sown`, `frost_hit {loss_pct, detail}`, `frost_blocked`, `wilted`, `disease`, `disease_blocked`, `harvested {kg}`; each has `parcel` (1-based) and `day`.

### Task object (`weeks[].days[].tasks[]`)

```
id, day, due_date, action, parcels[1..16], crop|null, quantity, unit, reason, priority 1..3, if_skipped, evidence[]
action  prepare_soil | sow | irrigate | fertilize | cover_frost | scout_spray | harvest | pack_transport
unit    minutes_pump | kg | hours | crates | none
status  verified | fixed (auto-repaired) | escalated (not executed, "ask your advisor")
script  {fr, en, ar}      the sentence to read out, already jargon-free
verification {score, failed[], metrics[{metric, kind, score, success, reason}]}
injected_fault            present only when the verifier stress test corrupted this task on purpose
```

Rules the UI should keep: at most 3 tasks per day, show the status badge, never hide `escalated` tasks, play `briefing[lang]` for the day or `script[lang]` for one task.

## 4. Where things live

| you want to change... | touch |
|---|---|
| a crop's agronomy (Kc, Ky, salinity, price, labour) | `backend/data/crops.json` (typical values, **calibrate locally**) |
| soil classes | `backend/data/soils.json` |
| buyers | `backend/data/buyers.json` |
| field physics (water balance, frost, heat, disease, yield) | `backend/tools/simulator.py` |
| irrigation / deficit rules, traditional baseline | `backend/tools/policy.py` |
| strategy generation (V1/V2/V3), crop filters | `backend/graph/planning.py::crop_selector` |
| judge criteria, weights, constraints | `backend/decision/judge.py` |
| optimizer moves | `backend/decision/optimizer.py::neighbours` |
| how tasks are produced, capped, repaired | `backend/graph/daily.py` |
| verifier metrics and thresholds | `backend/evals/task_metrics.py` |
| farmer wording and languages | `backend/i18n.py` (Arabic needs native review) |
| knowledge base (RAG) | `backend/rag/kb/*.md`, one `## [id] Title` section per chunk; ids are cited as evidence |
| agent skills | `backend/skills/<name>/SKILL.md` (front matter: name, description, tools, rag) |
| field rendering | `frontend/field.js` |
| UI state and panels | `frontend/app.js` |

### Adding things

* **New vegetable**: add an entry in `crops.json` (copy a neighbour), a photo in `frontend/assets/veg/<crop>.jpg` (use `scripts/fetch_veg_photos.py`), names in `i18n.py::CROP_NAMES`, canopy layout and colours in `field.js` (`CROP_LAYOUT`, `LEAF`, `FRUIT`), and a label in `app.js` (`NAMES`, `CROPS`).
* **New task type**: add it to `schemas.py::Action` and `Unit`, a template in `i18n.py::TEMPLATES`, `EVIDENCE`/`CONSEQUENCE`/`PRIORITY` in `daily.py`, then a branch in `generate_tasks`, in `execute` (if it changes the field) and in the metrics in `task_metrics.py`. A task is only executed if it passed the verifier.
* **New verifier metric**: subclass `BaseMetric` in `evals/task_metrics.py`, add it to `deterministic_metrics()`, add a corrupting case to `tests/test_units.py::test_verifier_catches_corrupted_tasks`.
* **Live LLM**: set a key. Nodes that call the LLM validate its output against pydantic schemas and fall back to the deterministic path on any failure. Those paths are implemented but have **not** been exercised against a live model yet.
* **Real weather forecast**: replace `Forecaster` in `tools/weather.py` (it only needs `get(day, horizon) -> list[{tmin,tmax,rain,et0,...}]`).
* **Real field data instead of simulation**: the daily graph reads state from `FarmSim`; implement the same read methods (`snapshot`, `active`, `dsow`, `root_taw`, `Dr`, `water_used`) on a class fed by sensors/farmer feedback, and the task logic does not change.

## 5. Design rules to preserve

1. **The LLM never produces a number.** Quantities come from `tools/` and are re-derived by the verifier. Keep it that way.
2. **Executed = verified.** `graph/daily.py::execute` builds the simulator actions from verified/fixed tasks only. What the farmer hears is what happens in the field.
3. **Judge by code, explain by LLM.** Explanations are rejected if a figure is not traceable to the simulator (`judge_numeric_faithfulness`).
4. **Optimizer is validated on unseen weather** (`HOLDOUT_SEEDS`). Do not tune on the holdout seeds.
5. **GEval / LLM-judge metrics are skipped, never faked, without a key.**
6. The baseline ("usual practice") is a model: habit crop on every parcel, calendar flood irrigation rationed to the quota, one flat fertilizer dose, no frost cover, sowing 2 weeks later. Keep it documented if you change it, because the headline savings depend on it.

## 6. Gotchas

* Planning is slow (about 50 s with 20+20 scenarios). Show a loader, or call `run_planning()` ahead of time.
* Parcel ids are **1-based**, in API payloads and tasks; arrays like `assign` and `sow_day` are 0-based by parcel.
* Windows: write JSON/py files without a BOM (loaders use `utf-8-sig`, but keep files clean).
* `cache/` and `cache/audio` are disposable.
* The page reads `window.DEMO_RUN` first; delete or regenerate `frontend/demo_run.js` after changing the contract, or the UI will keep showing old data.
* Tests set `AGRIMIND_OFFLINE=1` and `AGRIMIND_FAST=1` in `tests/conftest.py`.
* Known limitation: the agent does not delay sowing when a frost is forecast on the sowing day (visible in the demo as frost damage on late-sown parcels).

## 7. Honest limits (keep them in the pitch)

* Simplified crop model (FAO-56 single-Kc water balance + FAO-33 yield response). Crop table values are typical and need local calibration.
* Pests and diseases are modelled only as wet-spell fungal risk.
* Arabic wording needs native-speaker review.
* Demo numbers come from the offline deterministic mode (no LLM key was used).
