# 1 — Image Optimization Build Step

**Goal:** stop shipping full-resolution originals. Generate resized, modern-format
(AVIF + WebP + JPEG fallback) variants for every photo, plus tiny blur-up
placeholders and image dimensions, and serve them with `srcset` so each device
downloads only what it needs. Expect pages to load several times faster.

This extends the tool you already have: `generate_manifest.py`.

---

## Part A — Your question: what sizes/format/resolution to export when editing?

You asked whether optimization includes producing the right size during editing.
**Yes — there are two layers, and keeping them separate is the key idea:**

### Layer 1 — Your master export (manual, in Lightroom/Photoshop/etc.)

Keep your RAW/master files archived separately. For the website, export **one
high-quality "web master" per photo** and drop it into the `photos_*` folders.
The build step (Layer 2) downscales from there — so export **once, large**, and
never hand-make multiple sizes.

Recommended web-master export settings:

| Setting | Value | Why |
|---|---|---|
| **Color space** | **sRGB** | Non-negotiable for web. AdobeRGB/ProPhoto look dull/wrong in browsers. This is the #1 cause of "my colors look flat online." |
| **Long edge** | **3840 px** | Enough for 4K/retina full-screen hero use; the build step makes everything smaller. Landscape *and* portrait: constrain the **long** edge, let the short edge fall where it may — handles both shapes with one rule. |
| **Format** | JPEG | Universal master; build step converts to AVIF/WebP. |
| **Quality** | ~90 | High enough that re-compression to AVIF/WebP stays clean. |
| **Sharpening** | "Screen", standard | Output sharpening for displays. |
| **Metadata** | Keep (incl. GPS) | The build step reads GPS/EXIF for the map (doc 03), then strips it from the delivered files. |

> Don't crop to fixed aspect ratios for the gallery — the masonry layout uses each
> photo's natural shape. Just constrain the long edge.

### Layer 2 — Web variants (automatic, the build step below produces these)

From each web master, the script generates these long-edge sizes (works for both
orientations — long edge constrained, aspect preserved):

| Variant | Long edge | Used for |
|---|---|---|
| `thumb` | 640 px | Gallery grid / category cards / map popups |
| `medium` | 1280 px | Smaller screens, mid-DPI |
| `large` | 2048 px | Lightbox / full view on most screens |
| `xl` | 3840 px | Hero & full-screen on 4K/retina (skipped if master is smaller) |

Each size is written in **AVIF** (best compression), **WebP** (broad support), and
**JPEG** (universal fallback). The browser picks the best it supports via
`<picture>`/`srcset`, and the smallest size that fits the slot.

**Quality targets** (visually lossless for photography): AVIF ~55, WebP ~80,
JPEG ~82. Tune later if you want smaller files.

### 360° panoramas are special

Equirectangular panoramas wrap 360°, so they must stay wide or detail smears.
**Don't** push them through the standard 640–2048 ladder. Instead:

- Keep a single equirectangular web version at **max ~5400 px wide** (2:1), AVIF +
  WebP + JPEG. (Pannellum loads the whole image as one texture; ~5400px balances
  quality vs. load time. Going above ~8000px risks mobile GPU texture limits.)
- Optionally also emit a small flat **preview** (1280px) for the gallery thumbnail
  before the viewer opens.

The build step detects the `photos_360/` folder and applies this rule
automatically.

---

## Part B — The build step

### Prerequisites

Pillow does the work. On this machine it's already installed (12.2.0) and both
WebP and AVIF encode successfully — verified. On any machine that runs the build:

```bash
pip install --upgrade Pillow
# AVIF needs Pillow >= 11.3 built with libavif. If `im.save("x.avif")` errors,
# install the plugin as a fallback:
pip install pillow-avif-plugin   # then `import pillow_avif` once at startup
```

### What the script produces

```
photos_Landscape/_E2A7174.jpg                 # your web master (input, untouched)
photos_Landscape/_web/_E2A7174-640.avif        # generated variants
photos_Landscape/_web/_E2A7174-640.webp
photos_Landscape/_web/_E2A7174-640.jpg
photos_Landscape/_web/_E2A7174-1280.avif
... (1280, 2048, 3840 × avif/webp/jpg) ...
```

…and an enriched `js/images.js` where each image is an **object** instead of a
bare filename:

```js
{
  "file": "_E2A7174.jpg",
  "w": 3840, "h": 2560,            // natural dimensions → set aspect-ratio, kills layout shift
  "lqip": "data:image/webp;base64,UklGR...",   // tiny blurred placeholder
  "variants": [640, 1280, 2048, 3840],
  "geo": { "lat": 6.9, "lng": 79.8 }            // only if GPS present (doc 03)
}
```

### Incremental & safe

- Skip a photo if its variants already exist and the source `mtime` is unchanged
  (so re-runs are fast).
- Never modify or delete the source masters — only write into `_web/`.
- Add `_web/` to deploy as static assets (they're just images).

### Front-end change

`js/main.js` currently does `imgPath(folder, file)` and sets `img.src`. Update the
tile/lightbox/hero builders to emit a `<picture>` with `srcset`:

```html
<picture>
  <source type="image/avif" srcset="photos_X/_web/NAME-640.avif 640w, …-1280.avif 1280w, …-2048.avif 2048w" sizes="(max-width:700px) 100vw, 33vw">
  <source type="image/webp" srcset="photos_X/_web/NAME-640.webp 640w, …">
  <img src="photos_X/_web/NAME-1280.jpg" width="3840" height="2560" loading="lazy" alt="…">
</picture>
```

The `width`/`height` (or CSS `aspect-ratio` from `w`/`h`) prevents layout shift as
images load. The `lqip` string can be set as a blurred CSS background that the
sharp image fades over (see doc 05 for the LQIP fade).

### Implementation outline for `generate_manifest.py`

Add a function that, per image:

1. Open with Pillow, read `naturalWidth/Height` and EXIF (apply orientation,
   extract GPS for the manifest).
2. Convert to sRGB if the embedded profile isn't already sRGB.
3. For each target long-edge ≤ the source long edge: resize (Lanczos) and save
   `.avif` / `.webp` / `.jpg` into `_web/`.
4. Generate the LQIP: resize to ~24px long edge, save as WebP, base64-encode into
   a `data:` URI.
5. For `photos_360/`: emit the single wide equirectangular set instead.
6. Emit the enriched object into `images.js`.

> When you're ready to implement, ask and I'll write the actual code into
> `generate_manifest.py` and update the `js/main.js` builders — it's a
> well-scoped change.

---

## Acceptance check

- A landscape and a portrait photo each render from `_web/` variants (check
  DevTools → Network: the grid loads the 640px file, the lightbox the 2048px).
- Total page weight on the gallery drops dramatically vs. today.
- No layout shift as images load (dimensions are set).
- 360 images still open correctly in the viewer from their wide variant.
