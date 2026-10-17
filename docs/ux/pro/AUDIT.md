# Pro-polish audit of the React app, 17 October 2026 (before any change)

How: production build of `frontend/` against the real API (real Sentinel-2 vigor and anomaly, live weather, Azure voice configured),
every route captured with headless Chromium at 390 px (light and dark) and 1440 px (light) in **en, fr, ar, ary**, plus the
Copilot answer and the offline home: 137 screenshots in `before/`, DOM measurements in `before/measurements.json`.
Measured: **horizontal overflow on every phone screen** (the header now has four language buttons), no touch target under 44 px,
no console error. Severity: **3** broken or misleading, **2** clear friction or unprofessional, **1** polish.
Principles: H = hierarchy, T = trust/honesty, I = information design, S = designed states, V = voice, M = mobile first, D = dark/sun,
C = craft, A = accessibility, L = language.

## Foundations (apply to every screen)

| # | Problem | Principle | Sev | Fix |
|---|---|---|---|---|
| F1 | **Dark mode is broken**: `@theme inline` bakes the colour values into the utilities, so the `:root` dark overrides only change `body` and text. Result: light cream cards on a dark page, "Field A" invisible (light text on cream), a black strip at the right (overflow). See `phone-*-dark-*.png` | D, A | 3 | Tokens as `@theme` (not inline) so utilities reference `var(--color-*)`; a designed dark palette (deep green-black surfaces, warm off-white text, muted amber), checked at AA on every pair |
| F2 | **Header overflows on phones**: brand + four language buttons + info button are wider than 390 px; the page scrolls sideways on every screen | M | 3 | Language becomes a compact control: current language as one 48 px button that opens a sheet with the four names in their own script; the info button moves into Me |
| F3 | One cream everywhere: page, cards, buttons and chips share two tints, so nothing recedes and nothing leads. Cards are flat rectangles with the same weight on every screen | H, C | 2 | Real scales: warm neutral 50–900, one brand green, amber for the single primary action, semantic success/warning/danger/info; elevation by tint and 1 px hairlines, not shadows; type scale with a display face |
| F4 | Type: Geist for everything, Arabic in Noto Sans Arabic at Latin sizes (visibly small and thin next to Latin digits); no display face; numbers not tabular; no `text-wrap: balance`; orphaned units ("25 \n mm") | C, L | 2 | Pairing: a humanist display face for titles (Fraunces is already in the project), Geist for UI with `tabular-nums`; Arabic/Darija in a Naskh-style face (Noto Naskh Arabic) at +2 px and 1.6 line-height; balance on headings, non-breaking space before units |
| F5 | Component drift: three button recipes (`.btn`, `.btn-sec`, inline Tailwind), pills with four paddings, chips vs lchips vs segmented days, ad-hoc `rounded-3xl` cards, toasts and banners styled in place. No disabled/loading states except opacity | C, S | 2 | A small component library (`components/ui/*`): Button (primary, secondary, ghost, danger, icon; sm/md/lg; loading, disabled), Card, Badge, Segmented, Sheet, Toast, Banner, Skeleton, EmptyState, ListItem, Stat, ConfidenceMeter, FormField; a `/design` page shows every state in four languages and both themes |
| F6 | Icons: one hand-drawn stroke set (good), but weights differ (2, 2.4, 3) and some are optically off-centre in circles; no app icon beyond a leaf SVG; no splash | C | 1 | Keep the set, normalise stroke to 2 and align; proper maskable icon and theme colour in the manifest |
| F7 | Focus ring is the default amber 3 px everywhere, including on amber surfaces (hero) where it disappears | A | 2 | Two-tone ring (ink + surface) that is visible on every background |
| F8 | Motion: the only motion is a pulse on the mic and Tailwind defaults; list→detail is a hard cut; skeletons are grey blocks that do not match the final layout (layout shift on Home when the land loads) | S | 2 | 150–250 ms fades, skeletons shaped like the hero/land/cards, no shift; respect reduced motion (already) |
| F9 | Copy repeats itself: on Home the hero says "Medium" with a meter *and* the task page repeats both; the land card shows four honest tags plus a legend of six items; Me stacks six cards of one line each | H | 2 | One meter per task, a single "Data" disclosure under the land that holds picture/vigor/anomaly/sensor sources, Me regrouped into three sections |
| F10 | Dates and numbers: "2026-11-15" raw ISO in Me, "2,4 هكتار" with a comma in Arabic (ar-MA locale) while the engine texts use a dot, weekday abbreviations in English on the Field weather strip when the key is missing | L, I | 1 | One `fmt` helper per language (dates relative when under 7 days, Latin digits, consistent decimal mark) |

## Screens

| # | Screen | Problem | Principle | Sev | Fix |
|---|---|---|---|---|---|
| H1 | Home | The hero card competes with the land (both saturated), then a mint void, then the Copilot a full screen lower. The eye has no order | H | 2 | Hero as the one amber element; land card quiet (hairline, no second header); Copilot summary bar visible under the land on phones with a "Talk" button, full panel in a sheet |
| H2 | Home / Field, land view | Values sit in the top-end corner at 7 px font units: at arm's length in sun they are hard to read; pins (now in a row) are fine but the inspect pin still touches the "0.62" when the anomaly cells fill the corner; no selected zone; legend is a 6-item line that wraps | I | 2 | Values as a chip per zone (letter + value) in the bottom-start corner, pins in the centre band, anomaly cells clipped to the zone; tap a zone → it is outlined and a one-line card says moisture, confidence and source; legend reduced to the colour bar + two icons, details behind "Data" |
| H3 | Home | The floating Copilot button overlaps the mic/send row of the docked panel on phones (`phone-*-cp-answer.png`) | M | 2 | Hide the floating button once the docked panel is in view (IntersectionObserver) |
| H4 | Home (phone) | Layer chips show only the active label; the other three are mystery icons | I | 1 | Segmented control with icon + label on all four (two rows on phone if needed) |
| CP1 | Copilot | Chips send the English question and the user bubble shows "Why?" in Arabic/Darija | L, T | 3 | Send and show the localized label; keep an `intent` hint for the server where it needs English keywords (the Copilot already detects Arabic/Darija keywords) |
| CP2 | Copilot | The state line is small text under a 64 px mic; listening shows a thin red bar; speaking is a green ring. Not "obvious and beautiful" | V | 2 | One voice control: 72 px mic with a live level ring while listening, a soft breathing ring while speaking, a Stop glyph, the state word large under it; talk mode as a visible toggle pill with an on-state |
| CP3 | Copilot | Transcript and answer appear with no transition; the "..." typing dots are plain text | S | 1 | 200 ms fade/slide for messages, a three-dot skeleton bubble |
| CP4 | Copilot | Source label "Rule engine" under every answer is jargon; the per-answer speaker button is a lonely icon | T | 1 | "From the rules" / "Checked model answer" / "Saved on your phone" as a small badge with an icon; speaker button labelled |
| T1 | Tasks | On desktop a 7-day strip stretches across 1 300 px and two cards float on an empty mint field (`desktop-fr-light-tasks.png`) | M, H | 2 | Two-column template: list on the start side (max 520 px), detail or summary on the end side; the strip capped at 7 × 64 px |
| T2 | Tasks | Done/skipped cards fade the text (60 % opacity) which drops contrast; no grouping by day | A, I | 1 | Group by day with a sticky date label; done items keep contrast and move under a "Done" header |
| TD1 | Task detail | Done and "Cannot do it" are equally large; the meter + reason + "Why" open + two disclosures make a wall; the three secondary buttons wrap unevenly | H | 2 | One primary (Done), "Cannot do it" as a ghost link; "Why" as the first paragraph in body type; Cost and Plan B as two quiet rows; Listen / Copilot / Soil test as an icon row |
| FU1 | Follow-up | Photo dropzone, result chips and note stack without a story; "How does the field look?" label is tiny | H | 1 | Steps: 1 photo (optional), 2 result (three big picture buttons), 3 note; one Save sticky at the bottom |
| FI1 | Field | Chart text is 13 px with a dashed 0.70 target that is never explained; weather strip has seven equal cells with no emphasis on rain | I | 2 | Direct labels at line ends (already), target labelled "goal 0.70 (demo)", bigger type, today highlighted, rain cells tinted |
| FI2 | Soil test | Range in `<small>` after the label; placeholders look like values at 55 % opacity | S | 1 | FormField component: label, hint row, unit suffix inside the input, error below |
| AL1 | Alerts | Filter chips + cards; the "New" pill is a button that looks like a label; alerts have no time | I | 1 | Segmented filter; "New" as a dot + bold title, time ago at the end; mark-read on open |
| SE1 | Sell | Three pills of different meaning on one card (Demo, Estimate not validated, Buyers simulated); offers show price and value in one grey line; Accept is outlined and far from the price | T, H | 2 | One honesty strip at the top of the page ("Demo data: estimate not validated, buyers simulated"); offer as a ListItem: buyer, price large and tabular, value small, Accept at the end |
| ME1 | Me | Six single-line cards and a very long page; the About box is a wall of bold labels; the language control duplicates the header | H | 2 | Three sections: You (farm, language, theme/contrast toggle), Data (sync, refresh, honest labels), Find your field; About moved to a sheet |
| ON1 | Onboarding | Reads as a form: full-width inputs, Back/Skip/Next bar, a picture at the top that is decorative only; the four language cards are the first thing on the welcome screen | H, S | 2 | Picture-first steps with a large question, big tiles, progress dots, one Next; language as the compact control; a warm welcome with one photo and one sentence |
| OF1 | Offline | The banner is amber (the action colour) and sits above the hero, so "offline" looks like the task; the mic is disabled with grey | S, T | 2 | Offline as a calm neutral chip in the header ("Saved on your phone · advice from 12 min ago"), content unchanged, mic shows the keyboard state with a plain sentence |
| DK1 | All, dark | See F1. Also the land picture and the amber hero have no dark treatment (the hero amber blinds in the dark) | D | 2 | Hero in dark: deep amber on dark surface, text warm white |

## Lighthouse (mobile, production build, before)
Run after the design-system step so the numbers are comparable; not measured here because the overflow (F2) and the broken dark theme (F1) would dominate.

## Not measured
Real phone, real microphone (the Azure key is configured: the server voice will be tested in step 3), screen reader, native Darija reader, 200 % zoom (planned in the regression pass).

## Plan (step 2 and 3, after your OK)
1. Design system: tokens as `@theme` with light, dark and high-contrast palettes; type pairing (Fraunces display, Geist UI, Noto Naskh Arabic); spacing/radius/elevation scales; `components/ui/*`; `/design` page. Fix F1–F8 at the root. Screenshots of `/design` in four languages, both themes.
2. Screens in this order: Home (H1–H4, CP1–CP4, OF1), Tasks and Task detail (T1–T2, TD1, FU1), Field (FI1–FI2), Sell (SE1), Alerts (AL1), Me (ME1), Onboarding (ON1). After each: screenshots, a11y check, Lighthouse.
3. Regression: offline, voice (with the real Azure key), undo, 200 % zoom, keyboard only, reduced motion.
4. `docs/DESIGN_SYSTEM.md`, `docs/ux/CHANGELOG.md`.
