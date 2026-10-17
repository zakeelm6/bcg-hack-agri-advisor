# Frontend (React, Next.js 15, TypeScript, Tailwind 4)

The farmer's app, built in Phase 3 on the team's Next.js base (onboarding with picture choices, `lib/i18n.ts`, `lib/farm.tsx`)
and connected to the frozen API of `../backend` (`openapi.json`). The legacy plain-JavaScript app stays in `../frontend-legacy/`
(served by the API at `/`) until the parity checklist in `../docs/PARITY.md` is complete.

## Run
```bash
cd ../backend && ./run.sh                # the API on http://127.0.0.1:8000 (serves the legacy app too)
npm install
npm run dev                              # http://localhost:3000  (NEXT_PUBLIC_API_URL defaults to http://127.0.0.1:8000)
npm run build && npm start               # production build
npm run types                            # regenerate lib/api-types.d.ts from ../backend/openapi.json after an API change
npm run typecheck
```
Another port: `npx next start -p 3100` and `FA_CORS_ORIGINS=...,http://localhost:3100` on the backend.

Design system: `../docs/DESIGN_SYSTEM.md`; living page at `/design` (`npm run dev`, or a build with `NEXT_PUBLIC_SHOW_DESIGN=1`).

## Layout
```
app/            page.tsx (onboarding, first screen)  home/  field/  field/soil/[zone]/  tasks/  tasks/[id]/  tasks/[id]/follow/  alerts/  sell/  me/
                shell.tsx (brand, language, navigation, offline banner), layout.tsx (providers), globals.css (tokens, dark mode, RTL)
components/     Land.tsx (SVG over the Sentinel-2 picture: zones, layers, pins, sensors, anomaly cells, honest labels)
                Copilot.tsx (chat, voice states, talk mode, offline answers; docked on Home, floating elsewhere), Banner.tsx, ui.tsx, common.tsx, SoilLine.tsx
lib/            api.ts (typed client, localStorage copies, offline queue -> /api/sync), api-types.d.ts (generated), data.tsx (TanStack Query hooks, optimistic writes),
                useVoice.ts (Azure server voice first, browser fallback, adaptive loudness, states), i18n.ts (EN / FR / AR), farm.tsx (language and profile store), icons.tsx
public/         sw.js (app shell cache), manifest.json, icon.svg, images/
_archive-team/  the team's My Farm, Co-Pilot and Activities screens, kept for reference, not compiled
```

## Rules kept
- Every number on screen comes from the server (`est_value_mad`, doses, dates, confidence). The app formats, never computes.
- Honest labels: picture date, vigor date or "simulated", "Sensors: simulated", "Buyers simulated", "Estimate, not validated".
- Three languages for every string (`lib/i18n.ts`), Arabic right to left with logical CSS properties.
- Offline: the app shell is cached by `sw.js`, API reads keep a local copy, writes queue and replay through `/api/sync`; the banner says how old the advice is.
- Voice states always visible under the mic (tap to speak, listening, thinking, speaking with Stop, blocked, no voice, offline).
- Touch targets 48 px, visible focus, `prefers-reduced-motion`, dark mode and high contrast through media queries.

## Not done yet (see ../docs/PARITY.md)
Farmer profile saved to the backend (no API yet; the onboarding answers stay on the phone), IndexedDB queue (localStorage today),
GPS "walk the field edge" and village search from the legacy About page, a real-phone test.
