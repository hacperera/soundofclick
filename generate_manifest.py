#!/usr/bin/env python3
"""
Scans every `photos_*` folder in this directory and writes `js/images.js`,
a manifest the website uses to build the galleries.

Run it any time you add, remove, or rename photos:

    python3 generate_manifest.py

No other step is needed — refresh the site in your browser afterwards.
"""

import base64
import io
import json
import math
import os
import re
import struct

try:
    from PIL import Image, ImageOps, ImageCms, ExifTags
    _PIL = True
except Exception:
    _PIL = False

HERE = os.path.dirname(os.path.abspath(__file__))

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm"}
VIDEO_FOLDER = "Video"
PRINTS_FOLDER = "prints"
PANO_FOLDER = "photos_360"

# --- Image optimization (responsive variants) ---------------------------------
WEB_SUBDIR = "_web"                       # generated variants live in <folder>/_web/
STD_SIZES = [640, 1280, 2048, 3840]       # long-edge widths for normal photos
PANO_WIDTH = 5400                         # wide equirectangular for the 360 viewer
PANO_THUMB = 640                          # flat thumbnail for the 360 gallery tile
# (ext, Pillow format, quality) — AVIF best, WebP broad, JPEG universal fallback.
STD_FMTS = [("avif", "AVIF", 55), ("webp", "WEBP", 80), ("jpg", "JPEG", 82)]
PANO_FMTS = [("webp", "WEBP", 82), ("jpg", "JPEG", 85)]   # no AVIF for the viewer texture
CACHE_FILE = ".media-cache.json"

# Friendly display names + ordering for known folders.
# Any photos_* folder not listed here is still included automatically,
# appended at the end with a title derived from the folder name.
CATEGORY_META = [
    ("photos_Landscape",         "Landscape"),
    ("photos_Nature",            "Nature"),
    ("photos_Wildlife",          "Wildlife"),
    ("photos_Astrophotography",  "Astrophotography"),
    ("photos_drone",             "Aerial"),
    ("photos_Architectural",     "Architectural"),
    ("photos_Street_Photography","Street"),
    ("photos_Portrait",          "Portrait"),
    ("photos_Macro",             "Macro"),
    ("photos_Food",              "Food"),
    ("photos_FineArt",           "Fine Art"),
    ("photos_360",               "360°"),
]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def folder_title(folder):
    base = folder[len("photos_"):] if folder.startswith("photos_") else folder
    base = base.replace("_", " ").strip()
    return base.title()


def video_orientation(path):
    """Read an MP4/MOV track header to decide 'portrait' or 'landscape'.
    Falls back to 'landscape' if the container can't be parsed."""
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        return "landscape"

    tracks = []

    def walk(buf, start, end):
        pos = start
        while pos + 8 <= end:
            size = struct.unpack(">I", buf[pos:pos + 4])[0]
            typ = buf[pos + 4:pos + 8]
            head = 8
            if size == 1:
                size = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
                head = 16
            elif size == 0:
                size = end - pos
            box_end = pos + size
            if box_end > end or size < head:
                break
            if typ in (b"moov", b"trak", b"mdia", b"minf", b"stbl"):
                walk(buf, pos + head, box_end)
            elif typ == b"tkhd":
                b = buf[pos + head:box_end]
                ver = b[0]
                off = 4
                off += (8 + 8 + 4 + 4 + 8) if ver == 1 else (4 + 4 + 4 + 4 + 4)
                off += 8 + 2 + 2 + 2 + 2
                matrix = struct.unpack(">9i", b[off:off + 36]); off += 36
                w = struct.unpack(">I", b[off:off + 4])[0] / 65536.0
                h = struct.unpack(">I", b[off + 4:off + 8])[0] / 65536.0
                a = matrix[0] / 65536.0
                bb = matrix[1] / 65536.0
                rot = round(math.degrees(math.atan2(bb, a))) % 360
                if rot in (90, 270):
                    w, h = h, w
                if w > 0 and h > 0:
                    tracks.append((w, h))
            pos = box_end

    walk(data, 0, len(data))
    if not tracks:
        return "landscape"
    w, h = tracks[0]
    return "portrait" if h > w else "landscape"


def list_videos():
    path = os.path.join(HERE, VIDEO_FOLDER)
    out = {"portrait": [], "landscape": []}
    if not os.path.isdir(path):
        return out
    for f in sorted(os.listdir(path)):
        if os.path.splitext(f)[1].lower() not in VIDEO_EXTS:
            continue
        orient = video_orientation(os.path.join(path, f))
        out[orient].append(f)
    return out


def list_images(folder):
    path = os.path.join(HERE, folder)
    files = []
    for f in sorted(os.listdir(path)):
        if os.path.splitext(f)[1].lower() in IMAGE_EXTS:
            files.append(f)
    return files


def list_prints():
    """Optional flat 'prints' folder of curated print images."""
    path = os.path.join(HERE, PRINTS_FOLDER)
    if not os.path.isdir(path):
        return []
    return [f for f in sorted(os.listdir(path))
            if os.path.splitext(f)[1].lower() in IMAGE_EXTS]


# ----------------------------------------------------------------------------
# Image optimization helpers (only used when Pillow is available)
# ----------------------------------------------------------------------------
def _dms_to_deg(dms, ref):
    deg = float(dms[0]) + float(dms[1]) / 60.0 + float(dms[2]) / 3600.0
    return -deg if ref in ("S", "W") else deg


def gps_of(im):
    """Return {'lat','lng'} from EXIF GPS, or None."""
    try:
        exif = im._getexif() or {}
    except Exception:
        return None
    gps = {}
    for k, v in exif.items():
        if ExifTags.TAGS.get(k) == "GPSInfo" and isinstance(v, dict):
            for gk, gv in v.items():
                gps[ExifTags.GPSTAGS.get(gk, gk)] = gv
    if "GPSLatitude" in gps and "GPSLongitude" in gps:
        try:
            lat = _dms_to_deg(gps["GPSLatitude"], gps.get("GPSLatitudeRef", "N"))
            lng = _dms_to_deg(gps["GPSLongitude"], gps.get("GPSLongitudeRef", "E"))
            return {"lat": round(lat, 6), "lng": round(lng, 6)}
        except Exception:
            return None
    return None


def to_srgb(im, icc):
    """Convert to sRGB so colours look right on the web; fall back to plain RGB."""
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            dst = ImageCms.createProfile("sRGB")
            return ImageCms.profileToProfile(im, src, dst, outputMode="RGB")
        except Exception:
            pass
    return im.convert("RGB")


def make_lqip(im):
    """Tiny blurred placeholder as a base64 WebP data URI (stored for later use)."""
    t = im.copy()
    t.thumbnail((24, 24))
    buf = io.BytesIO()
    t.save(buf, format="WEBP", quality=40)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def pick_widths(longest, sizes):
    ws = [w for w in sizes if w <= longest]
    if not ws or (longest < max(sizes) and longest not in ws):
        ws.append(longest)
    return sorted(set(ws))


def save_set(im, web_dir, base, widths, fmts):
    """Write resized variants in each format. Returns (widths, avif_ok)."""
    longest = max(im.size)
    avif_ok = True
    for w in widths:
        scale = min(1.0, w / float(longest))
        if scale == 1.0:
            r = im
        else:
            r = im.resize((max(1, round(im.size[0] * scale)),
                           max(1, round(im.size[1] * scale))), Image.LANCZOS)
        for ext, fmt, q in fmts:
            out = os.path.join(web_dir, "%s-%d.%s" % (base, w, ext))
            kw = {"quality": q}
            if fmt == "JPEG":
                kw.update(progressive=True, optimize=True)
            try:
                r.save(out, format=fmt, **kw)
            except Exception as e:
                if ext == "avif":
                    avif_ok = False
                else:
                    print("   ! %s failed for %s-%d: %s" % (fmt, base, w, e))
    return widths, avif_ok


def process_one(folder, file):
    """Generate variants + metadata for a single source image."""
    src_path = os.path.join(HERE, folder, file)
    web_dir = os.path.join(HERE, folder, WEB_SUBDIR)
    base = os.path.splitext(file)[0]
    try:
        im0 = Image.open(src_path)
        im0.load()
    except Exception as e:
        print("  ! skip %s/%s: %s" % (folder, file, e))
        return None

    geo = gps_of(im0)
    icc = im0.info.get("icc_profile")
    im = ImageOps.exif_transpose(im0)        # bake in orientation
    im = to_srgb(im, icc)
    W, H = im.size
    longest = max(W, H)
    os.makedirs(web_dir, exist_ok=True)

    entry = {"w": W, "h": H, "lqip": make_lqip(im)}
    if geo:
        entry["geo"] = geo

    if folder == PANO_FOLDER:
        tw = [w for w in [PANO_THUMB] if w <= longest] or [longest]
        _, avif_ok = save_set(im, web_dir, base, tw, STD_FMTS)
        entry["variants"] = tw
        if not avif_ok:
            entry["avif"] = False
        pano_w = min(PANO_WIDTH, longest)
        save_set(im, web_dir, base, [pano_w], PANO_FMTS)
        entry["pano"] = pano_w
    else:
        ws = pick_widths(longest, STD_SIZES)
        made, avif_ok = save_set(im, web_dir, base, ws, STD_FMTS)
        entry["variants"] = made
        if not avif_ok:
            entry["avif"] = False
    return entry


def variants_exist(folder, file, entry):
    if not entry.get("variants"):
        return False
    base = os.path.splitext(file)[0]
    w = entry["variants"][0]
    return os.path.exists(os.path.join(HERE, folder, WEB_SUBDIR, "%s-%d.webp" % (base, w)))


def build_media(categories):
    """Optimize every gallery image; return the MEDIA map keyed by 'folder/file'.
    Incremental: unchanged sources (same mtime, variants present) are reused."""
    if not _PIL:
        print("  (Pillow not installed — skipping image optimization; "
              "site will use original images. `pip install Pillow`.)")
        return {}

    cache_path = os.path.join(HERE, CACHE_FILE)
    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, encoding="utf-8") as fh:
                cache = json.load(fh)
        except Exception:
            cache = {}

    media = {}
    done = 0
    for cat in categories:
        for file in cat["images"]:
            key = cat["folder"] + "/" + file
            try:
                mtime = os.path.getmtime(os.path.join(HERE, cat["folder"], file))
            except OSError:
                continue
            cached = cache.get(key)
            if (cached and cached.get("mtime") == mtime
                    and variants_exist(cat["folder"], file, cached.get("entry", {}))):
                media[key] = cached["entry"]
                continue
            entry = process_one(cat["folder"], file)
            if entry:
                media[key] = entry
                cache[key] = {"mtime": mtime, "entry": entry}
                done += 1
                print("  optimized %s" % key)

    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(cache, fh)
    print("  image optimization: %d processed, %d total in manifest." % (done, len(media)))
    return media


def main():
    folders = sorted(
        d for d in os.listdir(HERE)
        if d.startswith("photos_") and os.path.isdir(os.path.join(HERE, d))
    )

    ordered = [(f, t) for (f, t) in CATEGORY_META if f in folders]
    known = {f for (f, _) in CATEGORY_META}
    ordered += [(f, folder_title(f)) for f in folders if f not in known]

    categories = []
    total = 0
    for folder, title in ordered:
        images = list_images(folder)
        if not images:
            continue
        total += len(images)
        categories.append({
            "id": slugify(title),
            "title": title,
            "folder": folder,
            "images": images,
        })

    videos = list_videos()

    video_obj = {
        "folder": VIDEO_FOLDER,
        "portrait": videos["portrait"],
        "landscape": videos["landscape"],
    }

    prints = list_prints()
    prints_obj = {"folder": PRINTS_FOLDER, "images": prints}

    # Generate responsive variants + metadata (incremental).
    media = build_media(categories)

    out = (
        "// AUTO-GENERATED by generate_manifest.py — do not edit by hand.\n"
        "// Run `python3 generate_manifest.py` to regenerate after changing photos/videos.\n"
        "window.GALLERY_DATA = "
        + json.dumps(categories, indent=2, ensure_ascii=False)
        + ";\n\n"
        "window.VIDEO_DATA = "
        + json.dumps(video_obj, indent=2, ensure_ascii=False)
        + ";\n\n"
        "window.PRINTS_DATA = "
        + json.dumps(prints_obj, indent=2, ensure_ascii=False)
        + ";\n\n"
        "// Responsive image variants, dimensions, blur placeholders and GPS,\n"
        "// keyed by \"folder/file\". Absent entries fall back to the original image.\n"
        "window.MEDIA = "
        + json.dumps(media, ensure_ascii=False)
        + ";\n"
    )

    with open(os.path.join(HERE, "js", "images.js"), "w", encoding="utf-8") as fh:
        fh.write(out)

    print(f"Wrote js/images.js — {len(categories)} categories, {total} images, "
          f"{len(videos['portrait'])} portrait + {len(videos['landscape'])} landscape videos, "
          f"{len(prints)} prints.")


if __name__ == "__main__":
    main()
