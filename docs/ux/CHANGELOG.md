# Farm Advisor — UX redesign changelog

Before/after screenshots: `docs/ux/before/` (40) and `docs/ux/after/` (48: desktop 1224 px + phone 390 px × EN/FR/AR × 8 screens).
Verification: `python -m pytest -q` → **42 passed** · `node --check static/app.js static/i18n.js static/sw.js` → clean ·
no console errors on any route · Lighthouse accessibility / best-practices / SEO = **100**, zero audit failures.
Files touched: `static/style.css` (rewritten), `static/app.js`, `static/i18n.js`, `static/sw.js` (cache v3 → v4).
Untouched, as required: `app/engine.py`, `app/copilot.py`, `tests/`.

## What changed, and which audit problem it fixes

### Design system (tokens)
- Semantic CSS variables: `--brand/--on-brand` (bars, buttons), `--page/--surface/--soft` (surfaces),
  `--tx/--tx2/--accent` (text), signals (`--amber`, `--danger`, violet Copilot), 4 px spacing scale,
  radii, shadows, type scale with **17 px base** (sunlight readability).
- **Dark mode** via `prefers-color-scheme` (all components incl. Copilot bubbles, skeletons, chart colors
  through `var(--z-a…d)` in the SVG). **High-contrast** boost via `prefers-contrast`.
- Motion tokens (150–200 ms), `prefers-reduced-motion` honored, visible amber `:focus-visible` everywhere.

### Home — "answer in under 5 seconds"
- New **"Do this now" hero card** first on the page: action title (engine numbers only), when,
  3-level confidence meter + word (shape + text, never color alone), `+N more today`, one tap → task.
  Green "All good" variant when nothing is due. *(audit: next action was below the map, hidden on phone)*
- Copilot empty state: centered mic in a violet disc + "Ask me about your field." *(audit: large empty void)*
- Quick-question chips wrap on wide screens. *(audit: chips clipped at panel edge)*

### Task detail — forgiving actions
- **Done / Cannot do it moved inside the card, above the collapsible details** — reachable without
  scrolling on a phone. *(audit: primary action below the fold)*
- **Undo**: marking a task done shows a 6 s toast with an Undo button (reverts to `open`, allowed by the API).
  Plain toasts can no longer replace an action toast, and the background sync no longer announces itself
  unless it was offline recovery or a manual "Sync now". *(audit: irreversible done, noisy sync toast)*

### Field
- Weather card gets a label and a **sun icon** for dry days instead of an ambiguous check. *(language of user)*
- Soil-test card shows "None yet." as an empty state. Chart grid/axis colors use tokens (dark-safe).

### Tasks / Alerts
- Selected day is filled amber (not outline-only); done/skipped cards use a `.off` class.
- Wide screens use an `auto-fill` card grid instead of two lost columns.

### Sell
- Offer cards wrap on phones: full-width Accept button, price no longer broken mid-line.

### Offline & loading
- Skeleton loaders (shimmer) replace "Loading..." on first load, Sell, chart and photo analysis.
- Offline banner unchanged (calm, amber); queued actions keep their reassuring toasts.

### Accessibility fixes
- Touch targets ≥ 44–48 px (chips, layer chips, lang switch, Copilot tools, day strip).
- Accessible names now match visible labels (brand link, language buttons) — Lighthouse failure removed.
- `aria-label` on the hero confidence meter; skeletons exposed as `role="status"`.

### i18n (new strings in `static/i18n.js`, EN source in `app.js`)
- `Do this now` → « À faire maintenant » / «افعل هذا الآن»
- `Undo` → « Annuler » / «تراجع»
- pattern `+N more today` → « +N autre(s) aujourd'hui » / «+N أخرى اليوم»
- Reused existing strings elsewhere (Weather, None yet., Done, All good) — no single-language text.

## Tap counts (target ≤ 3)
- See today's action and do it: **3** (hero → Done → Save follow-up)
- Ask the Copilot by voice: **2** (1 on home where the panel is docked)
- Add a soil test: **3** (Field → Add a soil test → Save)
- Use offline: **0 extra taps** (cached state + queued writes, calm banner)

## Still open
- Microcopy pass could go further (shorter alert bodies, warmer errors) — needs a native Arabic review.
- Voice states "thinking/speaking" could get a visual waveform; today: pulsing mic (listening), typing dots
  (thinking), speaker toggle + per-answer play (speaking).
- Dark mode is media-query only; a manual toggle would help shared phones.
- Vigor-over-time chart has no real series yet (honest empty state shown); revisit once data exists.
- The RTL desktop *screenshots* in `before/` taken without the iframe harness show a capture-tool artifact;
  DOM measurements confirmed no real overflow. After-captures use the harness and are faithful.
