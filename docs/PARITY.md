# Parity checklist: React app (`frontend/`) against the legacy app (`frontend-legacy/`)

The legacy app is removed only when every row is checked on a phone and a wide screen in the three languages.
State on 17 October 2026, checked with headless Chromium at 390 px and 1440 px (screenshots in `ux/2026-10-17-react/`):
**done** = works against the real API; **partial** = works with a gap named; **open** = not built.

| Screen or behaviour | Legacy | React | State |
|---|---|---|---|
| Public landing page (`/`): headline, how it works, the AI inside, what is real, about, one "Go in" action; returning farmers go to Home | About page | `/` | done |
| Onboarding with picture choices (language, location, crop, planting, area, irrigation, worry), skip to the demo field; each question read aloud (Azure when configured) and **answered by voice** (the answer is matched to the pictures in the four languages) | no (About page only) | `/` | done; answers reach the engine through `/api/farmer` |
| Team's land maps: satellite photo with the outline, measure by finger (Leaflet), 3D terrain (MapLibre); a drawn outline sends its area to the engine | no | Me → Find your field | done |
| Home: "Do this now" card with confidence and "+N more", "All good" empty state | yes | `/home` | done |
| Land view: Sentinel-2 picture, 4 zones, layers vigor / moisture / soil / trust, values top-end, task pins (links, 44 px+), sensor dots, unreliable-sensor marker, satellite anomaly cells, legend, honest labels | yes | `components/Land.tsx` | done |
| Copilot docked on Home, floating elsewhere, hidden where the page has its own button; phone button scrolls to the dock | yes | `components/Copilot.tsx` | done |
| Copilot answers from `/api/copilot` with source label, actions, number-check note; offline fixed answers from the saved advice | yes | yes | done |
| Voice: server voice first, browser fallback, adaptive loudness, level bar, states (tap, listening, thinking, speaking + Stop, blocked, no voice, offline), read-aloud toggle, talk mode, commands stop / repeat / read my tasks, "Listen" on a task | yes | `lib/useVoice.ts` | done in code; **not verified** with a microphone or Azure (same as legacy) |
| Tasks list: 7-day strip, confidence meter on cards, done / skipped pills | yes | `/tasks` | done |
| Task: Done (undo toast), Cannot do it with a reason, Why open, cost, plan B, Listen, Copilot, Soil test | yes | `/tasks/[id]` | done |
| Follow-up: photo (shrunk, vision notes when a model exists), Better / Same / Worse, note, save | yes | `/tasks/[id]/follow` | done |
| Field: land, vigor-over-time chart (real series), tasks today, soil tests, weather with "Today" | yes | `/field` | done |
| Soil test form with ranges and placeholders, zone chips, saved tests | yes | `/field/soil/[zone]` | done |
| Alerts: filters, "New" pill, "Add a soil test" action, mark as read | yes | `/alerts` | done |
| Sell: harvest estimate with honest labels, create offer, offers with server-computed value, confirm before accept | yes | `/sell` | done |
| Me: farm, language, Copilot and voice path, sync queue, refresh advice, honest-limits box, footer | yes | `/me` | done |
| About page: how it works, the AI inside, GPS "find my position", "walk the field edge", village search | yes | partly in `/me#about` | **partial**: GPS, walk and village search not ported |
| Offline: app shell cached, reads from the local copy, writes queued, replay through `/api/sync`, banner with advice age | yes | `sw.js`, `lib/api.ts`, `Banner.tsx` | done (localStorage queue; IndexedDB planned) |
| Three languages with right-to-left Arabic | yes | yes | done |
| Dark mode, high contrast, reduced motion, 48 px targets, visible focus | yes | yes | done (measured: no target under 44 px, no overflow, no console error) |
| Screens at 390 px and 1440 px without overflow | yes | yes | done |
| Served from the API at `/` | yes | no (own server, port 3000) | by design: Phase 6 puts both behind one URL |

## Open before removing the legacy app
1. ~~Port GPS, "walk the field edge" and village search~~ done (Me → Find your field).
2. ~~Farmer profile endpoint~~ done (`/api/farmer`); the position still stays the demo parcel until its satellite data is downloaded.
3. A real phone run (Android Chrome, HTTPS) of the voice and the camera.
4. Native Arabic review of the new strings.
