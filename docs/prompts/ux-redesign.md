You are a senior product designer and front-end engineer. Redesign the UX of **Farm Advisor** (open `farm-advisor/` as the project root; read `README.md`, then `static/index.html`, `static/style.css`, `static/app.js`, `static/i18n.js`).

## Product
A website (not a native app) for small farmers in Morocco and Sub-Saharan Africa. It reads satellite NDVI (Sentinel-2), weather, shared soil sensors, soil tests and photos, then says what to do, when, why, cost, confidence and plan B. A voice Copilot explains the advice. Languages: English, French, Arabic (RTL).

## The user
A farmer, 25 to 60 years old, on a mid-range Android phone, often outdoors in bright sun, hands dirty or wet, slow or no connection, may read little, may prefer voice to typing. They open the app to answer one question: "What do I do on my land today?" Design for that moment, not for a dashboard.

## UX goals (in priority order)
1. **Answer in under 5 seconds.** The home screen shows the land (satellite picture with 4 colored zones) and one big "do this now" card. No scrolling needed to know the next action.
2. **One primary action per screen.** Everything else is secondary and visually quieter.
3. **Voice first.** A large mic button is always reachable with the thumb. States must be obvious: idle, listening, thinking, speaking, error, offline. Answers are read aloud with a clear stop button.
4. **Less words, more signals.** Use icon + one short label, color + shape (never color alone), and plain words a farmer uses. Max about 6 words per label, one sentence per explanation. Details (why, cost, confidence, plan B) are in a collapsible section.
5. **Trust.** Always show how sure the advice is (simple 3-level indicator with the reason on tap) and whether data is real or simulated (small honest badge, never hidden).
6. **Works anywhere.** Offline state is calm and clear ("saved on your phone, will send later"), never an error. Loading uses skeletons, not spinners. Empty states say what to do next.
7. **Forgiving.** Confirm irreversible actions, offer undo for "mark as done", never lose typed data.

## Method (do this in order, and show me the result of each step)
1. **Audit.** Run the app (`./run.sh`, http://localhost:8000). Walk every screen in all three languages at 390 px and 1440 px width. Produce a table: screen, problem, heuristic broken (Nielsen or WCAG), severity 1 to 3, proposed fix. Do not code yet.
2. **User flows.** Write the 4 key flows as short step lists and count the taps: (a) see today's action and do it, (b) ask the Copilot by voice, (c) add a soil test, (d) use the app with no connection. Target: each flow takes 3 taps or fewer.
3. **Design tokens.** In `style.css`: CSS variables for color (agri green, cream, one alert accent, text, surface), 4 px spacing scale, radii, shadows, type scale (base 17 px or more), motion (150 to 250 ms). Add a high-contrast option for sunlight and dark mode via `prefers-color-scheme`.
4. **Implement screen by screen**, starting with Home. After Home, stop and wait for my review.
5. **Microcopy.** Rewrite labels, empty states, errors and confirmations shorter and warmer. Add every new string to `T` in `static/i18n.js` with French and Arabic.
6. **QA.** Check keyboard focus order, screen reader labels, RTL mirroring (use logical CSS properties), touch targets of at least 48 px, contrast AA, `prefers-reduced-motion`, no horizontal scroll, no console errors.

## Hard constraints
- Do not change `app/engine.py`, `app/copilot.py` or `tests/`. Code decides all numbers; the UI never invents one.
- No framework and no build step (no React, Tailwind, npm). Static HTML, CSS and vanilla JS only.
- English is the source language in `app.js`; translations live in `i18n.js`. No text in a single language.
- The page uses the full window on desktop (no max width); bottom navigation on phones.
- Keep the offline service worker working; if you add a shell file, add it to `static/sw.js` and bump the cache name.
- Keep the "real vs simulated" labels honest.

## Definition of done
- `python -m pytest -q` still gives 42 passed, and `node --check static/*.js` is clean.
- Before/after screenshots of every screen in EN, FR and AR saved in `docs/ux/`.
- A short changelog: what changed, why (which problem from the audit), what is still open.
