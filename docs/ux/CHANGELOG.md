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

---

# Audit fixes, 16 and 17 October 2026 (legacy app, branch `phase2/ux-fixes`)

Audit: [AUDIT-2026-10-16.md](AUDIT-2026-10-16.md) (36 findings). Screenshots: `2026-10-16-before/` and `2026-10-16-after/`
(phone 390 px and desktop 1440 px, EN / FR / AR, every route, Copilot states, offline home; `measurements.json` holds the
DOM checks). Verification after the changes: `python -m pytest -q` → **61 passed** (one new test for the Sell value),
`node --check` clean on the three scripts, **no console error, no horizontal overflow, no touch target under 44 px** on any
page in any language. Untouched: `engine.py`, `copilot.py`.

## What changed, by audit item

**Severity 3**
- **G1 keyboard**: task cards, alert actions and the About options are real `<button>`s; the land pins are SVG `<a href>` links
  with a title and an amber focus ring. Everything on every page can be reached and activated with a keyboard.
- **H1 land pins**: pins are drawn at a fifth of a zone (44 px or more on a phone), laid out in a row at 60 % of the zone height;
  the value moved to the top-end corner, the letter stays top-start, the sensor dot bottom-start. Nothing overlaps any more,
  even with three tasks in one zone (seeded state checked).
- **V1 voice states**: a permanent status line under the mic with icon + words for every state: "Tap the mic and speak",
  "Listening...", "Thinking...", "Speaking... tap the square to stop", "Offline: type your question, saved answers only",
  "No voice in this browser: type your question", "Microphone is blocked. Allow it, or type your question". The mic becomes a
  Stop square while listening or speaking. A passing error message never hides a live state. Checked for real in Google Chrome
  (idle → read-aloud on → speaking → stop → offline → online) and in the OpenCode pane (blocked microphone).
- **SE1 numbers**: the harvest value per offer is now computed by the server (`est_value_mad`, `harvest_mid_t` in `GET /api/offers`,
  additive, tested). The app only formats it.

**Severity 2**
- **G2 targets**: language buttons, day strip, zone chips, `<summary>` rows, brand link, "New" pills: 48 px (44 minimum).
- **G3 languages**: the About footer, "ha", "MAD/kg", the harvest tonnes and the offer values follow the page language
  (Latin digits in Arabic). No English-only text remains in FR or AR.
- **G4 offline banner**: "You are offline. Advice saved 12 min ago. What you do is kept on this phone and sent later."
- **G5 back**: a back arrow (mirrored in RTL) on Task, Follow up and Soil test.
- **G6 / T3 floating Copilot**: hidden on pages that already have a Copilot button (Task). On phones it now **shows on Home**
  and scrolls to the docked Copilot, so the mic is one tap away (H4).
- **H2 honest labels**: under the land, "Picture: Sentinel-2, 12 Sept", "Vigor: Sentinel-2, 12 Oct" or an amber
  "Vigor: simulated", and "Sensors: simulated" from `data_notes`.
- **V2 noise**: the recorder measures the noise floor for 0.3 s, then speech = 3 × floor (clamped 0.015 to 0.08) and
  silence = 1.5 × floor; a level bar shows that it hears; after 12 s it says "Still listening. Tap the square to send."
  **Design only, not tested with a real microphone** (no Azure key, no mic in this session).
- **V3 toggles**: read-aloud and talk-mode toggles show "Read aloud: on/off" in the status line and carry a title.
- **TL1 tasks list**: confidence meter + word on every open card; done cards keep readable text and show a "Done" pill.
- **T1 task**: "Why" open by default, the confidence reason inline under the meter; Cost and Plan B collapsed.
- **T2 cannot do it**: asks "Why not?" (No water or product / No time / Not needed), stores the reason as an observation
  (`note: reason:...`, no API change), undo toast like Done.
- **S1 soil form**: placeholders "e.g. 6.4" in lighter text, the accepted range next to each label, title "Soil test, zone D".
- **SE2 / SE3 / SE4 sell**: Accept is secondary and asks "Accept 3.20 MAD/kg? The other offers will be declined."; a visible
  "Estimate, not validated" and "Crop: not identified."; "Buyers simulated" on the offers.

**Severity 1**
- H3 sensor legend; H6 "No task today. We check again tomorrow morning."; H8 "Low" / "High" words on the colour bar, mirrored in RTL;
  V4 the empty-state mic disc is a real button (or a keyboard icon when voice is unavailable); V5 "From your saved advice";
  V6 chips fade at the edge; F2 "Add a soil test" is the primary button when a zone is not High confidence; F3 "Today" marked
  in the weather strip; TL2 two-letter day names; FU1 "How does the field look?"; FU2 "Saved without a result."; A1 "Add a soil
  test" button inside the alert; A2 "New" pill with text; M1 "Answers come from tested rules, no AI model" and which voice path
  is used; AB2 the About page says which voice path is used.
- Dropped: **H7** (Arabic comma after a Latin zone letter) is correct right-to-left rendering, not a bug.

## Voice, tested for real on this machine (17 October)
- Google Chrome on Linux with `speech-dispatcher` and `espeak-ng` installed: **19 voices** (en-US, en-GB, fr-FR, ...), **no Arabic**.
  A test sentence and a "Why?" answer were spoken end to end (utterance start and end events, 3.9 s).
- Speech **input** was not tested: it needs a person speaking into a microphone.
- The OpenCode pane (Electron): recognition fails with `not-allowed`, 0 voices. The app now says so instead of going quiet.
- Azure server voice: still **not configured, not tested**.

## Still open
- Real phone, real microphone, noisy place (V2), screen reader run, Arabic voice (needs Azure).
- A native Arabic review of the new strings.
- The 10 m Sentinel-2 picture is blurry at this zoom: a vector field outline would look better than the upscaled bitmap.

---

# React app (Phase 3), 17 October 2026

The screens of the legacy app were ported to Next.js 15 / TypeScript / Tailwind 4 in `frontend/`, on the team's base (onboarding kept as the
first screen). Screenshots of every route at 390 px and 1440 px in EN / FR / AR, the Copilot answer and the offline home: `2026-10-17-react/`
(`measurements.json`: no horizontal overflow, no touch target under 44 px, no console error apart from the expected failed fetches while offline).
The audit fixes of 16 October are built in from the start (keyboard-reachable pins and cards, 48 px targets, voice state line, honest labels,
offline banner with the advice age, server-computed Sell values, "cannot do it" reasons, confirm before accepting an offer).
Parity with the legacy app: [../PARITY.md](../PARITY.md). Not verified: a real phone, a real microphone, a screen reader.

---

# Pro polish of the React app, 17 October 2026 (branch `ux/pro-polish`)

Audit: [pro/AUDIT.md](pro/AUDIT.md) (30 items, before screenshots in `pro/before/`). Design system: [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md),
living page `/design`, screenshots in `pro/design-system/`. After screenshots: `pro/after/` (every route × en/fr/ar/ary × 390 px light and dark
× 1440 px, Copilot answer, offline home, 200 % zoom, the voice "speaking" state in Chrome). Lighthouse JSON per page in `pro/after/`.

## Verified
- `npm run typecheck`, `npm run build`, `node lib/i18n.check.mjs` (Darija 400+ keys), backend `pytest` 95 passed.
- 132 captures: **no horizontal overflow, no touch target under 44 px, no console error** in four languages, both themes, both widths.
- **Lighthouse mobile** (production build, throttled): Home 90 / 100 / 100, Field 91 / 100 / 100, Tasks 90 / 96→100, Sell 88→, Me 84→ (performance before the
  last fixes; accessibility and best practices 100 everywhere after the contrast fix). CLS 0.001 or 0 on every page.
- Regression: keyboard order on Home with a visible focus on every stop; Enter on the hero opens the task; Done → Undo restores `open` on the
  server; offline: banner with the advice age, action queued, hard navigation to an unvisited page served by the service worker, replay on
  reconnect; 200 % zoom (720 px) without overflow; `prefers-reduced-motion` reduces every animation to 0.01 ms.
- **Voice with the real Azure key**: TTS → STT round trip recognises English and French exactly, Arabic correctly, Darija approximately
  ("علشان نصق" for "علاش نسقي"). In the app (Chrome): read-aloud spoke the answer in two chunks, the state line showed "Speaking… tap the
  square to stop" with the Stop control, returned to idle at the end; the mic entered "Listening…" through the server recorder.

## What changed, by audit item
- **F1 dark mode** rebuilt: `@theme static` tokens, `html.dark` palette designed (green-black surfaces, warm text, calmer amber), high contrast `html.hc`;
  theme and contrast chosen in Me, persisted, applied before paint. **F2 header**: compact language control (one button → sheet), no overflow.
- **F3–F5**: tokens, type pairing (Fraunces display, Geist UI with tabular numbers, Noto Naskh Arabic at 19 px loaded on demand), 14 components with
  every state; no one-off styled div left (the compatibility layer was removed). **F6** one icon family at 2 px. **F7** two-tone focus ring. **F8**
  150–250 ms fades, skeletons shaped like the content, server-rendered first state on Home (hero in the HTML). **F9** one meter per task, data sources
  behind one disclosure, Me in three sections. **F10** one formatter per language (today / tomorrow / weekday, Latin digits).
- **Home** (H1–H4): the hero is the only amber element; land values in dark chips in the bottom-start corner, pins in the centre band, selected zone
  with its line, anomaly cells clipped to the field, legend in one line, four labelled layers. Floating Copilot button hides once the dock is on screen.
- **Copilot** (CP1–CP4): chips send and show the farmer's language (the engine detects intents in all four); one 72 px voice control with a live ring while
  listening, a breathing ring and Stop while speaking; talk mode as a labelled toggle with an on-state; message fades; source badges in plain words.
- **Tasks / Task / Follow-up** (T1–T2, TD1, FU1): grouped by day, done items keep contrast, one amber Done with "cannot do it" as a quiet alternative,
  "why" in body type, cost and plan B as two rows, follow-up in three numbered steps.
- **Field** (FI1–FI2): the demo goal named on the chart, direct labels nudged apart, today and rain emphasised; soil test on FormField with inline errors.
- **Sell** (SE1): one honesty strip for the page, price large and tabular, server value small, confirm before accepting. **Alerts** (AL1): segmented filter,
  unread as dot + weight. **Me** (ME1): You / Data / Find your field, About in a sheet. **Onboarding** (ON1): photo with the headline on it, progress bar
  with count, one amber Next, skip always visible. **Offline** (OF1): neutral banner, never amber.

## Kept from the team's app, now wired (17 October, later the same day)
- **Onboarding answered by voice.** Every question is read through the server voice (Azure, Arabic and Darija included) with the browser as
  fallback; a voice bar under the question listens and matches what was said to the pictures in the four languages (`lib/voiceAnswers.ts`:
  normalised labels, shared words, loose Arabic letters; numbers in digits or words for the area). Checked with real Azure speech: "Des pommes de
  terre." → potatoes, "Goutte à goutte." → drip, "3 hectares et demi." → 3.5, "كنزرع. مطيش." → tomatoes. A real person speaking: not tested.
- **The team's land maps are back** (3zden): photo with outline, measure by finger (Leaflet), 3D terrain (MapLibre), in Me → Find your field,
  restyled on the system; a drawn outline saves the area to the farmer profile so the engine uses the real surface. Libraries load only when
  their tab opens.

## Phase 4 in the app (17 October, same day)
- **Season plan** card on Field (timeline of stages, planned tasks per stage, "what this plan assumes"), **verification badge** on tasks
  (Checked / Adjusted / Ask your advisor, with the re-check detail), **"Today in one line"** briefing on Home with a read-aloud button, and a
  **"To sharpen the advice"** card when onboarding answers are missing. The Copilot's "Read my tasks" reads the briefing when online.

## Still open
- Real phone, real microphone in noise, screen-reader run, native Darija reader (the Darija strings are AI-written).
- Performance on Sell and Me sits at 84–88 on the throttled mobile profile (shared bundle ~160 kB); a lighter query layer or route-level code
  splitting of the Copilot would lift it.
- Shared-element transitions between list and detail are fades, not morphs (View Transitions API would do it when Next supports it in App Router).
- Empty-state illustrations are icon-in-circle; a drawn set would add identity.
