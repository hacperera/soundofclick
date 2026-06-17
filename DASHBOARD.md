# hacpix — Managing the site & the back-end dashboard

You asked how to manage the site once it's published: **(i) add photos/videos to
galleries, (ii) write blog posts, (iii) review messages from people.**

This site is currently a set of **static files** (no server), which is why it opens
just by double-clicking `index.html`. That's great for speed, cost and portability —
but a "dashboard" in the traditional sense needs *somewhere to run*. Below is what
you can do **today**, and the **three realistic paths** to a real online dashboard.

---

## What you can do today (no server)

Open **`admin.html`** in your browser — the **hacpix Studio** panel. It gives you:

| Need | How it works today |
|------|--------------------|
| **Blog posts** | Write/edit posts in a form → click *Download posts.js* → replace `js/posts.js` → refresh. |
| **Photos / videos** | Drop files into the `photos_*`, `Video/` or `prints/` folders → run `python3 generate_manifest.py`. |
| **Messages** | The contact form emails every enquiry to your inbox via FormSubmit — your inbox is the dashboard. |

This is a perfectly good workflow for a portfolio that changes occasionally. The only
manual step is replacing a file / running one command, then re-publishing.

---

## The three paths to a true online dashboard

Pick based on how hands-off you want to be. My recommendation is **Option B**.

### Option A — Stay static + a Git-based CMS  ·  *cheapest, simplest*
Host the folder on **Netlify, Vercel, or Cloudflare Pages** (all have free tiers) and
add **Decap CMS** (formerly Netlify CMS) — a `/admin` page that logs in, lets you
write posts and upload images through a friendly UI, and commits the changes back to
your site automatically. Messages use **Netlify Forms** (built-in, with a dashboard).

- ✅ No database, no server to maintain, free.
- ✅ Real admin UI at `yoursite.com/admin`, editable from any device.
- ⚠️ Each change triggers a rebuild (seconds). Large photo libraries are committed to Git.

### Option B — Headless CMS + static front-end  ·  *recommended, best UX*  ⭐
Keep this fast static front-end, but store blog posts and galleries in a hosted
**headless CMS** such as **Sanity**, **Storyblok**, or **Contentful** (generous free
tiers). You (or anyone) log into a polished dashboard to add photos, videos and posts;
the site reads them via an API. Messages go to **Formspree** or a tiny serverless
function that writes to the CMS.

- ✅ Best editing experience; manage photos/videos/posts/messages in one place, from anywhere.
- ✅ Front-end stays fast and cheap.
- ⚠️ One external service to sign up for; light initial setup.

### Option C — Full custom backend  ·  *most control, most work*
A small server (e.g. **Node/Express** or **Python/Flask**) with a database
(**SQLite/Postgres**) and an authenticated `/admin` dashboard. Photos/videos upload to
the server or object storage (S3/Cloudflare R2); posts and messages live in the DB.

- ✅ Total control; messages, posts and media all first-class with login & roles.
- ⚠️ You run/secure/back-up a server. Hosting cost and maintenance.

---

## Recommendation

1. **Publish now** on **Netlify** (free) and turn on **Netlify Forms** so contact
   messages get a real dashboard immediately — zero code.
2. For content, start with **Option A (Decap CMS)** for a quick win, and graduate to
   **Option B (Sanity/Storyblok)** if you want a richer media-management dashboard.
3. The current static structure is already organised so any of these can be layered on
   without redesigning the site — galleries are folder-driven, posts live in one data
   file, and the contact form is already a standard POST.

Tell me which path you'd like and I'll wire it up: connect a host, add the `/admin`
CMS, and migrate posts/galleries/messages into it.
