# Reliable IT Consulting — Website

Bilingual (English / 中文) static website for **Reliable IT Consulting**, a Seattle-area
network engineering company. Built to deploy directly to **Cloudflare Pages**.

- Zero-dependency static build (`node build.mjs`, no framework, no bundler)
- Content lives in JSON files — prices and copy can change without touching layout
- 16 pages: 8 in English + 8 in Simplified Chinese
- SEO: unique titles/descriptions, canonical + hreflang, Open Graph/Twitter cards,
  sitemap.xml, robots.txt, Organization/ProfessionalService/Service JSON-LD
- Mobile-first responsive design, keyboard-accessible nav, reduced-motion support

## Quick start

```bash
node build.mjs          # renders content/ + templates into dist/
cd dist && python3 -m http.server 8000   # preview at http://localhost:8000
```

Requires Node 18+ (uses only built-in modules).

## Deploy to Cloudflare Pages

**Option A — Git integration:** push this folder to a GitHub repo, then in
Cloudflare Dashboard → Pages → Create → Connect to Git:

- Build command: `node build.mjs`
- Build output directory: `dist`
- No environment variables needed.

**Option B — direct upload:** run `node build.mjs` locally and drag the `dist/`
folder into Pages → Create → Upload assets. Or:

```bash
npx wrangler pages deploy dist --project-name=reliable-it-consulting
```

The included `dist/_headers` sets security headers and asset caching.

## Inquiry form → email (`/api/inquiry`)

The Contact page has a native bilingual inquiry form. Submissions go to a
**Cloudflare Pages Function** (`functions/api/inquiry.js`) that emails the
inquiry to you via **Resend** and sends the visitor a confirmation email.
No Gmail address is exposed anywhere on the site.

### One-time setup

1. Create a free account at [resend.com](https://resend.com) and create an API
   key (Dashboard → API Keys). The free tier includes 100 emails/day.
2. In Cloudflare Dashboard → Pages → your project → **Settings → Variables and
   Secrets**, add (Production **and** Preview if you test preview URLs):
   - `RESEND_API_KEY` — the Resend API key (mark as **Secret**)
   - `INQUIRY_TO` — the mailbox inquiries go to, e.g. `you@yourcompany.com`
   - `INQUIRY_FROM` *(optional)* — a sender address on a domain you've verified
     in Resend, e.g. `inquiries@yourcompany.com`. If omitted, Resend's
     onboarding sender is used (delivers only to the Resend account owner's
     address — fine for testing, verify a domain for production).
3. Redeploy (or just wait — Pages picks up new variables on the next deploy;
   variables are read at request time).

### Behavior notes

- Validates required fields (name, email, phone, service, description), enforces a
  honeypot anti-spam check, and rate-limits 10
  submissions/IP/hour.
- Owner email sets `Reply-To` to the inquirer's address, so hitting reply
  reaches them directly.
- The confirmation email is bilingual (English/中文 follows the submitted form).
- Without JavaScript the form still works: the function returns a simple
  thank-you page.
- If the variables aren't set, submissions return a clear error instead of
  silently dropping the inquiry.
- Local testing of the function needs `wrangler pages dev dist` (the static
  `python3 -m http.server` preview can't run Functions).

## Configuration (`site.config.json`)

| Key | Purpose |
|---|---|
| `siteName` | Company name shown everywhere |
| `baseUrl` | **Change this to the real domain** — used for canonical URLs, sitemap, OG tags |
| `serviceCities` | Cities listed for local SEO + contact page |
| `serviceArea` | Used in JSON-LD `areaServed` |

## Updating content

All page copy lives in `content/en/*.json` and `content/zh/*.json`:

- `home.json`, `services.json`, `industries.json`, `network-care.json`,
  `about.json`, `contact.json`, `legal.json` (privacy + terms)
- `site.json` — nav labels, footer, CTA band (per locale)

To add a service: append an entry to the right category in
`content/en/services.json` **and** `content/zh/services.json`, then rebuild.
Each entry supports `id` (anchor link target, e.g. `#network-assessment`),
`name`, `price`, `priceNote`, `desc`, `bestFor`, `includes` (+`includesLabel`),
`technologies` (+`technologiesLabel`), and `cta`.

To add a page: add a content JSON, a `renderX` function + `PAGES` entry in
`build.mjs`, and a nav item in both `site.json` files.

## Project structure

```
site.config.json        site-wide settings (name, domain)
content/en|zh/*.json    all page content, per locale
build.mjs               templates + static site generator
functions/api/          Cloudflare Pages Functions (inquiry form → email)
assets/css/style.css    entire theme (mobile-first)
assets/js/main.js       mobile menu + inquiry form submit (2.5 KB)
assets/img/             hero, industries composite, about photo, favicon
dist/                   build output — this is what gets deployed
```

## Notes / open items

- **Inquiry email delivery**: the Contact form posts to `/api/inquiry`, which
  sends mail through Resend. Set `RESEND_API_KEY` + `INQUIRY_TO` in the Pages
  project's Variables and Secrets before launch (see "Inquiry form → email"
  above). No personal Gmail address appears on the site.
- **Domain**: `baseUrl` is currently a placeholder — update before launch.
  For the best sender reputation, also verify this domain in Resend and set
  `INQUIRY_FROM` to an address on it.
- **CCIE credential**: the spec listed a "CCIE-Certified" homepage item, but no
  certification was confirmed, so it was replaced with "Advanced Engineering
  Capability" (BGP/SD-WAN/cloud depth). If CCIE certification is held and
  cleared for advertising, it's a one-line change in `content/*/home.json`.
- Company name uses **Reliable IT Consulting** per your message (the spec's
  "Seattle Network Solutions" was its working name) — changeable in one line
  of `site.config.json`.
