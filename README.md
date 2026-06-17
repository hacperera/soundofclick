# hacpix — Chaminda Perera Photography

An immersive, cinematic photography portfolio. A full-screen rotating hero
(Stephen Wilkes style) opens into a scrolling narrative, with a Bryan Minear–style
masonry gallery and Choiberg-style blog / about / contact pages.

Pure static HTML + CSS + JavaScript — **no build step, no dependencies.**

## Run it locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Open `index.html` via a server, not by
double-clicking — the galleries load images from a manifest the browser needs to fetch.)

## Pages

| File           | Purpose                                                            |
|----------------|--------------------------------------------------------------------|
| `index.html`   | Home — full-image hero (with 360° pans + fullscreen screensaver), intro, galleries, In Motion reel, framed-print services, CTA |
| `gallery.html` | Series index — each series links to its own immersive page         |
| `series.html`  | One series as a clean masonry scroll + lightbox (`series.html#id`)  |
| `blog.html`    | Journal grid (data-driven from `js/posts.js`)                      |
| `post.html`    | Single blog post (`post.html?slug=…`)                              |
| `about.html`   | About Chaminda Perera                                              |
| `contact.html` | Contact details + working form (via FormSubmit → hacperera@gmail.com) |
| `admin.html`   | **hacpix Studio** — local control panel for posts / media / messages |

See **`DASHBOARD.md`** for how to turn this into a true online dashboard once published.

## Adding / changing photos

1. Drop images into the relevant `photos_*` folder (or create a new `photos_Xxx` folder).
2. Regenerate the gallery manifest:

   ```bash
   python3 generate_manifest.py
   ```

3. Refresh the browser. That's it — galleries, filters, the hero and the home-page
   category cards all update automatically.

New `photos_*` folders are picked up automatically. To control display names and
ordering, edit `CATEGORY_META` in `generate_manifest.py`.

- **Videos** go in `Video/` — orientation (portrait/landscape) is auto-detected.
- **Print samples** (optional): create a `prints/` folder; its images appear in the
  framed "Prints, licensing & commissions" section. Without it, curated photos are used.
- **Blog posts**: edit `js/posts.js` by hand, or use `admin.html` to write a post and
  download a fresh `posts.js`.

## Customising

- **Colours / fonts / spacing** — CSS variables at the top of `css/style.css`.
- **Hero images** — by default it pulls from Landscape / Aerial / Astro / Nature;
  change `preferred` in `js/main.js` (`initHero`).
- **Contact form** — `contact.html` posts to FormSubmit; swap the `action` URL for
  another provider if you prefer. First submission sends a one-time confirmation email.
- **Social links** — replace the `#` hrefs in the footers (Instagram / Facebook).

## Files

```
index.html, gallery.html, series.html, blog.html, post.html, about.html, contact.html
admin.html             local "Studio" control panel
DASHBOARD.md           guide to a true online dashboard
css/style.css          all styling
js/main.js             hero, screensaver, galleries, prints, videos, blog, lightbox
js/images.js           AUTO-GENERATED manifest (photos + videos + prints)
js/posts.js            blog post content (edit by hand or via admin.html)
generate_manifest.py   scans photos_*, Video/, prints/ and writes js/images.js
photos_*/              your image folders
```

## Deploying

Any static host works — Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3.
Just upload the whole folder. Note that some hosts are case-sensitive, so keep the
`.JPG` / `.jpg` extensions exactly as they are on disk (the manifest preserves them).
