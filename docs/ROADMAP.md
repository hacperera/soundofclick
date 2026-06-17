# hacpix — Development Roadmap

Living plan for evolving the site. Each numbered initiative has its own doc in
this folder with concrete, step-by-step instructions. Work top-to-bottom — the
order is chosen so each phase builds on the previous one.

_Last updated: 2026-06-17 · Owner: Chaminda Perera_

---

## Where the site is today

- Static site (plain HTML/CSS/JS), no build step, no framework. Fast and simple.
- Galleries are driven by `js/images.js`, generated from the photo folders by
  `generate_manifest.py`.
- **Done already:** full-bleed hero (`object-fit: cover`), 360° album opens an
  interactive Pannellum viewer, 360° panoramas play live in the home hero cycle,
  viewer controls bottom-right, a per-photo location mini-map in the 360 viewer.
- **Known gap:** the 360 map coordinates in `js/pano-locations.js` are
  placeholders (Colombo/Kandy) — real locations still to be filled in.
- Currently served locally for testing via `python3 -m http.server` (the 360
  viewer needs http://, not file://).

---

## The phased plan

| # | Initiative | Why it's here | Effort | Doc |
|---|------------|---------------|--------|-----|
| 1 | **Image optimization build step** | Biggest performance win. Your originals are multi-MB; visitors download full-res. Generate responsive AVIF/WebP + blur-up placeholders. | M | [01-image-optimization.md](01-image-optimization.md) |
| 2 | **Real hosting (Cloudflare Pages / Netlify)** | Kills the `file://` workaround, gives HTTPS + global CDN + a custom domain, makes sharing trivial. | S | [02-hosting.md](02-hosting.md) |
| 3 | **Site-wide photo map + 360 virtual tours** | Signature feature for a location photographer. Replaces the placeholder coords; links panoramas into walkable tours. | M | [03-photo-map-and-360-tours.md](03-photo-map-and-360-tours.md) |
| 4 | **AI captioning, search & blog drafts (Claude)** | Auto alt-text/captions/keywords (accessibility + SEO + hours saved), natural-language photo search, AI-assisted blog drafts. | M–L | [04-ai-pipeline.md](04-ai-pipeline.md) |
| 5 | **SEO, social cards, prints/licensing, LQIP polish** | Make shared links look great, get found on Google, and turn the existing `PRINTS_DATA` into a revenue path. | S–M | [05-features-seo-prints.md](05-features-seo-prints.md) |

Effort key: **S** ≈ an afternoon · **M** ≈ a day or two · **L** ≈ several days.

---

## Recommended sequence & rationale

1. **Image optimization first.** It's invisible but foundational — every other
   feature (hosting bandwidth, map thumbnails, AI inputs) benefits from smaller,
   sized images. It also extends the tool you already have (`generate_manifest.py`).
2. **Hosting second.** Once images are light, deploy. This is where the site
   stops being a local-only thing and becomes a real website.
3. **Map + 360 tours third.** The "wow" features, built on geodata extracted in
   step 1 and served properly in step 2.
4. **AI pipeline fourth.** Needs an API key and a little Python, but it slots into
   the same manifest workflow and supercharges SEO + search.
5. **SEO/prints/LQIP last.** Polish and monetization once the foundation is solid.

You can reorder — e.g. do hosting (#2) before optimization (#1) if you just want
the site live today — but the sequence above minimizes rework.

---

## Cross-cutting principles

- **Stay static for now.** Everything here works on a static host (no server).
  If hand-editing HTML becomes painful later, consider migrating to **Astro**
  (built-in image optimization, components instead of copy-pasted nav/footer) —
  noted as a future option, not part of this plan.
- **Keep `generate_manifest.py` the single source of truth.** New per-photo data
  (dimensions, LQIP, geo, AI captions) should land in the generated manifest so
  the front-end stays declarative.
- **Don't commit secrets.** The AI pipeline uses an API key via environment
  variable — never hardcode it (see doc 04).

---

## Progress tracker

- [x] 1. Image optimization build step _(done 2026-06-17 — `generate_manifest.py` now
  generates AVIF/WebP/JPEG variants + LQIP + dimensions + EXIF GPS into `js/images.js`
  as `window.MEDIA`; `js/main.js` renders responsive `<picture>`/`srcset`; 360 viewer
  loads a sized wide variant. Workflow: run `python3 generate_manifest.py` after adding
  photos; commit the `_web/` folders + `images.js`.)_
- [x] 2. Real hosting _(done 2026-06-17 — repo github.com/hacperera/soundofclick;
  auto-deploys to Netlify at https://dashing-pudding-2c0a43.netlify.app. Verified
  pages + AVIF/WebP variants + 360 webp serve over HTTPS.)_  · [ ] custom domain (optional)
- [ ] 3. Site-wide photo map
- [ ] 3b. 360 virtual tours with hotspots
- [ ] 4a. AI captioning & tagging
- [ ] 4b. Natural-language photo search
- [ ] 4c. AI-assisted blog drafts
- [ ] 5a. Open Graph / social cards + schema.org
- [ ] 5b. LQIP blur-up placeholders
- [ ] 5c. Prints / licensing checkout
