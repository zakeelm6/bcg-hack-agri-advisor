# Team screens kept for reference (not compiled)

The Next.js app on GitHub `main` (3zden) had My Farm (`farm/`, Leaflet and MapLibre maps), a keyword Co-Pilot (`copilot/`,
`copilot.ts`, `starters.tsx`) and Activities (`activities/`). Phase 3 replaced them with the screens of the legacy app, connected
to the real API: Home (land view, "do this now", Copilot docked), Tasks, Field, Alerts, Sell, Me. The onboarding (`app/page.tsx`),
`lib/i18n.ts`, `lib/farm.tsx` and `lib/icons.tsx` were kept and extended. Nothing here is imported; `tsconfig.json` excludes the folder.
