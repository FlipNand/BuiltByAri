# BuiltByAri

The studio website for **BuiltByAri** — custom websites for local businesses across
Toronto and the GTA. Seven static pages, hand-written CSS, no runtime dependencies.

Live domain: **https://web.asteinberg.me**

---

## Stack

| Layer     | Choice                                          | Why                                                     |
| --------- | ----------------------------------------------- | ------------------------------------------------------- |
| Build     | Vite 6, multi-page static output                | Fast, no server code, deployable anywhere as files      |
| Language  | TypeScript (strict)                             | Typed DOM code and testable pure modules                |
| Styling   | Hand-written CSS, custom properties, `@layer`   | Full control, one token vocabulary, ~7 KB gzipped       |
| JS        | ~3 KB gzipped, no framework                     | Only nav, header state, year and form behaviour         |
| Fonts     | Self-hosted Anton + Inter (woff2, latin subsets)| No third-party requests, no layout shift from swaps     |
| Icons     | One inline SVG sprite, 1.5px strokes            | Consistent weight, no icon library payload              |
| Tests     | Vitest + jsdom, v8 coverage                     | Unit, DOM, structural/a11y and design-token checks      |

## Quick start

Requires Node 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script                 | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Dev server with hot reload                                |
| `npm run build`        | Typecheck, then build static output to `dist/`            |
| `npm run preview`      | Serve the built output at http://localhost:4173           |
| `npm test`             | Run the full test suite once                              |
| `npm run test:coverage`| Run tests with coverage and thresholds                    |
| `npm run typecheck`    | `tsc --noEmit` only                                       |

## Structure

```
├── index.html                 Home
├── services/index.html        Services, pricing, comparison table, FAQ
├── about/index.html           Studio story and principles
├── contact/index.html         Inquiry form and direct contact details
├── privacy/index.html         Privacy policy
├── terms/index.html           Terms of service
├── 404.html                   Custom not-found page
├── partials/                  Shared markup (header, footer, nav, plans, CTA)
├── api/contact.ts             Vercel Function: validates and emails an inquiry
├── public/                    Static assets copied as-is
│   ├── fonts/                 Anton + Inter woff2 (self-hosted)
│   ├── icons.svg              Icon sprite (24px grid, 1.5px stroke)
│   ├── favicon.svg            Geometric A monogram
│   ├── apple-touch-icon.png   180px home-screen icon
│   ├── og.png                 1200×630 social card
│   ├── robots.txt             Crawl policy + sitemap
│   ├── sitemap.xml            Indexable routes
│   └── _headers               Security + cache headers (CF Pages / Netlify)
├── src/
│   ├── js/
│   │   ├── main.ts            Entry: wires each module if its element exists
│   │   ├── lib/validation.ts  Pure validation rules and message copy (shared with the API)
│   │   └── modules/           header, mobile-nav, contact-form
│   └── styles/
│       ├── tokens.css         Every colour, size, space and motion value
│       ├── base.css           Fonts, reset, document defaults, focus ring
│       ├── layout.css         Container, section rhythm, section headers
│       ├── components.css     All UI components
│       ├── utilities.css      Small global helpers only
│       └── main.css           Entry, imports in layer order
├── tests/                     Vitest suites (see Testing)
├── tools/generate-assets.py   Regenerates og.png and apple-touch-icon.png
└── vite-plugins/              Build-time HTML include plugin
```

## How the HTML is put together

Every page is a complete static document — there is no client-side templating, so
the site works with JavaScript disabled and search engines see full content.

Shared blocks (header, footer, nav lists, pricing cards, CTA band) live in
`partials/` and are pulled in at build time:

```html
<!-- @include header.html -->
```

`vite-plugins/html-includes.ts` expands these during dev and build (nested
includes supported, depth-limited). It also reads `<body data-page="…">` and adds
`aria-current="page"` to the matching nav link, so the current page is announced
server-side rather than by JavaScript.

## Editing content

| What                          | Where                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| Phone, email, service area    | `partials/header.html`, `partials/footer.html`, `partials/cta-band.html`, `contact/index.html`, `privacy/`, `terms/` |
| Prices and plan features      | `partials/pricing-plans.html` (+ the studio card in `about/index.html`) |
| Home page sections            | `index.html`                                                  |
| FAQ, comparison table         | `services/index.html`                                         |
| Studio story, principles      | `about/index.html`                                            |
| Legal copy                    | `privacy/index.html`, `terms/index.html`                      |
| Page titles and descriptions  | `<head>` of each page — tests fail if they are missing or too long |

There is **no stock photography in the project**. The About page uses a typographic
studio card instead. If you add real project photos, export AVIF/WebP at roughly
100 KB, add `width`/`height`, `loading="lazy"`, and a real `alt`; the page tests
require the dimensions and alt text.

### Changing the domain

The domain appears in canonical links, Open Graph tags, the sitemap, robots.txt and
the generated social card. Update it in one pass:

```bash
grep -rl "web.asteinberg.me" --exclude-dir=node_modules --exclude-dir=dist . \
  | xargs sed -i '' 's/web\.asteinberg\.me/your-domain.com/g'
python3 tools/generate-assets.py   # re-renders og.png with the new address
```

## Contact form

The form is fully client-side:

- One validation pass on submit, then live re-validation of fields already flagged.
- A single error style everywhere: red rule, red text, `aria-invalid="true"`, error
  text linked with `aria-describedby`.
- Submit results (success or failure) go into one `role="status"` region that
  receives focus, so screen-reader users hear the outcome immediately.
- Focus moves to the first invalid field when submission is blocked.

**Delivery.** The form POSTs JSON to `/api/contact`, a Vercel Function that sends
the inquiry by email through Resend. Nothing is handed to the visitor's mail app,
so the message still arrives when they have no mail client configured.

```html
<form class="form" data-contact-form data-endpoint="/api/contact" novalidate>
```

Payload: `name`, `email`, `phone`, `business`, `project`, `message`, `consent`,
plus `botcheck` (a honeypot input hidden from sight, screen readers and the tab
order). Any non-2xx response is treated as a failure and the visitor keeps their
typed answers so they can retry.

The function re-runs the same validator the browser uses, drops honeypot hits
with a `200` so bots do not learn they were caught, caps the body at 16 KB and
returns `no-store` JSON. It needs `RESEND_API_KEY` in the environment:

| Variable             | Required | Purpose                                                        |
| -------------------- | -------- | -------------------------------------------------------------- |
| `RESEND_API_KEY`     | yes      | Sends the notification email                                    |
| `CONTACT_FROM_EMAIL` | no       | Verified sender, e.g. `BuiltByAri <hello@web.asteinberg.me>`     |
| `CONTACT_TO_EMAIL`   | no       | Recipient; defaults to `aristeinberg@icloud.com`                |

Until a domain is verified in Resend, the default sender
(`onboarding@resend.dev`) only delivers to the Resend account owner's address.
Verify `web.asteinberg.me` in Resend, then set `CONTACT_FROM_EMAIL`.

With no server (plain static hosting, `npm run preview`), the endpoint 404s and
the form shows its error state with the direct email address as a fallback. Use
`vercel dev` or a deployed preview to exercise the real path.

## SEO and metadata

- Per-page `<title>`, meta description, canonical URL and Open Graph/Twitter tags.
- `sitemap.xml` lists the four indexable routes; legal pages are `noindex, follow`.
- `404.html` is `noindex` and gives four ways back into the site.
- Tests assert canonical URLs, title/description length, heading order, and that
  every internal link resolves to a real page.

## Deployment

`npm run build` writes a fully static `dist/`. Upload that directory.

| Host             | Build command   | Publish dir | Notes                                                    |
| ---------------- | --------------- | ----------- | -------------------------------------------------------- |
| Cloudflare Pages | `npm run build` | `dist`      | Serves `404.html` automatically; reads `_headers`          |
| Netlify          | `npm run build` | `dist`      | Serves `404.html` automatically; reads `_headers`          |
| Vercel           | `npm run build` | `dist`      | Auto-detects `api/`; set env vars below; rewrite 404s      |
| GitHub Pages     | `npm run build` | `dist`      | Only at a domain root; add a `404.html` copy at the root   |

Paths are root-absolute (`/fonts/…`), so deploy at a domain root rather than a
subfolder. If you must use a subfolder, set `base` in `vite.config.ts` and update
the partials' links.

`public/_headers` sets a strict Content-Security-Policy plus long-lived caching for
hashed assets, fonts and images. Cloudflare Pages and Netlify read it; Vercel
ignores the file. If you add analytics, a chat widget or an off-site form
provider, extend the policy (and the privacy policy) in the same commit.

On Vercel the contact form needs two things set in **Project → Settings →
Environment Variables** for Production and Preview: `RESEND_API_KEY`, and
`CONTACT_FROM_EMAIL` once the sending domain is verified. The `api/` directory is
deployed as a function automatically because the project is detected as Vite;
the function imports the shared validator from `src/js/lib`, so it stays in sync
with the browser rules.

## Testing

```bash
npm test               # 249 tests
npm run test:coverage  # enforces 90% lines / statements, 85% branches
```

Coverage sits around 98% of statements with every function tested. The suites:

| File                       | Covers                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `validation.test.ts`       | Every rule, boundary and message in the form validator        |
| `contact-form.test.ts`     | Error rendering, focus order, live re-validation, busy state, POST payload, honeypot, failure states |
| `mobile-nav.test.ts`       | Scroll lock, Escape focus return, link close, breakpoint reset |
| `header.test.ts`           | Scroll state throttling, reduced-motion fallback, copyright year |
| `api-contact.test.ts`      | Payload coercion, email composition, honeypot, validation, Resend success/failure, missing key |
| `html-includes.test.ts`    | Include expansion, nesting, depth limit, current-page marker  |
| `pages.test.ts`            | Every page: language, meta, canonical, one h1, heading order, skip link, nav labels, accessible names, unique ids, icon references, contact details, legal links, form labelling |
| `design-tokens.test.ts`    | Token prefixes, no raw colours outside tokens, WCAG contrast pairs, 4px spacing scale, type scale |
| `main.test.ts`             | Entry point wiring with and without page elements             |

## Accessibility

Target: **WCAG 2.2 AA**.

- Colour pairs are checked by test (4.5:1 body text minimum); the muted grey is
  reserved for decorative use only.
- Visible 2px focus ring on every interactive element, flipping to paper on dark
  bands; `:focus-visible` so pointer users do not see it on click.
- 44px minimum target size for buttons, nav links and menu rows.
- Semantic landmarks, one `h1` per page, ordered headings, labelled `<nav>`s.
- Skip link is the first focusable element; `<main>` is programmatically focusable.
- Form errors are text plus icon, never colour alone, wired with `aria-describedby`.
- `prefers-reduced-motion` collapses all durations; smooth scrolling is disabled.
- SVG icons are `aria-hidden` unless they carry meaning.

Worth re-checking manually before launch: VoiceOver pass on the form, 200% zoom,
and `prefers-reduced-motion` on. Automated tests are necessary, not sufficient.

## Brand assets

- `public/og.png` and `public/apple-touch-icon.png` are generated:
  `python3 tools/generate-assets.py` (needs `pillow`).
- Fonts are OFL-licensed Anton and Inter, self-hosted woff2 latin subsets.
- The flyer's photographs were stock placeholders and are intentionally not used;
  replace the studio card with real project imagery when you have it.

## Legal pages

`privacy/` and `terms/` are written as working drafts for an Ontario studio
(PIPEDA-informed privacy, plain-language service terms). They describe how this
site and this business actually operate — no analytics, no ad cookies, 30-day
notice, client ownership — but they are **not legal advice**. Have a lawyer review
them before launch, especially the retention periods and liability cap.

## Known limitations

- No analytics is installed. The privacy policy says so; if you add analytics,
  update the policy, the `_headers` CSP and this file together.
- The contact form depends on the Vercel Function at `/api/contact`. Other hosts
  need an equivalent endpoint or a form service pointed at by `data-endpoint`.
- Honeypot plus server-side re-validation only; there is no captcha or per-IP rate
  limit. Add one if the inbox starts filling with spam.
- There is no portfolio section: rather than invent client work or metrics, the
  site describes what gets built. Add real case studies when they exist.
