# 2 — Real Hosting (Cloudflare Pages or Netlify)

**Goal:** put the site on a real host with HTTPS, a global CDN, and a custom
domain (e.g. `hacpix.com`). This permanently removes the `file://` / `.bat`
workaround — the 360 viewer and map just work because everything is served over
`https://`. Both options below have a generous free tier.

**Recommendation:** **Cloudflare Pages** (fast global CDN, free, simple custom
domains). Netlify is just as good and slightly simpler for drag-and-drop — pick
whichever you prefer; the steps are nearly identical.

There are two ways to deploy. Start with **Option A** (drag-and-drop) to go live
in 10 minutes; move to **Option B** (Git) when you want automatic deploys.

---

## What you do vs. what I can do

- **You must do** (needs your login / payment): create the Cloudflare/Netlify
  account, buy the domain, click through their dashboard. These need your
  credentials — I can't and shouldn't do them for you.
- **I can do for you** (just ask): initialize a Git repository, write a
  `wrangler.toml` / `netlify.toml` config, add a `.gitignore`, and a small deploy
  script. I'll prep everything so your part is just clicking "Deploy."

---

## Option A — Drag-and-drop (live in ~10 minutes, no Git)

### Netlify Drop (easiest)

1. Go to **app.netlify.com/drop**.
2. Drag the project folder (`photography_website`, or the unzipped
   `hacpix_website`) onto the page.
3. It uploads and gives you a live URL like `random-name-123.netlify.app`.
4. Open `…/series.html#360` — the 360 viewer works (it's https now).

### Cloudflare Pages (direct upload)

1. Sign in at **dash.cloudflare.com** → **Workers & Pages** → **Create** →
   **Pages** → **Upload assets**.
2. Name the project (e.g. `hacpix`), drag the folder, **Deploy**.
3. Live at `hacpix.pages.dev`.

> **Re-deploying** with drag-and-drop means re-uploading the whole folder each
> time. Fine for occasional updates; for frequent ones use Option B.

---

## Option B — Git-based (automatic deploys on every change)

This is the better long-term setup: push a change, the site rebuilds itself.
Since this project isn't a Git repo yet, step 1 sets that up.

1. **Create the repo.** (I can do this part for you.)
   ```bash
   cd /mnt/c/work/photography_website
   git init
   # .gitignore should exclude generated/large junk but KEEP photos + _web variants
   git add .
   git commit -m "Initial commit: hacpix photography site"
   ```
2. **Push to GitHub.** Create a repo at github.com (e.g. `hacpix-site`), then:
   ```bash
   git remote add origin https://github.com/<you>/hacpix-site.git
   git branch -M main
   git push -u origin main
   ```
   (Use the `gh` CLI or the website — your login required.)
3. **Connect to the host.**
   - **Cloudflare Pages:** Workers & Pages → Create → Pages → **Connect to Git** →
     pick the repo. Build command: *(none — it's static)*. Build output dir: `/`
     (root). Deploy.
   - **Netlify:** Add new site → Import from Git → pick the repo. Build command:
     empty. Publish directory: `.`. Deploy.
4. Every `git push` now auto-deploys. Preview URLs are generated for branches.

> If you later add the image build step (doc 01) or AI pipeline (doc 04), you can
> either run them locally and commit the outputs, or add them as a build command.
> Simplest for now: run locally, commit `_web/` and the updated `images.js`.

---

## Custom domain (`hacpix.com`)

1. **Buy the domain** — Cloudflare Registrar (at-cost pricing) or any registrar.
2. **Add it to the host:**
   - Cloudflare Pages: project → **Custom domains** → **Set up a domain** → enter
     `hacpix.com`. If the domain is on Cloudflare, DNS is configured for you.
     Otherwise add the shown CNAME at your registrar.
   - Netlify: Site → **Domain management** → **Add a domain** → follow the DNS
     instructions (point an `ALIAS`/`CNAME` at your Netlify subdomain).
3. HTTPS certificates are issued automatically (free, via Let's Encrypt). Wait a
   few minutes; then `https://hacpix.com` is live.

---

## After going live — checklist

- [ ] `https://<your-domain>/` loads, padlock shows (valid HTTPS).
- [ ] `…/gallery.html` → open the **360** album → panorama viewer works (no black
      screen — this confirms the https fix).
- [ ] The location mini-map renders (fill in real coords first — doc 03).
- [ ] Test on a phone (you no longer need the `.bat`).
- [ ] Add the site to **Google Search Console** (verify ownership, submit a
      sitemap — see doc 05 for the sitemap).

---

## Notes

- **External libraries:** the 360 viewer (Pannellum), map (Leaflet), and map tiles
  load from CDNs — they need internet, which any hosted visitor has. (For a fully
  offline bundle you'd vendor them locally; not needed once hosted.)
- **The `.bat` launcher** (`Open Website (360 enabled).bat`) becomes unnecessary
  once hosted — it's only for opening local files. You can leave it in the repo or
  remove it.
- **Bandwidth:** doing doc 01 (image optimization) first keeps you comfortably
  inside free-tier limits even with lots of large photos.
