    You are a staff-level product designer and front-end engineer with 10+ years shipping consumer and field-ops products used by non-technical people on cheap phones. Your job: take the React app in `frontend/` from "functional demo" to a product that looks and feels professionally designed, calm, trustworthy and fast. Do not add features. Raise the craft of what exists.

    ## Product and user (design for this person, not for a dashboard)
    Farm Advisor tells a small farmer in Morocco what to do on their land today, why, how sure we are, and the plan B. Users: 25 to 60, mid-range Android, outdoors in bright sun, wet or dirty hands, weak or no network, often low literacy, prefer voice, speak Darija, standard Arabic, French or English. The app must feel like a tool they can trust with their livelihood: quiet, clear, honest. Think Linear's polish and Apple Health's clarity, with the legibility of a field instrument. Not a SaaS admin template.

    ## Read first
    `README.md`, `ROADMAP.md`, `docs/DECISIONS.md`, `docs/API_CONTRACT.md`, `docs/DARIJA.md`, `docs/ux/` (earlier audits), `processing/VOICE.md`. Then run it: `cd backend && ./run.sh` (API on 8000), `cd frontend && npm run dev` (3000). Look at every screen in all four languages (en, fr, ar, ary), at 390 px and 1440 px, light and dark, before touching anything.

    ## Hard constraints
    - Do not change the decision engine, Copilot logic or API contract (`backend/openapi.json`, `docs/API_CONTRACT.md`). The frontend displays what the server returns and never computes a number. If you need an API change, stop and ask.
    - Keep: Next.js, TypeScript, Tailwind 4, TanStack Query. New dependencies only if justified in one line and small (a font, an icon set, a motion helper). No UI kit that imposes a look.
    - All farmer-facing text in four languages (`en`, `fr`, `ar`, `ary`), logical CSS properties only (no left/right), right to left must look designed, not mirrored by accident. New strings go in `lib/i18n.ts` and `lib/i18n-ary.ts` (`node lib/i18n.check.mjs` must pass).
    - Honest labels ("real", "simulated", "not validated") stay visible. Never decorate simulated data to look real.
    - `npm run typecheck` and `npm run build` pass; backend tests (`cd backend && python -m pytest -q`) stay green. Do not commit secrets. No tool or assistant signatures in commits. Work on a branch `ux/pro-polish`. Do not push.

    ## What "professional" means here (the bar)
    1. **A real design system, built first.** Tokens in one place (CSS variables via Tailwind `@theme`): a warm neutral scale, one deep-green brand, one amber for action/attention, semantic colors for success, warning, danger, info that also work in dark mode; 4 px spacing scale; radius scale; elevation scale (subtle, layered, never heavy drop shadows); type scale with a considered pairing (a serif or humanist display face for headlines, a highly legible sans for UI; Arabic needs its own well-chosen face such as Noto Naskh/Kufi or IBM Plex Sans Arabic, with correct line-height and size, usually larger than Latin). Base text 17 px or more. Document it in `docs/DESIGN_SYSTEM.md` with screenshots.
    2. **A small component library, used everywhere:** Button (primary, secondary, ghost, danger, icon, sizes, loading, disabled), Card, Badge/Pill, Segmented control, Tabs, Sheet/Dialog (accessible focus trap), Toast, Banner, Skeleton, EmptyState, ListItem, Stat, ConfidenceMeter, Tooltip, FormField with error. Each with every state (default, hover, focus-visible, active, disabled, loading, error). No one-off styled divs left in screens.
    3. **Hierarchy and rhythm.** Every screen has one obvious primary action and a clear reading order. Consistent page templates, consistent vertical rhythm, aligned grids, real whitespace. Remove clutter: if two elements say the same thing, delete one. Fewer words, icon plus short label, one sentence per explanation, details behind a disclosure.
    4. **Information design.** The land view is the hero: refine the map (better zone styling, legend, selected-state, pin design that never covers values, readable at arm's length in sun). Charts follow dataviz rules (direct labels, restrained color, accessible contrast, no chartjunk). Numbers are tabular and formatted per language.
    5. **Confidence and trust UI.** A clear, consistent visual language for "how sure" (shape plus text, never color alone), data freshness, real vs simulated, offline state. This is the product's core value; make it unmistakable and calm.
    6. **Motion with purpose.** 150 to 250 ms eases, shared-element or fade transitions between list and detail, skeletons shaped like the final content (no layout shift), optimistic updates with undo, a satisfying but quiet "done" moment. Respect `prefers-reduced-motion`. Nothing bounces for decoration.
    7. **States are designed, not default.** Loading, empty, error, offline, partial data, long text, very long Arabic words, 200 % zoom, slow network. Each has a considered design and helpful copy. The offline experience should feel safe ("saved on your phone"), never alarming.
    8. **Voice as a first-class interface.** The mic is reachable by thumb, large, and its states are obvious and beautiful: idle, listening (live level), thinking, speaking (with stop), error, offline, no-permission. Talk mode has a clear on/off presence. Transcript and answer appear with graceful transitions. Test with the real server voice if `backend/.env` has the Azure key.
    9. **Mobile first, then desktop.** Phone layout is the primary design: bottom navigation, safe-area insets, 48 px targets, sticky primary action, no horizontal scroll. Desktop is a considered two-column layout, not a stretched phone. Tablet in between. Landscape phone works.
    10. **Dark mode and sunlight.** Dark theme designed (not inverted). A high-contrast mode for direct sun (`prefers-contrast` and a manual toggle that persists).
    11. **Craft details.** Consistent icons (one family, one stroke weight, optically aligned), favicon and app icon, splash and install experience (PWA manifest), meaningful page titles, focus rings that look intentional, selection color, scrollbars, `:active` feedback on touch, text wrapping (`text-wrap: balance/pretty`), no orphaned units, proper plural and number forms, localized dates and relative times.
    12. **Performance and quality gates.** Lighthouse mobile: Performance 90+, Accessibility 100, Best Practices 100. Cumulative layout shift near 0. Fonts self-hosted or preloaded with `font-display: swap`; images sized. Keyboard-only use works on every screen; screen-reader names make sense in each language.

    ## Fix these known rough spots (found in review)
    - The Copilot chips send an English question and show it in the user's bubble even in Arabic/Darija (shows "Why?" next to a Darija button). Show the localized label.
    - Four-language switcher in the header is cramped on phones; design it properly (a compact menu or a segmented control that fits).
    - Zone pins can still cover the vigor numbers on the land view; the legend and layer switch need hierarchy.
    - Onboarding feels like a form; make it feel like a guided, friendly, picture-first flow with progress and a clear skip.
    - Screens share almost no visual identity yet (flat cards, same weight everywhere). Establish identity: logo mark, color use, imagery treatment, empty-state illustrations (simple, consistent, culturally neutral).

    ## Process (follow it, show your work)
    1. **Audit** (no code): table of screen, problem, principle broken, severity 1 to 3, proposed fix, with before screenshots in `docs/ux/pro/before/`. Wait for my OK.
    2. **Design system** (tokens, type, components) with a living page at `/design` (dev only) showing every component and state in all four languages and both themes. Wait for my OK.
    3. **Apply screen by screen:** Home, Tasks and task detail, Field, Sell, Alerts, Me, Onboarding. After each: after-screenshots in `docs/ux/pro/after/` (390 px and 1440 px, four languages, light and dark), a11y check, Lighthouse numbers.
    4. **Regression pass:** offline flow, voice flow, undo flow, 200 % zoom, keyboard only, reduced motion.
    5. **Write** `docs/DESIGN_SYSTEM.md` and update `docs/ux/CHANGELOG.md` with what changed, why, and what is still open.

    ## Working rules
    Small reviewable commits (`ux: ...`). Show what you ran and what you saw; say plainly what is not verified (real phone, real microphone, a native Darija reader). Do not claim a screen is done until it passes all four languages at both widths. If a design choice trades legibility for looks, choose legibility. If you are unsure, ask once with two concrete options.

    ## Definition of done
    Typecheck, build, i18n check and backend tests green; every screen redesigned on the shared system; Lighthouse targets met or the gap explained; before/after screenshots complete; design-system doc written; no regression in offline, voice or undo.
