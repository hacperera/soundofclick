# 3 — Site-wide Photo Map + 360° Virtual Tours

Two distinctive, location-photographer features built on what's already in place
(the 360 viewer already uses Leaflet for its mini-map). This also resolves the
**placeholder coordinates** currently in `js/pano-locations.js`.

---

## 3a — Site-wide photo map

**Goal:** a map of Sri Lanka / the world with a pin for every geotagged photo.
Click a pin → see the thumbnail → open it in the lightbox or 360 viewer. A
signature page for a travel/landscape photographer.

### Where the coordinates come from

Two sources, merged:

1. **EXIF GPS (automatic).** Many of your photos — especially drone (`DJI_*`) and
   phone shots — embed GPS. The image-optimization build step (doc 01) already
   reads EXIF; extend it to write `geo: {lat, lng}` into each manifest entry when
   GPS is present. **No manual work** for those.
   - Reality check from the current library: the two 360 panoramas
     (`R0011197.JPG`, `R0011293.JPG`) carry only a compass heading
     (`GPSImgDirection`), **no GPS lat/lng** — so those need manual coords.
     Other folders (drone especially) likely do have GPS; the build step will
     surface exactly which.
2. **Manual overrides (`js/pano-locations.js`, and a new general file).** For
   photos without GPS, set coordinates by hand. Generalize the existing 360
   locations file into a site-wide one, e.g. `js/photo-locations.js`:
   ```js
   window.PHOTO_LOCATIONS = {
     "R0011197.JPG": { lat: 6.9271, lng: 79.8612, label: "Galle Face, Colombo" },
     "DJI_0303.JPG": { lat: 6.0535, lng: 80.2210, label: "Mirissa coast" }
   };
   ```
   Manual entries override/supplement EXIF.

> **Action to unblock the current map:** replace the placeholder Colombo/Kandy
> coords in `js/pano-locations.js` with the real capture spots of the two
> panoramas (right-click the spot in Google Maps → click the coordinates to copy).
> Tell me the locations and I'll fill them in, or edit the file directly.

### The map page

- New page `map.html` (linked from the nav) with a full-width Leaflet map.
- Add **marker clustering** (`leaflet.markercluster`, CDN) so dense areas collapse
  into clean count-bubbles that expand on zoom.
- Each marker's popup shows the photo thumbnail (the 640px `_web` variant from
  doc 01) + title; clicking opens the existing lightbox, or the 360 viewer if it's
  a panorama.
- Data: iterate `GALLERY_DATA`, include every image that has `geo` (from EXIF) or
  an entry in `PHOTO_LOCATIONS`.

### Build notes

- Reuse the Leaflet setup already proven in `js/main.js` (`updatePanoMap`).
- Tiles: OpenStreetMap (free, no key) for now; swap to a styled provider
  (e.g. MapTiler/Mapbox, free tier + key) later if you want a prettier basemap.
- A circle marker or a small custom photo-pin icon avoids Leaflet's default-icon
  path issue (same approach already used in the 360 mini-map).

---

## 3b — 360° virtual tours (walkable panoramas)

**Goal:** link panoramas together with clickable hotspots so a viewer can "walk"
from one location to the next — turning the 360 album into an experience, not just
isolated spheres. Pannellum (already loaded) supports this natively via
**multi-scene tours**.

### How it works

Pannellum has two modes:

- **Single panorama** (what the site does now).
- **Tour**: multiple named *scenes*, each an equirectangular image, connected by
  **hotspots**. A `scene`-type hotspot, when clicked, transitions to another
  scene. You can also drop `info`-type hotspots (a tooltip/caption pinned to a
  point in the sphere — e.g. "the old lighthouse").

### Data model

Add a tour definition file, e.g. `js/pano-tours.js`:

```js
window.PANO_TOURS = {
  "galle-fort": {
    title: "Galle Fort Walk",
    firstScene: "ramparts",
    scenes: {
      ramparts: {
        image: "photos_360/_web/R0011197-5400.webp",
        title: "The Ramparts",
        hotSpots: [
          { pitch: -2, yaw: 117, type: "scene", text: "Walk to the lighthouse", sceneId: "lighthouse" }
        ]
      },
      lighthouse: {
        image: "photos_360/_web/R0011293-5400.webp",
        title: "Lighthouse",
        hotSpots: [
          { pitch: 0, yaw: -90, type: "scene", text: "Back to ramparts", sceneId: "ramparts" },
          { pitch: 5, yaw: 30, type: "info", text: "Built 1939" }
        ]
      }
    }
  }
};
```

`pitch`/`yaw` are the hotspot's position in the sphere (degrees). The easiest way
to find them: open the panorama in the viewer, aim at the spot, and read the
current pitch/yaw (Pannellum can log them on click during authoring) — I can add a
tiny "author mode" that prints coordinates when you click, to make placing
hotspots painless.

### Front-end change

In `js/main.js`, when the 360 album opens, check if the clicked panorama belongs
to a tour in `PANO_TOURS`. If so, initialize Pannellum with the **tour config**
(`default.firstScene` + `scenes`) instead of a single `panorama`. Standalone
panoramas keep today's single-image behavior. The location mini-map updates per
scene (each scene can carry its own `geo`).

### Authoring workflow

1. Shoot/collect the panoramas for a location, drop in `photos_360/`.
2. Run the build step → wide web variants generated.
3. Add a tour entry in `pano-tours.js`, placing `scene` hotspots roughly where the
   path continues.
4. Fine-tune pitch/yaw using author mode.

> When you have a set of panoramas from one location you want to connect, send me
> the filenames and the rough "what connects to what," and I'll scaffold the tour
> config + wire it into the viewer.

---

## Acceptance checks

- `map.html` shows pins; clustering collapses/expands on zoom; popups open the
  right photo/viewer.
- Drone photos with EXIF GPS appear on the map automatically.
- The two 360 panoramas show at their **real** locations (placeholders replaced).
- A multi-scene tour transitions between panoramas via hotspots, with the mini-map
  updating per scene.
