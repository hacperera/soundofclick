# 5 — SEO, Social Cards, LQIP & Prints/Licensing

A grab-bag of high-impact, lower-effort wins. Do these once the foundation
(images, hosting) is in place. Several consume data produced earlier (captions/
keywords from doc 04, LQIP/dimensions from doc 01).

---

## 5a — Open Graph / social cards + schema.org SEO

**Goal:** when someone shares a gallery or post link on WhatsApp / Instagram /
Facebook / X / Slack, it shows a rich preview (image + title + description) instead
of a bare URL — and Google understands the pages better.

### Open Graph + Twitter cards

Add per-page `<meta>` tags in `<head>`. Today every page has only a generic
`description`. Add:

```html
<meta property="og:title" content="Landscape — hacpix | Chaminda Perera">
<meta property="og:description" content="A selection of landscape photography…">
<meta property="og:image" content="https://hacpix.com/photos_Landscape/_web/COVER-1280.jpg">
<meta property="og:type" content="website">
<meta property="og:url" content="https://hacpix.com/series.html#landscape">
<meta name="twitter:card" content="summary_large_image">
```

- For series pages (`series.html`), set these **dynamically in `js/main.js`** when
  the album loads (title + the album cover as `og:image`). Note: some scrapers
  don't run JS — for the most important pages (home, about), put static OG tags in
  the HTML; for per-album, dynamic is a good-enough improvement, and a prerender/
  static-per-album approach can come later (or via Astro).
- `og:image` should be an absolute `https://` URL (needs hosting, doc 02) and
  ideally ~1200×630-ish; the 1280px `_web` variant works well.

### schema.org structured data (JSON-LD)

Help Google show your work in image/visual search. Add a `<script type="application/ld+json">`:

- On the home/about pages: a **Person** / **ProfilePage** describing Chaminda
  Perera (name, job title, sameAs links to Instagram/Facebook).
- On series pages: an **ImageGallery** with `associatedMedia` **ImageObject**
  entries (use the AI `caption` as `caption`, `keywords` from doc 04).

### Plumbing

- Add a `<title>` and `<meta name="description">` per page (most are generic now).
- Generate a **`sitemap.xml`** (list home, gallery, each series, blog, posts) and a
  **`robots.txt`** pointing to it. The build step can emit these from
  `GALLERY_DATA` + `POSTS`.
- Submit the sitemap in **Google Search Console** after hosting.

---

## 5b — LQIP blur-up placeholders

**Goal:** images fade in from a tiny blurred preview instead of popping in or
showing blank space — a small touch that makes the site feel premium and hides
slow loads.

The `lqip` data-URI is already produced by the image build step (doc 01). To use it:

1. Wrap each image; set the `lqip` as a blurred CSS background on the wrapper.
2. Reserve space with the known `aspect-ratio` (from `w`/`h`) so there's **no
   layout shift**.
3. When the real image's `load` event fires, fade it in over the blur
   (`opacity` transition) and drop the placeholder.

```css
.ph { position: relative; background-size: cover; filter: blur(0); }
.ph img { opacity: 0; transition: opacity .5s ease; }
.ph img.loaded { opacity: 1; }
```

```js
img.addEventListener("load", () => img.classList.add("loaded"));
```

Pair with `loading="lazy"` (already used) so off-screen images don't download
until needed.

---

## 5c — Prints / licensing checkout (no backend)

**Goal:** sell prints or license images directly. You already have a
`PRINTS_DATA` structure in `js/images.js` and a prints UI scaffold — wire it to a
hosted checkout. All options below work on a **static site** (no server to run).

### Options (pick one)

| Provider | Best for | How it works |
|---|---|---|
| **Gumroad** | Simplest digital/licensing sales | Create a product, embed a "Buy" overlay button. Handles payment + delivery. |
| **Stripe Payment Links / Buy Button** | Direct card payments, you fulfill | Create a Payment Link per product (or the embeddable Buy Button); paste it on the print. Stripe hosts checkout. |
| **Shopify Buy Button** | Physical print catalog, inventory, shipping | Lightweight Buy Button embed; Shopify manages orders/fulfillment. |
| **Print-on-demand (Prodigi / Printful)** | Hands-off physical prints | They print + ship per order; integrate via their checkout/links. |

**Recommendation:** start with **Stripe Payment Links** (digital license or
"contact to order" prints) or **Gumroad** for licensing — both are zero-backend and
take minutes. Move to Shopify or a POD service when you want a real physical
catalog with shipping.

### Wiring

- Add a `price` / `buyUrl` (and optional `sku`) to each entry in `PRINTS_DATA`.
- In the print UI, render a "Buy print" / "License" button linking to the
  provider's hosted checkout (or opening their embed/overlay).
- For licensing inquiries you don't want to fully automate, a simple "Request
  license" mailto/contact form is a fine v1.

> Note: this introduces an outward-facing commerce flow — test with the provider's
> test mode before going live, and make sure pricing/terms are correct.

---

## Suggested order within this doc

1. **5a SEO/social** — biggest reach win; do right after hosting.
2. **5b LQIP** — quick polish once doc 01 is done (the data already exists).
3. **5c prints** — when you're ready to monetize.

> Each of these is a contained change — tell me which one and I'll implement it
> (the OG/JSON-LD injection, the LQIP fade, or the checkout wiring).
