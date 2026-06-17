2# Ideal photo sizes for hacpix

The home hero shows the **whole image** (no cropping), so empty bars only disappear
when an image's shape matches the **screen's** shape. Screens differ, so the practical
approach is to standardize on the most common desktop shape — **16:9** — and upload at
the ratios below.

## Recommended upload sizes

| Use | Aspect ratio | Recommended pixels | Notes |
|-----|-------------|--------------------|-------|
| **Landscape** (shown single) | **16:9** (1.78:1) | **2560 × 1440** (min 1920×1080; 3840×2160 for 4K) | Fills a 16:9 screen edge-to-edge |
| **Portrait** (shown as a pair) | **4:5** (0.8:1) | **1600 × 2000** (min 1080×1350) | Two side-by-side ≈ fills the width; slim edges only on 16:9 |
| **360° panorama** | any wide (2:1+) | long edge ~3840 px | It pans, so ratio doesn't matter |

### Why 4:5 for portraits
Two portraits side by side fill the screen when each one's ratio = (screen ratio) ÷ 2:
- 16:9 screen → 8:9 (almost square — not a natural portrait)
- 16:10 laptop → 4:5
- 3:2 laptop → 3:4

**4:5 is the sweet spot:** a normal, attractive portrait crop that pairs well and leaves
only thin edges on 16:9.

## File guidance
- Format: **JPEG**, quality ~80, **sRGB** color.
- Long edge ~**2560 px** for hero/full-screen images.
- Keep each file roughly **300 KB – 1 MB** so pages load fast.
- Leave a little breathing room around the subject (the hero applies a gentle zoom;
  paired portraits hug the centre).
- **Gallery / series pages accept any ratio** on purpose — mixed shapes are the look
  there. This guidance is mainly for hero images and the framed-print samples (4:5 crop).

## Optional tightening (ask if you want these)
1. If all landscape hero shots are 16:9, switch landscape slides to **fill mode** → zero
   bars on 16:9 (tiny crop only on odd-shaped screens).
2. Add a check to `generate_manifest.py` that **warns** when a hero image isn't ~16:9 or ~4:5.
