# Farm Advisor design system

A field instrument, not a dashboard. Warm neutrals, one deep green, one amber for the single primary action of a screen,
semantic colours that also work in the dark, and a type pairing that stays legible at arm's length in the sun.
Living page: `/design` in the React app (`npm run dev`, or a build with `NEXT_PUBLIC_SHOW_DESIGN=1`). Screenshots in
`ux/pro/design-system/` (four languages, light and dark).

## Tokens (`frontend/app/globals.css`, `@theme static`)

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `bg`, `surface`, `surface-2`, `surface-3`, `line`, `line-strong` | Elevation by tint and 1 px hairlines; shadows only lift sheets, toasts and the mic |
| Text | `text` (16:1), `text-2` (7.3:1), `text-3` (4.6:1, captions only), `on-inverse` | Contrast measured on `surface` |
| Brand | `brand` (text, icons), `brand-strong` (bars, primary buttons), `brand-soft` (selected tint), `on-brand` | One green |
| Action | `accent`, `accent-strong`, `accent-soft`, `on-accent` | The **one** primary action per screen, the mic, "Do this now". Never for information |
| States | `success`, `warning`, `danger`, `info`, each with `-soft` and `on-*-soft`; `simulated` | `simulated` is a neutral with a dashed border: simulated data never borrows a "real" colour |
| Land | `vigor-low/mid/high`, `moisture-high`, `zone-a..d` | Zone colours are also redefined in the dark palette |
| Type | `--font-sans` Geist, `--font-display` Fraunces, `--font-arabic` Noto Naskh Arabic; sizes 13 / 15 / **17** / 19 / 22 / 27 / 33 / 40 | Arabic and Darija switch both families to Naskh, 19 px body, 1.65 line-height. Numbers use `.num`: tabular, left to right, Geist |
| Radius | 8 / 12 / 16 / 24 / 32 | Buttons and chips are pills; cards 16; sheets 24 |
| Elevation | `shadow-1/2/3` | Hairline first; 1 for hover, 2 for floating controls, 3 for sheets |
| Motion | 150 / 200 / 250 ms, `ease-out` cubic-bezier(.2,.8,.2,1) | `fade-up`, `fade-in`, `sheet-up`, `shimmer`; all disabled by `prefers-reduced-motion` |

Palettes: light (default), **dark** (`html.dark`: green-black surfaces, warm off-white text, calmer amber), **high contrast**
(`html.hc`: pure surfaces, black or white text, stronger lines; combines with dark). Chosen by the farmer in Me (persisted in
`fa_theme`) or by the system media queries; applied before paint by an inline script (`lib/theme.tsx`).

## Components (`frontend/components/ui/`)

| Component | Variants and states |
|---|---|
| `Button` | accent, primary, secondary, ghost, danger · sm 44 / md 52 / lg 60 px · icon, iconEnd (mirrors in RTL), iconOnly · hover, focus-visible, active (scale .97), disabled, loading (spinner, `aria-busy`) · renders a link with `href` |
| `Card`, `Label` | default, inset, accent, brand · interactive (hover shadow, press) |
| `Badge` | neutral, brand, accent, success, warning, danger, info, simulated, outline · sm / md · optional icon |
| `Segmented` | radiogroup with arrow keys, 44 px targets, icon + label, optional dot |
| `Sheet` | native `<dialog>` (focus trap, Escape, backdrop) · bottom sheet on phones, centred dialog on wide screens |
| `Toast` | one at a time, optional action (Undo), never replaced by a plain note |
| `Banner` | info (neutral), warning, danger, success · optional action · never the accent colour |
| `Skeleton`, `SkeletonText`, `SkeletonCard` | shaped like the content, shimmer |
| `EmptyState` | icon in a circle, title, sentence, action |
| `ListItem` | leading icon (neutral, accent, brand, danger), title, sub, meta, end, chevron (mirrors), muted |
| `Stat` | display number with unit and label, tabular |
| `ConfidenceMeter` | three segments + word, never colour alone, reason as title |
| `FormField` | label, hint, unit suffix, error with `aria-describedby` |
| `Tooltip` | hover, focus and tap |
| `Icon` | one family, 24-unit grid, 2 px strokes |

## Rules
1. One accent element per screen: the action the farmer should take. Everything else is green or neutral.
2. Information is never colour alone: a word or an icon always accompanies it (confidence, status, offline).
3. Honest labels (`simulated`, `outline` badges, `warning` banners) stay visible in every theme.
4. Logical properties only (`ps-`, `me-`, `start`, `end`); chevrons and arrows mirror in RTL (`rtl:-scale-x-100`).
5. Every string exists in `en`, `fr`, `ar`, `ary` (`node lib/i18n.check.mjs`).
6. Touch targets 44 px minimum, 48 px preferred; focus rings two-tone so they show on amber and on green.

## Status
Foundations and components: done (17 October 2026). Screens are redesigned one by one in `ux/pro/CHANGELOG` order; until a
screen is moved, it runs on temporary alias tokens and `.card/.btn` classes at the end of `globals.css`, which are removed last.
