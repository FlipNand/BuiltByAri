# BuiltByAri — style guide

The rules behind the site. If a value is not here and not in `src/styles/tokens.css`,
it does not belong in the UI.

---

## 1. What this design is trying to be

A printed sheet, not a web template. The studio flyer supplies the vocabulary:
heavy condensed caps, off-white paper, black ink, hairline rules, and one pale
blue accent used sparingly. Everything is left-aligned to a 12-column grid, and
every section is separated by a single hairline — the page should read like a
well-set page of type.

Three consequences worth respecting:

1. **Type carries the design.** No gradients, no glass, no drop shadows beyond a
   faint lift on hover. Display type is the loudest element on every page.
2. **Rules do the separating.** Sections, table rows, list items and nav items are
   divided by 1px `--color-line` rules rather than by boxes or backgrounds.
3. **Whitespace is structural.** Vertical rhythm comes from one spacing scale.
   Nothing is nudged by eyeballed pixels.

## 2. Colour

All colour lives in `src/styles/tokens.css`. Raw hex or `rgb()` values are banned
elsewhere in CSS — `tests/design-tokens.test.ts` fails the build if one appears.

| Token                     | Value                | Used for                                      | Contrast |
| ------------------------- | -------------------- | --------------------------------------------- | -------- |
| `--color-paper`           | `#f4f2ed`            | Page ground                                   | —        |
| `--color-paper-raised`    | `#faf8f4`            | Cards, inputs                                 | —        |
| `--color-paper-sunken`    | `#e9e5dc`            | Table stripes, disabled fills                 | —        |
| `--color-ink`             | `#0c0c0b`            | Text, rules, primary buttons                  | 17.49:1 on paper |
| `--color-ink-soft`        | `#57544d`            | Secondary body copy                           | 6.75:1 |
| `--color-ink-faint`       | `#86827a`            | **Decorative only** — big numerals, markers   | 3.42:1 |
| `--color-line`            | `#d8d3c8`            | Hairlines, input borders                      | —        |
| `--color-tint`            | `#dee8f2`            | "Recommended" badge only                      | —        |
| `--color-tint-ink`        | `#1c3b58`            | Text on tint                                  | 9.32:1 |
| `--color-danger`          | `#98231a`            | Validation errors                             | 7.25:1 |
| `--color-success`         | `#17513a`            | Success status                                | 8.25:1 |

Alpha tokens (`--color-ink-wash`, `--color-paper-wash-*`) exist for hover fills and
rules on dark bands. They are composited over known backgrounds and tested for
contrast where they carry text.

**Rules**

- Never introduce a new colour for a one-off. Add a token, document it here, and
  add it to the contrast test.
- `--color-ink-faint` may only be used for decoration (section numerals, list
  markers). Never for copy.
- On `.on-ink` surfaces, focus rings flip to `--color-focus-inverse`.

## 3. Typography

Two families, one hierarchy, seven sizes.

| Family | Role | Weights | Notes |
| --- | --- | --- | --- |
| **Anton** | Display, uppercase | 400 only | Wordmark, h1/h2, section titles, prices, numerals. Never below 18px, never for body copy. |
| **Inter** | Interface + body | 400, 500, 600 (variable) | Everything else. `-0.011em` tracking on body, `0.14em` on micro labels. |

| Token | Size | Leading | Used for |
| --- | --- | --- | --- |
| `--text-display-xl` | `clamp(3.25rem, 11.5vw, 8.5rem)` | 0.88 | Home hero only |
| `--text-display-lg` | `clamp(2.75rem, 7.5vw, 5.5rem)` | 0.88 | Interior page h1, CTA band |
| `--text-display-md` | `clamp(2.125rem, 5vw, 3.5rem)` | 0.88 | Section titles, 404 title |
| `--text-display-sm` | `clamp(1.625rem, 3.2vw, 2.25rem)` | 0.88 | Service and plan titles |
| `--text-title` | `clamp(1.25rem, 2vw, 1.5rem)` | 1.14 | Card and step titles |
| `--text-lead` | `clamp(1.0625rem, 1.55vw, 1.3125rem)` | 1.65 | Section intros, hero lead |
| `--text-body` | `1rem` | 1.65 | Body copy |
| `--text-small` | `0.9375rem` | 1.65 | Dense copy, form labels, errors |
| `--text-meta` | `0.75rem` | 1.35 | Eyebrows, captions, legal meta |

**Rules**

- Display type is always `text-transform: uppercase` with `--tracking-display`.
- One `h1` per page, set in Anton at `--text-display-*`.
- Never skip a heading level; tests enforce it.
- Micro labels (`.eyebrow`, footer headings, meta) are uppercase with
  `--tracking-meta` and `--weight-medium`.
- Measure caps at `--measure` (68ch) for prose and `--measure-narrow` (46ch) for
  centred statements.

## 4. Space and layout

A 4px base, ten steps, used by name — never by raw pixel.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-2xs` | 4px | Icon-to-text gap |
| `--space-xs` | 8px | Label-to-input, tight stacks |
| `--space-sm` | 12px | Button padding, compact rows |
| `--space-md` | 16px | Default gap |
| `--space-lg` | 24px | Field spacing, card padding |
| `--space-xl` | 32px | Inner card padding, blocks |
| `--space-2xl` | 48px | Subsection separation |
| `--space-3xl` | 64px | Large blocks |
| `--space-4xl` | 96px | Section internals |
| `--space-5xl` | 128px | Rare, very large blocks |

Section vertical padding is `--section-pad-block` (`clamp(4rem, 8vw, 7.5rem)`);
compact sections use `--section-pad-block-sm`.

**Grid**

- 12 columns, `--container-max: 1360px`, `--container-pad: clamp(1.25rem, 4vw, 2.5rem)`,
  `--grid-gap: clamp(1rem, 2vw, 2rem)`.
- Editorial pattern: eyebrow in columns 1–3, headline from column 4, intro also
  from column 4 on its own row.
- Content columns never exceed 8 of 12 for prose.
- Hairlines separate cells rather than padding tricks: `.services` cells carry
  `border-left`, and rows carry `border-top`.

**Breakpoints** (max-width queries, 1px below the min-width neighbour)

| Width | Change |
| --- | --- |
| 480px | Buttons go full width |
| 600px | Services, form rows, process and footer columns stack |
| 740px | Pricing plans stack |
| 900px | Desktop nav appears; disclosure menu is removed |
| 960px | Split layouts and hero columns stack |
| 1024px | Services drop from 4 to 2 columns |

## 5. Components

### Buttons (`.btn`)

| Variant | Look | Use |
| --- | --- | --- |
| `.btn--primary` | Ink fill, paper text | The single main action per view |
| `.btn--ghost` | 1px ink border, transparent | Secondary action next to primary |
| `.btn--quiet` | Text with 1px underline, arrow | Inline "read more" style links |
| `.btn--block` | Full width | Inside plans and mobile CTAs |
| `.btn--sm` | Shorter padding, meta size | Header CTA only |

States are uniform:

| State | Behaviour |
| --- | --- |
| Hover | Primary lightens to `--color-ink-hover` + soft lift; ghost fills with `--color-ink-wash`; arrow icon slides 3px |
| Focus-visible | 2px outline, 3px offset (paper on dark bands) |
| Active | 1px downward shift, darker fill |
| Disabled | 50% opacity, `cursor: not-allowed`, no transform, `aria-busy` on submit |

Minimum height is `--target-min` (44px) on every variant.

### Links

Body links are underlined with `text-underline-offset: 0.22em`. Navigation links
use an animated 1px underline that scales in from the left; `aria-current="page"`
keeps it permanently visible. Hover never *removes* an affordance.

### Plans (`.plan`)

Two cards, equal columns (stacked under 740px). The yearly plan is inverted:
ink background, paper text, tint badge. Feature lists use the check icon at 1em
with a 0.3em optical top offset. The CTA is pinned with `margin-top: auto` so both
cards align at the bottom.

### Table (`.table`)

Semantic `<table>` with `<caption>`, `<thead>`, `scope="col"` and `scope="row"`.
Wrapped in `.table-wrap` for horizontal scroll on narrow screens (min-width 34rem).
Row hover is a 2.5% ink wash.

### FAQ (`.faq`)

Native `<details>/<summary>` — no JavaScript. Summary rows are 15px–20px type,
`--space-lg` padding, and a plus icon that rotates 45° when open. The whole row is
the target, not just the text.

### Forms

- `label` for every control, always visible; optional fields say "(optional)".
- Hints use `.field__hint` in `--color-ink-soft`; hint and error ids are both in
  `aria-describedby`.
- Inputs: 48px min height, `--color-paper-raised`, 1px `--color-line`, 2px radius.
  Hover darkens the border; focus-visible draws the global ring plus an ink border.
- Errors: `.field--invalid` adds a danger border and wash, reveals `.field__error`
  (icon + text), and sets `aria-invalid="true"`. Colour is never the only signal.
- Status: one `.form-status` component, `role="status"`, `tabindex="-1"`, focus on
  result, success in green with a check, failure in red with an alert icon.
- Honeypot: `.form__honeypot` sits off-canvas inside `[aria-hidden="true"]`, with
  `tabindex="-1"` and `autocomplete="off"`. It is the one control with no visible
  label, no error slot and no place in the tab order — never reuse the pattern for
  a real field.

### Header and navigation

- Sticky, paper background, hairline bottom border; a soft shadow appears only
  after 8px of scroll (`data-scrolled`).
- Desktop nav: uppercase 12px, 0.1em tracking, 44px targets, `aria-current` set at
  build time.
- Mobile: native `<details>` disclosure labelled Menu/Close, full-height panel,
  scroll lock and Escape handling from `mobile-nav.ts`.

### Studio card (`.studio-card`)

The flyer's black contact block, reused on About. Ink panel, Anton wordmark, a
one-line description, a definition list of facts separated by paper-wash rules,
and a full-width arrow link.

### 404

Display numeral at `clamp(6rem, 26vw, 17rem)`, a plain-language explanation, and a
rule-separated list of recovery links.

## 6. Icons

- One sprite: `public/icons.svg`.
- 24×24 grid, 1.5px stroke, round caps and joins, `fill: none`, `currentColor`.
- Size with the `.icon` class (1.25rem) and override with `width`/`height` only.
- Decorative icons always `aria-hidden="true"`; never put text inside an icon.
- New icons must reuse the 1.5px stroke and 24px grid, or they will look off next
  to the others. Tests verify every referenced id exists in the sprite.

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 140ms | Colour, border, opacity |
| `--duration-base` | 220ms | Transforms, underline reveal |
| `--duration-slow` | 520ms | Status message entrance |
| `--ease-out` | `cubic-bezier(.22,.61,.36,1)` | Default |
| `--ease-in-out` | `cubic-bezier(.65,.05,.36,1)` | Symmetric moves |

Animate `transform`, `opacity`, colour and borders only. Under
`prefers-reduced-motion: reduce` all durations collapse to 1ms and smooth scrolling
is turned off — no exception.

## 8. Accessibility rules

1. Focus ring: 2px, 3px offset, never removed. Inverse on dark surfaces.
2. Minimum target: 44×44px (`--target-min`).
3. Contrast: 4.5:1 for text under 24px; 3:1 for large display type and UI borders.
4. Every state is announced: `aria-expanded` (native on `<details>`),
   `aria-current`, `aria-invalid`, `aria-describedby`, `role="status"`.
5. Errors are text + icon + colour, and focus moves to the first invalid control.
6. Decorative art is `aria-hidden`; images carry real `alt` and dimensions.
7. Headings never skip levels; landmarks are labelled.
8. Content must work at 320px wide, 200% zoom, and with JavaScript off.

## 9. Code conventions

- **File responsibilities:** tokens → base → layout → components → utilities. Do
  not add component styles to `utilities.css`.
- **Naming:** BEM-ish blocks (`.plan`, `.plan__price`, `.plan--featured`). Utilities
  are the only single-purpose classes.
- **Docs:** every JS module opens with a short block comment explaining *why* it
  exists, plus JSDoc on exported functions. CSS files have a header stanza.
- **Tokens only:** if you need a number, name it in `tokens.css` first.
- **Tests:** pure logic testable without DOM belongs in `src/js/lib/`.

## 10. Adding things

**A new page**

1. Create `page-name/index.html` copying the `<head>` pattern (title, description,
   canonical, OG tags, font preloads).
2. Set `<body data-page="page-name">` and include the header and footer partials.
3. Add the route to `vite.config.ts` `rollupOptions.input`, to `PAGES` in
   `tests/pages.test.ts`, and to `public/sitemap.xml`.
4. Give it one `h1`, labelled sections, and a nav entry with `data-nav="page-name"`.

**A new token**

Add it under the right category in `tokens.css`, document it in the table above,
and — if it is a colour that carries text — add a contrast pair to
`tests/design-tokens.test.ts`.

**A new icon**

Add a `<symbol>` to `public/icons.svg` on the 24px grid with 1.5px strokes, then
reference it with `<use href="/icons.svg#name" />` inside an `aria-hidden` svg.

## 11. Pre-launch checklist

- [ ] `npm run build` clean (typecheck + build)
- [ ] `npm run test:coverage` passes thresholds
- [ ] Every page checked at 320, 390, 768, 1024, 1440px — no horizontal scroll
- [ ] Keyboard-only pass: skip link, nav, form, FAQ, menu
- [ ] VoiceOver pass on the contact form (errors, success, busy state)
- [ ] Browser console clean on every page (production build, not dev)
- [ ] `prefers-reduced-motion` and 200% zoom spot-checked
- [ ] Domain, phone, email and prices updated everywhere (see README)
- [ ] Privacy policy and terms reviewed by a lawyer
