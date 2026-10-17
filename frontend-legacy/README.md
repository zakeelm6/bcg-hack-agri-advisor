# Frontend (legacy web app)

Plain HTML, CSS and JavaScript, served by the backend at `/` (folder `../backend`, setting `FA_STATIC_DIR` can point elsewhere).
Files: `index.html`, `app.js` (screens, Copilot, voice, offline queue), `i18n.js` (English, French, Arabic), `style.css`,
`sw.js` (service worker), `manifest.json`, `land.png` and `land.json` (the Sentinel-2 picture of the field).

Replaced screen by screen by the React app in `../frontend/` (Phase 3). It stays served at `/` until `../docs/PARITY.md` is complete.
