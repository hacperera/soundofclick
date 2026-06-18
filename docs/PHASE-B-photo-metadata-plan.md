# Phase B — Photo Metadata Foundation & Long-Term Upload Workflow

_Lio Photography (Chaminda Perera) · plan of record · 2026-06-18_

This document is the reference for how photo information (location, camera
settings, story, collection, keywords) is added to the website — designed to
**scale to thousands of photos over years** with almost no manual typing on the
site. Keep it for future use.

---

## 1. The core principle: tag once, at the source

Add metadata **in Lightroom / Photoshop** and **export with metadata kept**.
The website build then reads it automatically. Website data-entry approaches zero.

Where each field comes from:

| Field | Source | Automatic? |
|---|---|---|
| Camera, lens, focal length, aperture, shutter, ISO, date | **EXIF** | ✅ auto (if not stripped) |
| Title, caption, keywords | **IPTC/XMP** (set in Lightroom/PS) | ✅ auto |
| GPS / location (lat·lng) | Camera/phone GPS or Lightroom Map | ✅ auto (if not stripped) |
| Country, City, location name | IPTC location fields | ✅ auto |
| **Story behind the shot** | typed in the website editor | ✍️ manual (only for featured photos) |
| **Collection / series** | folder name or a keyword | ✅ auto (convention) |
| Featured flag | website editor | ✍️ manual |

> Today's problem: current web exports have EXIF/IPTC **stripped**, so the site
> knows nothing about a photo. The settings in §4 fix this going forward.

---

## 2. The future upload loop (this is what stays easy forever)

1. In Lightroom: set **Title, Keywords, and Location/GPS** while culling (normal workflow).
2. Export web JPEGs **with "Include: All Metadata"** (see §4) into the right
   `photos_*` folder. _A new themed folder = a new collection automatically._
3. Run `python3 generate_manifest.py` → builds responsive variants **and**
   auto-ingests EXIF + IPTC + GPS into the metadata.
4. _(Optional)_ Open `meta-editor.html` only to add a **story** or mark a photo
   **featured** — and only for the few you want to spotlight.
5. `git push` → live.

For a 200-photo upload, steps 1–3 capture ~90% of metadata with **zero website typing**.

---

## 3. How metadata is stored (safe for re-runs at scale)

Two layers that never fight:

- **`js/photo-meta.auto.js`** — *generated* from EXIF/IPTC on every build.
  Never hand-edit; safe to overwrite. Incremental (only new/changed photos).
- **`js/photo-meta.js`** — *your* manual additions/corrections (stories,
  collections, fixes). Hand/editor-managed.

The site merges them, **manual layer wins**. So re-running the build on 1,000
photos never erases a story you wrote.

Keyed by `folder/filename`, e.g. `"photos_Landscape/_E2A7174.jpg"`.

---

## 4. EXACT export settings (do this so metadata survives)  ⭐

### Lightroom Classic
**A. Add the info (before export), in the Library module:**
- **Title & Caption:** Metadata panel (set its dropdown to *EXIF and IPTC*) → fill **Title** and **Caption**.
- **Keywords:** Keywording panel (comma-separated, e.g. `desert, sunset, dunes, Saudi Arabia`).
- **Location/GPS:** **Map module** — drag the photo onto the map (or it inherits camera/phone GPS). Optionally fill IPTC **City / State / Country** in the Metadata panel.

**B. Export with metadata kept** — File → Export → **Metadata** panel:
- **Include:** → choose **`All Metadata`**  _(the default "Copyright Only" strips everything — this is the critical change)_
- **Remove Location Info:** **UNCHECK** ✅  _(checking it deletes GPS)_
- **Remove Person Info:** your choice (check it only if you don't want names public).
- _Resize:_ long edge ~3840 px, sRGB, quality ~90 (matches the site's image pipeline).

### Lightroom CC (cloud version)
- Set Title/Keywords in the info panel; set location in the Map/Get Info area.
- On export/share, enable **Include Location/Metadata** (CC is less granular — make sure the location toggle is ON).

### Photoshop
**A. Add the info:** File → **File Info** → fill **Document Title**, **Description** (caption), **Keywords**, and IPTC location fields.

**B. Export keeping metadata — pick one:**
- ✅ **Best: File → Save a Copy** (or Save As) → **JPEG** → preserves **all** metadata incl. EXIF + IPTC + **GPS**.
- ⚠️ **File → Export → Save for Web (Legacy):** at the bottom set **Metadata: `All`** (default is usually "None"/"Copyright"). Keeps EXIF+IPTC, but **may not preserve GPS** — use *Save a Copy* when GPS matters.
- ❌ **Avoid "Export As"** for metadata-rich photos — it only offers "Copyright and Contact Info" and drops full EXIF/GPS.

> Rule of thumb: **Lightroom → Include: All Metadata (+ keep Location).
> Photoshop → Save a Copy as JPEG.**

---

## 5. Back-filling the existing ~64 photos

These were exported stripped. For each, in order of preference:
1. **Recover from the original file** — re-export the master from Lightroom/PS
   with §4 settings; the build picks up everything automatically.
2. **Manual entry** — if no original, type the fields in `meta-editor.html`.
3. **Delete** — if neither is worth doing, remove the photo from the site.

No rush — the build's **coverage dashboard** (see §6) shows what's missing so
this can be done gradually.

---

## 6. The metadata editor tool — `meta-editor.html`

A local, offline page (like the existing `admin.html`) that:
- Lists every photo with its **thumbnail** + input fields (pre-filled from auto metadata).
- Lets you add the **story**, choose/confirm **collection**, set **featured**, or fix any field.
- Shows a **coverage dashboard**: e.g. _"187 photos · 150 with GPS · 40 with a story · 12 missing titles."_
- **Generates `photo-meta.js`** to save — no server, works offline.

Its job shrinks over time: with good Lightroom tagging, you mostly just add stories.

---

## 7. Collections drive themselves

A collection/series is defined by **folder** (e.g. `photos_Desert_Adventures`)
or a Lightroom **keyword** (`Collection: Desert Adventures`). The build already
auto-discovers `photos_*` folders, so adding a themed folder creates a
collection with no per-photo busywork. This is how Featured Collections scale.

---

## 8. Build integration

`generate_manifest.py` gains a metadata pass that:
- Reads **EXIF + IPTC + XMP + GPS** from each photo (where present).
- Writes `js/photo-meta.auto.js` (incremental, cached like image variants).
- Is merged with `js/photo-meta.js` (manual) at runtime, manual winning.

No change to your existing one-command workflow (`python3 generate_manifest.py`).

---

## 9. First visible payoff (end of Phase B)

An **EXIF + location panel in the lightbox**: open a photo → see
📷 *Canon 5D Mark III · 24 mm · f/6.3 · 1/4 s · ISO 8000* and 📍 *location*.
Proves the pipeline and delivers idea #6.

---

## 10. What this unlocks next (Phase C)

All read the same metadata:
- **Photo Stories** (#15) — photo → story → location → settings → map → related.
- **Interactive Map** (#3) — pins from GPS, grouped by country.
- **Featured Collections** (#2) — auto-grouped by folder/keyword.
- **AI / keyword Search** (#12) — over titles, keywords, locations, captions.
- **Photo of the Week** (#7) — from the `featured` flag.

---

## 11. Build order (after sign-off)

1. Finalize schema (this doc).
2. EXIF + IPTC/XMP/GPS extractor in `generate_manifest.py` → seeds `photo-meta.auto.js`.
3. Two-layer merge + expose to the site.
4. `meta-editor.html` (form + coverage dashboard) → outputs `photo-meta.js`.
5. Lightbox EXIF + location panel (visible payoff).
6. You enrich over time; Phase C features light up.

---

_Decisions locked: edit/export with **Lightroom + Photoshop**; export **with
metadata** going forward (§4); existing photos back-filled from originals →
manual → delete (§5)._
