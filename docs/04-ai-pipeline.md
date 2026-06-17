# 4 — AI Captioning, Search & Blog Drafts (Claude)

Three AI features, all built on the **Claude API** with vision, all slotting into
the existing `generate_manifest.py` / `images.js` workflow. Captions and tags are
generated **once per photo and cached**, so cost is tiny and you never re-pay.

> Model used throughout: **`claude-opus-4-8`** (Anthropic's most capable Opus-tier
> model; $5 / $25 per million input/output tokens). For a cheaper bulk run you
> could use `claude-haiku-4-5` ($1 / $5), but Opus gives noticeably better
> captions — see cost note below; it's cheap either way.

---

## Setup (one-time)

```bash
pip install anthropic
export ANTHROPIC_API_KEY="sk-ant-..."   # never hardcode; keep it in your shell/secret store
```

Get the key from the Anthropic Console (you create it; I can't). **Do not commit
it** — add any `.env` to `.gitignore`.

Two cost-control rules that apply to every call:

1. **Downscale before sending.** Send the **1280px `_web` variant** (from doc 01),
   not the full-res master. High-resolution images cost far more image tokens; a
   1280px JPEG is plenty for captioning and keeps each call cheap.
2. **Cache by content hash.** Key results on a hash of the source file in a sidecar
   `ai_metadata.json`. Re-runs skip already-processed photos → you pay once per
   photo, ever.

---

## 4a — Auto captioning & tagging

**Goal:** for each photo, generate `alt` text (accessibility), a one-line
`caption` (display/SEO), a `category` suggestion, and `keywords[]` (search + SEO).
Kills three birds: accessibility, SEO, and hours of manual tagging.

### How

A new script `ai_enrich.py`:

1. For each photo not already in `ai_metadata.json`:
   - Read the 1280px variant, base64-encode it.
   - Send one Claude request with the image + a prompt asking for structured JSON.
   - Use **structured outputs** so the response is guaranteed-valid JSON (no
     parsing surprises).
2. Write results into `ai_metadata.json`, keyed by file hash.
3. `generate_manifest.py` merges `ai_metadata.json` into `images.js` (each image
   gets `alt`, `caption`, `keywords`).

### Reference implementation (Python SDK)

```python
import anthropic, base64, json, hashlib, pathlib
from pydantic import BaseModel

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

class PhotoMeta(BaseModel):
    alt: str            # concise, factual, for screen readers
    caption: str        # one evocative sentence for display
    category: str       # best-fit gallery: Landscape, Wildlife, ...
    keywords: list[str] # 5-10 search terms

def enrich(image_path: str) -> PhotoMeta:
    data = base64.standard_b64encode(pathlib.Path(image_path).read_bytes()).decode()
    resp = client.messages.parse(
        model="claude-opus-4-8",
        max_tokens=1024,
        system=(
            "You write metadata for a fine-art photography portfolio by Chaminda "
            "Perera (hacpix). Be accurate and specific; never invent locations or "
            "camera settings you can't see. Tone: understated, gallery-like."
        ),
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64", "media_type": "image/jpeg", "data": data}},
                {"type": "text", "text":
                    "Describe this photograph for a portfolio. Provide alt text, a "
                    "one-sentence caption, the best-fit gallery category, and 5-10 "
                    "keywords."},
            ],
        }],
        output_format=PhotoMeta,
    )
    return resp.parsed_output
```

- `messages.parse()` + a Pydantic model validates the JSON for you.
- Wrap in the cache check (`hashlib` of the source bytes) so each photo is done once.

### Cheaper bulk option — Batches API

For the whole library at once, the **Message Batches API** runs the same requests
asynchronously at **50% cost** (completes within ~1h). Worth it for the initial
pass over all photos; use the live single-call path for new photos you add later.

### Cost estimate (this library, ~88 photos)

A 1280px photo + prompt ≈ ~1.5–2k input tokens; output ≈ ~300 tokens. On Opus
that's roughly **~$0.015 per photo → ~$1.30 for the whole library**, or **~$0.65
via Batches**. Haiku would be ~5× cheaper still. Caching means you never re-pay for
unchanged photos.

### Front-end use

- Set each `<img alt>` from the generated `alt` (accessibility + image SEO).
- Show `caption` in the lightbox/tile.
- Feed `keywords` into search (4b) and meta tags (doc 05).

---

## 4b — Natural-language photo search

**Goal:** a search box where "misty mountains at sunrise" finds the right photos.
Two tiers — start simple, upgrade if you want true semantic matching.

### Tier 1 — Keyword search (free, do this first)

You already generate rich `keywords` + `caption` per photo (4a). A client-side
fuzzy search over that text covers most real queries with **zero extra cost or
infrastructure** — it's all static JSON.

- Use a tiny client lib (e.g. **Fuse.js**, ~6KB, CDN) over the
  `caption`/`keywords`/`category` fields in `images.js`.
- Add a search input on `gallery.html`; filter tiles live as the user types.

This alone makes the site feel smart and is the recommended starting point.

### Tier 2 — Semantic search via embeddings (optional upgrade)

For true "meaning" matching (queries that don't share words with the keywords),
use **multimodal embeddings**:

> **Important:** Anthropic's API does **not** provide an embeddings endpoint —
> Anthropic recommends **Voyage AI** for embeddings. Use `voyage-multimodal-3` (or
> the current Voyage multimodal model) to embed images and text into the same
> vector space.

Flow (all still compatible with a static site):

1. **Build time:** embed each photo (image) with Voyage → store the vectors in a
   `embeddings.json` shipped as a static asset.
2. **Query time (in the browser):** embed the user's text query. Two ways:
   - Call Voyage from a tiny serverless function (Cloudflare Worker / Netlify
     Function) so the key stays server-side; or
   - Precompute embeddings for a fixed set of suggested queries if you want
     zero backend.
3. Compute cosine similarity between the query vector and photo vectors in JS;
   show the top matches.

Start with Tier 1; only add Tier 2 if keyword search proves too limited.

---

## 4c — AI-assisted blog drafts

**Goal:** turn a shoot (a folder of photos + a few notes) into a first-draft blog
post in your voice, matching the existing `js/posts.js` structure.

### How

A script `blog_draft.py`:

1. Inputs: a list of image paths (the 1280px variants) + a short note from you
   ("Yala safari, dawn, leopards near the tank, harsh midday light").
2. One Claude request: the images + your notes + a **style sample** (paste 1–2 of
   your existing posts so it matches your voice) + instructions to output the
   post in your `posts.js` shape (title, excerpt, category, body paragraphs).
3. Output a draft you edit and paste into `js/posts.js` (or save as a `.md`).

Because it's a longer generation, **stream** the response (the SDK's
`messages.stream()` / `.get_final_message()`), and keep adaptive thinking on for
quality. Include your real posts in the prompt so the draft sounds like *you*, not
generic AI.

> This is assistive, not autopilot — always edit before publishing. The win is
> going from blank page to a solid first draft in seconds.

---

## Security & privacy notes

- **Never commit `ANTHROPIC_API_KEY`** (or the Voyage key). Use environment
  variables / your host's secret store. Add `.env`, `ai_metadata.json` only if it
  contains nothing sensitive (it's just captions — safe to commit).
- These scripts run **locally at build time**, not in the visitor's browser, so no
  key is ever exposed to the public.
- Don't send anything you wouldn't want processed by a third party; photos are fine,
  but keep client/private shoots out of automated pipelines unless intended.

---

## Suggested order

1. **4a captioning** (one batch run; fills alt/caption/keywords).
2. **4b Tier 1 keyword search** (free, instant payoff, uses 4a output).
3. **5a SEO/meta** (doc 05) consumes the captions/keywords.
4. **4c blog drafts** whenever you're writing.
5. **4b Tier 2 embeddings** only if you want semantic search later.

> When you're ready, I can write `ai_enrich.py`, the cache layer, the Batches
> runner, and the `generate_manifest.py` merge — it's a contained piece of work.
