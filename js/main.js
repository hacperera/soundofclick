/* ============================================================
   Lio Photography — site behaviour
   Depends on js/images.js (window.GALLERY_DATA)
   ============================================================ */
(function () {
  "use strict";

  var DATA = window.GALLERY_DATA || [];

  // Build a URL-safe path to an image, preserving the folder slash.
  function imgPath(folder, file) {
    return folder + "/" + encodeURIComponent(file);
  }

  /* ---------- Optimized media (responsive AVIF/WebP variants) ----------
     window.MEDIA (from images.js) maps "folder/file" -> { w, h, lqip,
     variants:[widths], avif:bool, pano:width, geo:{lat,lng} }. When an entry
     exists we serve responsive <picture>/srcset and size big views to a variant;
     when it doesn't (image not yet processed) we fall back to the original file,
     so the site works either way. Regenerate with `python3 generate_manifest.py`. */
  var MEDIA = window.MEDIA || {};
  function media(folder, file) { return MEDIA[folder + "/" + file]; }
  function baseName(file) { return file.replace(/\.[^.]+$/, ""); }
  function webPath(folder, file, w, ext) {
    return folder + "/" + WEB_DIR + "/" + encodeURIComponent(baseName(file) + "-" + w + "." + ext);
  }
  var WEB_DIR = "_web";

  // Best single source at or above targetW (falls back to the original file).
  function bestSrc(folder, file, targetW, ext) {
    var m = media(folder, file);
    if (!m || !m.variants || !m.variants.length) return imgPath(folder, file);
    var pick = m.variants[m.variants.length - 1];
    for (var i = 0; i < m.variants.length; i++) {
      if (m.variants[i] >= targetW) { pick = m.variants[i]; break; }
    }
    return webPath(folder, file, pick, ext || "jpg");
  }

  // Source for the 360 viewer: the wide equirectangular WebP, else the original.
  function panoSrc(folder, file) {
    var m = media(folder, file);
    if (m && m.pano) return webPath(folder, file, m.pano, "webp");
    return imgPath(folder, file);
  }

  // Build a responsive <picture> for grid/tile use. `picture { display:contents }`
  // in CSS lets the inner <img> inherit the surrounding img rules unchanged.
  function buildPicture(folder, file, sizes, opts) {
    opts = opts || {};
    var m = media(folder, file);
    var pic = document.createElement("picture");
    var img = document.createElement("img");
    img.loading = opts.loading || "lazy";
    img.alt = opts.alt || "";
    if (m && m.variants && m.variants.length) {
      var ss = function (ext) {
        return m.variants.map(function (w) {
          return webPath(folder, file, w, ext) + " " + w + "w";
        }).join(", ");
      };
      if (m.avif !== false) {
        var sa = document.createElement("source");
        sa.type = "image/avif"; sa.srcset = ss("avif");
        if (sizes) sa.sizes = sizes;
        pic.appendChild(sa);
      }
      var sw = document.createElement("source");
      sw.type = "image/webp"; sw.srcset = ss("webp");
      if (sizes) sw.sizes = sizes;
      pic.appendChild(sw);
      img.srcset = ss("jpg");
      if (sizes) img.sizes = sizes;
      var mid = m.variants[Math.min(1, m.variants.length - 1)];
      img.src = webPath(folder, file, mid, "jpg");
      if (m.w && m.h) { img.width = m.w; img.height = m.h; }
    } else {
      img.src = imgPath(folder, file);
    }
    pic.appendChild(img);
    return pic;
  }

  // Flatten manifest into a single list of {folder, file, src, cat}.
  function allImages() {
    var out = [];
    DATA.forEach(function (cat) {
      cat.images.forEach(function (file) {
        out.push({ folder: cat.folder, file: file,
                   src: bestSrc(cat.folder, file, 2048, "webp"),
                   cat: cat.title, catId: cat.id });
      });
    });
    return out;
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav-toggle");

    if (nav && !nav.classList.contains("solid")) {
      var onScroll = function () {
        nav.classList.toggle("scrolled", window.scrollY > 40);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    if (toggle) {
      toggle.addEventListener("click", function () {
        document.body.classList.toggle("menu-open");
      });
      document.querySelectorAll(".nav-links a").forEach(function (a) {
        a.addEventListener("click", function () {
          document.body.classList.remove("menu-open");
        });
      });
    }
  }

  /* ---------- Shared helpers ---------- */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // How long each slide stays on screen (panoramas linger so they can pan).
  var SLIDE_MS = 7000;
  var PANO_MS = 14000;

  // def = { type: "single" | "pair" | "pano", srcs: [...] }
  // 360° panoramas mount a live, auto-rotating Pannellum viewer when Pannellum is
  // available; otherwise they fall back to a flat panning <img> (CSS-driven).
  function makeSlideEl(def, active) {
    var s = document.createElement("div");
    s.className = "hero-slide " + def.type + (active ? " active" : "");
    if (def.type === "pano" && window.pannellum) {
      s.dataset.pano = def.srcs[0];
      var holder = document.createElement("div");
      holder.className = "hero-pano";
      s.appendChild(holder);
    } else {
      def.srcs.forEach(function (src) {
        var img = document.createElement("img");
        // Only the first (active) slide loads immediately; the rest are loaded
        // just before their turn (see loadSlide) so the home page isn't forced
        // to download every hero image up front.
        if (active) { img.src = src; img.setAttribute("fetchpriority", "high"); }
        else { img.dataset.src = src; }
        img.alt = "";
        s.appendChild(img);
      });
    }
    return s;
  }

  // Kick off loading of any not-yet-loaded images in a slide.
  function loadSlide(slide) {
    if (!slide) return;
    slide.querySelectorAll("img[data-src]").forEach(function (img) {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
  }

  // Spin up an auto-rotating panorama inside a hero pano slide (showcase mode:
  // no on-screen controls, gentle drift, mouse-drag still allowed to peek).
  function mountHeroPano(slide) {
    if (!slide || slide._pano || !window.pannellum || !slide.dataset.pano) return;
    var holder = slide.querySelector(".hero-pano");
    if (!holder) return;
    slide._pano = window.pannellum.viewer(holder, {
      type: "equirectangular",
      panorama: slide.dataset.pano,
      autoLoad: true,
      autoRotate: -2,
      compass: false,
      showZoomCtrl: false,
      showFullscreenCtrl: false,
      keyboardZoom: false,
      mouseZoom: false,
      hfov: 100
    });
  }
  // Tear the viewer down once its slide leaves, freeing WebGL resources. Delayed
  // so the cross-fade finishes before the canvas disappears.
  function unmountHeroPano(slide) {
    if (slide && slide._pano) {
      var v = slide._pano; slide._pano = null;
      setTimeout(function () { try { v.destroy(); } catch (e) {} }, 1800);
    }
  }

  // Chained cross-fade cycler. Returns a stop() function.
  function cycleSlides(slides) {
    if (!slides.length) return function () {};
    loadSlide(slides[0]);
    if (slides[0].classList.contains("pano")) mountHeroPano(slides[0]);
    if (slides.length < 2) return function () { unmountHeroPano(slides[0]); };
    loadSlide(slides[1]);   // warm the next slide so the first crossfade is smooth
    var idx = 0, timer = null;
    function step() {
      var dur = slides[idx].classList.contains("pano") ? PANO_MS : SLIDE_MS;
      timer = setTimeout(function () {
        slides[idx].classList.remove("active");
        unmountHeroPano(slides[idx]);
        idx = (idx + 1) % slides.length;
        slides[idx].classList.add("active");
        loadSlide(slides[idx]);
        mountHeroPano(slides[idx]);
        loadSlide(slides[(idx + 1) % slides.length]);   // pre-warm the upcoming slide
        step();
      }, dur);
    }
    step();
    return function stop() { if (timer) clearTimeout(timer); unmountHeroPano(slides[idx]); };
  }

  /* ---------- Hero (full images, portraits paired two-up, 360 pans) ---------- */
  var heroDefs = [];   // assembled slide definitions, shared with the screensaver

  function buildHeroCandidates() {
    var preferred = ["landscape", "aerial", "astrophotography", "nature"];
    var pool = [];
    function add(c, f, pano) {
      var m = media(c.folder, f);
      pool.push({
        src: pano ? panoSrc(c.folder, f) : bestSrc(c.folder, f, 2560, "webp"),
        pano: pano,
        w: m && m.w, h: m && m.h
      });
    }
    preferred.forEach(function (id) {
      var c = DATA.find(function (x) { return x.id === id; });
      if (c) c.images.forEach(function (f) { add(c, f, false); });
    });
    var p = DATA.find(function (x) { return x.id === "360"; });
    if (p) p.images.forEach(function (f) { add(p, f, true); });

    if (pool.length < 3) {
      pool = allImages().map(function (i) {
        var m = media(i.folder, i.file);
        return { src: i.src, pano: false, w: m && m.w, h: m && m.h };
      });
    }
    return shuffle(pool).slice(0, 16);
  }

  // Detect orientation by loading each image, then assemble slide defs:
  // landscape -> single, 360 -> pano, portraits -> paired two-up (no empty bars).
  function buildHeroDefs(cb) {
    var cands = buildHeroCandidates();
    if (!cands.length) { cb([]); return; }
    var pending = cands.length;

    cands.forEach(function (c) {
      if (c.pano) { c.orient = "pano"; if (--pending === 0) assemble(); return; }
      // Use known dimensions from the manifest when available (no network load).
      if (c.w && c.h) {
        c.orient = (c.h > c.w * 1.05) ? "portrait" : "landscape";
        if (--pending === 0) assemble();
        return;
      }
      var im = new Image();
      im.onload = im.onerror = function () {
        c.orient = (im.naturalHeight > im.naturalWidth * 1.05) ? "portrait" : "landscape";
        if (--pending === 0) assemble();
      };
      im.src = c.src;
    });

    function assemble() {
      var defs = [], heldPortrait = null;
      cands.forEach(function (c) {
        if (c.orient === "pano") { defs.push({ type: "pano", srcs: [c.src] }); }
        else if (c.orient === "portrait") {
          if (heldPortrait) { defs.push({ type: "pair", srcs: [heldPortrait, c.src] }); heldPortrait = null; }
          else { heldPortrait = c.src; }
        } else { defs.push({ type: "single", srcs: [c.src] }); }
      });
      // A leftover single portrait would show big bars — pair it with another
      // portrait already used, or drop it, rather than display it alone.
      if (heldPortrait) {
        var firstPair = defs.find(function (d) { return d.type === "pair"; });
        if (firstPair) defs.push({ type: "pair", srcs: [heldPortrait, firstPair.srcs[0]] });
      }
      cb(shuffle(defs).slice(0, 10));
    }
  }

  function initHero() {
    var stage = document.getElementById("hero-slides");
    if (!stage) return;
    buildHeroDefs(function (defs) {
      heroDefs = defs;
      if (!defs.length) return;
      defs.forEach(function (d, i) { stage.appendChild(makeSlideEl(d, i === 0)); });
      cycleSlides(Array.prototype.slice.call(stage.querySelectorAll(".hero-slide")));
    });
  }

  /* ---------- Fullscreen screensaver ---------- */
  function initScreensaver() {
    var btn = document.getElementById("hero-fs");
    var ss = document.getElementById("screensaver");
    var stage = document.getElementById("ss-stage");
    var exit = document.getElementById("ss-exit");
    if (!btn || !ss || !stage) return;
    var stop = null;

    function go(defs) {
      stage.innerHTML = "";
      defs.forEach(function (d, i) { stage.appendChild(makeSlideEl(d, i === 0)); });
      ss.classList.add("open");
      document.body.style.overflow = "hidden";
      stop = cycleSlides(Array.prototype.slice.call(stage.querySelectorAll(".hero-slide")));
      if (ss.requestFullscreen) ss.requestFullscreen().catch(function () {});
    }
    function open() {
      if (heroDefs.length) go(heroDefs);
      else buildHeroDefs(function (d) { heroDefs = d; go(d); });
    }
    function close() {
      if (stop) { stop(); stop = null; }
      ss.classList.remove("open");
      stage.innerHTML = "";
      document.body.style.overflow = "";
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    }
    btn.addEventListener("click", open);
    exit.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (ss.classList.contains("open") && e.key === "Escape") close();
    });
    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && ss.classList.contains("open")) close();
    });
  }

  /* ---------- Series index cards (home + gallery page) ---------- */
  function initCategoryCards() {
    var grid = document.getElementById("cat-grid");
    if (!grid) return;
    var show = (grid.dataset.limit ? parseInt(grid.dataset.limit, 10) : DATA.length);
    DATA.slice(0, show).forEach(function (cat) {
      var cover = cat.images[0];
      var a = document.createElement("a");
      a.className = "cat-card reveal-up";
      a.href = "series.html#" + cat.id;
      a.appendChild(buildPicture(cat.folder, cover,
        "(max-width:700px) 50vw, (max-width:1100px) 33vw, 25vw", { alt: cat.title }));
      var label = document.createElement("div");
      label.className = "label";
      label.innerHTML = '<div class="t">' + cat.title + '</div>' +
        '<div class="n">' + cat.images.length + ' image' + (cat.images.length > 1 ? "s" : "") + '</div>';
      a.appendChild(label);
      grid.appendChild(a);
    });
  }

  /* ---------- Framed prints showcase ---------- */
  function pickFromCats(ids) {
    var out = [];
    ids.forEach(function (id) {
      var c = DATA.find(function (x) { return x.id === id; });
      if (c) c.images.forEach(function (f) { out.push(bestSrc(c.folder, f, 1280, "webp")); });
    });
    return shuffle(out);
  }

  function initPrints() {
    var grid = document.getElementById("prints-grid");
    if (!grid) return;

    var PD = window.PRINTS_DATA;
    var srcs;
    if (PD && PD.images && PD.images.length) {
      srcs = shuffle(PD.images.slice()).map(function (f) { return bestSrc(PD.folder, f, 1280, "webp"); });
    } else {
      // No prints/ folder yet — show a mix of strong gallery images as placeholders.
      srcs = pickFromCats(["fine-art", "landscape", "aerial", "nature", "astrophotography", "architectural"]).slice(0, 6);
    }
    var styles = ["s1", "s2", "s3"];
    srcs.forEach(function (src, i) {
      var fig = document.createElement("figure");
      fig.className = "print " + styles[i % 3];
      fig.innerHTML = '<div class="frame"><img loading="lazy" src="' + src + '" alt="Framed print"></div>';
      grid.appendChild(fig);
    });
  }

  /* ---------- Video portfolio (one row: 3 portrait + 2 landscape, rotating) ---------- */
  function pickSome(arr, n) {
    return shuffle((arr || []).slice()).slice(0, n);
  }

  function initVideos() {
    var VD = window.VIDEO_DATA;
    var row = document.getElementById("video-row");
    if (!VD || !row) return;

    // A fresh, mixed selection each visit so the reel changes over time.
    var picks = [];
    pickSome(VD.portrait, 3).forEach(function (f) { picks.push({ f: f, o: "portrait" }); });
    pickSome(VD.landscape, 2).forEach(function (f) { picks.push({ f: f, o: "landscape" }); });
    shuffle(picks);

    if (!picks.length) { row.closest("section").style.display = "none"; return; }

    picks.forEach(function (item) {
      var src = VD.folder + "/" + encodeURIComponent(item.f);
      var card = document.createElement("div");
      card.className = "video-card " + item.o + " reveal-up";
      card.innerHTML =
        '<video muted loop playsinline preload="metadata" src="' + src + '#t=0.1"></video>' +
        '<span class="play-ico" aria-hidden="true">&#9658;</span>';
      var vid = card.querySelector("video");
      card.addEventListener("mouseenter", function () {
        var p = vid.play();
        if (p && p.catch) p.catch(function () {});
      });
      card.addEventListener("mouseleave", function () { vid.pause(); vid.currentTime = 0.1; });
      card.addEventListener("click", function () { openVideo(src); });
      row.appendChild(card);
    });
  }

  function openVideo(src) {
    var modal = document.getElementById("video-modal");
    if (!modal) return;
    var v = document.getElementById("vm-video");
    v.src = src;
    v.muted = false;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  function closeVideo() {
    var modal = document.getElementById("video-modal");
    if (!modal) return;
    var v = document.getElementById("vm-video");
    v.pause();
    v.removeAttribute("src");
    v.load();
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
  function initVideoModal() {
    var modal = document.getElementById("video-modal");
    if (!modal) return;
    modal.querySelector(".vm-close").addEventListener("click", closeVideo);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeVideo(); });
    document.addEventListener("keydown", function (e) {
      if (modal.classList.contains("open") && e.key === "Escape") closeVideo();
    });
  }

  /* ---------- Blog index + individual post pages ---------- */
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function initBlog() {
    var grid = document.getElementById("blog-grid");
    var POSTS = window.POSTS;
    if (!grid || !POSTS) return;
    POSTS.forEach(function (post, i) {
      var a = document.createElement("a");
      a.className = "post reveal-up" + (i === 0 ? " post--feature" : "");
      a.href = "post.html?slug=" + encodeURIComponent(post.slug);
      a.innerHTML =
        '<div class="thumb"><img loading="lazy" src="' + post.thumb + '" alt="' + post.title + '"></div>' +
        '<div>' +
          '<div class="meta">' + post.category + ' · ' + post.read + '</div>' +
          '<h3>' + post.title + '</h3>' +
          '<p>' + post.excerpt + '</p>' +
        '</div>';
      grid.appendChild(a);
    });
  }

  function renderBody(entries) {
    return entries.map(function (e) {
      var t = e.trim();
      if (t.indexOf("##") === 0) return "<h2>" + t.replace(/^##\s*/, "") + "</h2>";
      if (t.charAt(0) === "<") return t;                 // raw html (img, blockquote…)
      return "<p>" + t + "</p>";
    }).join("\n");
  }

  function initPost() {
    var root = document.getElementById("article");
    var POSTS = window.POSTS;
    if (!root || !POSTS) return;

    var params = new URLSearchParams(location.search);
    var slug = params.get("slug");
    var idx = 0;
    for (var i = 0; i < POSTS.length; i++) { if (POSTS[i].slug === slug) { idx = i; break; } }
    var post = POSTS[idx];
    if (!post) return;

    document.title = post.title + " — Lio Photography | Chaminda Perera";
    var set = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    set("post-cat", post.category);
    set("post-title", post.title);
    set("post-byline", fmtDate(post.date) + "  ·  " + post.read + "  ·  Chaminda Perera");

    var hero = document.getElementById("post-hero");
    if (hero) { hero.src = post.thumb; hero.alt = post.title; }

    var body = document.getElementById("post-body");
    if (body) body.innerHTML = renderBody(post.body || []);

    // prev / next
    var nav = document.getElementById("post-nav");
    if (nav) {
      var prev = POSTS[idx - 1], next = POSTS[idx + 1];
      var html = "";
      html += prev
        ? '<a class="pn pn-prev" href="post.html?slug=' + encodeURIComponent(prev.slug) + '"><span>Previous</span>' + prev.title + '</a>'
        : '<span></span>';
      html += next
        ? '<a class="pn pn-next" href="post.html?slug=' + encodeURIComponent(next.slug) + '"><span>Next</span>' + next.title + '</a>'
        : '<span></span>';
      nav.innerHTML = html;
    }
  }

  /* ---------- Single series page (immersive masonry + lightbox) ---------- */
  var lb = { items: [], idx: 0 };

  function initSeries() {
    var grid = document.getElementById("masonry");
    if (!grid) return;

    var hash = (location.hash || "").replace("#", "");
    var cat = DATA.find(function (c) { return c.id === hash; }) || DATA[0];
    if (!cat) return;

    // Page heading + document title
    var titleEl = document.getElementById("series-title");
    var countEl = document.getElementById("series-count");
    if (titleEl) titleEl.textContent = cat.title;
    if (countEl) countEl.textContent = cat.images.length + " photograph" + (cat.images.length > 1 ? "s" : "");
    document.title = cat.title + " — Lio Photography | Chaminda Perera";

    // Build "next series" link for continuous browsing
    var nextLink = document.getElementById("series-next");
    if (nextLink) {
      var pos = DATA.indexOf(cat);
      var next = DATA[(pos + 1) % DATA.length];
      nextLink.href = "series.html#" + next.id;
      nextLink.textContent = "Next series — " + next.title;
    }

    // The 360° album holds equirectangular images — open them in an immersive
    // panorama viewer instead of the flat lightbox.
    var is360 = cat.id === "360";

    lb.items = [];
    var panoItems = [];   // ordered list of 360 panoramas for the tour viewer
    cat.images.forEach(function (file) {
      var i = lb.items.length;
      lb.items.push({ folder: cat.folder, file: file, cat: cat.title });
      if (is360) panoItems.push({ folder: cat.folder, file: file, src: panoSrc(cat.folder, file) });

      var tile = document.createElement("figure");
      tile.className = "tile" + (is360 ? " tile--360" : "");
      tile.dataset.idx = i;
      tile.appendChild(buildPicture(cat.folder, file,
        "(max-width:700px) 100vw, (max-width:1100px) 50vw, 33vw",
        { alt: cat.title + " photograph" }));
      if (is360) {
        var badge = document.createElement("span");
        badge.className = "tile-360-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "360°";
        tile.appendChild(badge);
      }
      var cap = document.createElement("figcaption");
      cap.className = "tile-cap";
      cap.innerHTML = '<span class="c">' + cat.title + '</span>';
      tile.appendChild(cap);
      if (is360) {
        tile.addEventListener("click", function () { openPano(i); });
      } else {
        tile.addEventListener("click", function () { openLightbox(parseInt(tile.dataset.idx, 10)); });
      }
      grid.appendChild(tile);
    });
    panoTour.items = panoItems;
    revealTiles();

    // Re-render if the user navigates between series via hash change (bind once)
    if (!initSeries._bound) {
      initSeries._bound = true;
      window.addEventListener("hashchange", function () {
        var g = document.getElementById("masonry");
        if (g) g.innerHTML = "";
        window.scrollTo({ top: 0 });
        initSeries();
      });
    }
  }

  /* ---------- Lightbox ---------- */
  function openLightbox(i) {
    var box = document.getElementById("lightbox");
    if (!box || !lb.items[i]) return;
    lb.idx = i;
    paintLightbox();
    box.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function paintLightbox() {
    var item = lb.items[lb.idx];
    var lbImg = document.getElementById("lb-img");
    var m = media(item.folder, item.file);
    if (m && m.variants && m.variants.length) {
      lbImg.srcset = m.variants.map(function (w) {
        return webPath(item.folder, item.file, w, "webp") + " " + w + "w";
      }).join(", ");
      lbImg.sizes = "100vw";
      lbImg.src = bestSrc(item.folder, item.file, 2048, "jpg");
    } else {
      lbImg.removeAttribute("srcset");
      lbImg.src = imgPath(item.folder, item.file);
    }
    var meta = document.getElementById("lb-meta");
    if (meta) meta.textContent = item.cat + "  ·  " + (lb.idx + 1) + " / " + lb.items.length;
  }
  function moveLightbox(d) {
    lb.idx = (lb.idx + d + lb.items.length) % lb.items.length;
    paintLightbox();
  }
  function closeLightbox() {
    var box = document.getElementById("lightbox");
    if (box) box.classList.remove("open");
    document.body.style.overflow = "";
  }
  function initLightboxControls() {
    var box = document.getElementById("lightbox");
    if (!box) return;
    box.querySelector(".lb-close").addEventListener("click", closeLightbox);
    box.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); moveLightbox(-1); });
    box.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); moveLightbox(1); });
    box.addEventListener("click", function (e) { if (e.target === box) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") moveLightbox(-1);
      if (e.key === "ArrowRight") moveLightbox(1);
    });
  }

  /* ---------- 360° panorama viewer (equirectangular tour, via Pannellum) ---------- */
  var panoViewer = null, panoMap = null, panoMarker = null;
  var panoTour = { items: [], idx: 0 };   // items: [{folder, file, src}]
  var NEARBY_KM = 3;                       // jump arrows only between panoramas this close

  // Resolve a panorama's location: manual PANO_LOCATIONS first, else EXIF GPS.
  function panoLoc(item) {
    if (!item) return null;
    var locs = window.PANO_LOCATIONS || {};
    if (locs[item.file]) return locs[item.file];
    var m = media(item.folder, item.file);
    if (m && m.geo) return { lat: m.geo.lat, lng: m.geo.lng };
    return null;
  }

  function haversineKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function bearingDeg(a, b) {   // initial compass bearing a->b (0=N, 90=E)
    var rad = Math.PI / 180, deg = 180 / Math.PI;
    var dLng = (b.lng - a.lng) * rad;
    var y = Math.sin(dLng) * Math.cos(b.lat * rad);
    var x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
            Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLng);
    return (Math.atan2(y, x) * deg + 360) % 360;
  }

  // Custom transparent arrow element for a directional jump hotspot.
  function panoJumpTooltip(div, args) {
    div.innerHTML = '<span class="pano-jump-ico">➤</span>';
    if (args && args.label) {
      var t = document.createElement("span");
      t.className = "pano-jump-label";
      t.textContent = args.label;
      div.appendChild(t);
    }
  }

  // Build "scene" hotspots pointing at nearby panoramas, placed at their bearing.
  function panoHotSpots(i) {
    var from = panoLoc(panoTour.items[i]);
    if (!from || from.lat == null) return [];
    var north = (from.north != null) ? from.north : 0;
    var spots = [];
    panoTour.items.forEach(function (it, j) {
      if (j === i) return;
      var to = panoLoc(it);
      if (!to || to.lat == null) return;
      if (haversineKm(from, to) > NEARBY_KM) return;
      var yaw = ((bearingDeg(from, to) - north + 540) % 360) - 180;  // -> [-180,180]
      spots.push({
        id: "jump-" + j,
        type: "scene",
        sceneId: "s" + j,
        pitch: -3,
        yaw: yaw,
        cssClass: "pano-jump",
        createTooltipFunc: panoJumpTooltip,
        createTooltipArgs: { label: (to.label || "") }
      });
    });
    return spots;
  }

  // Show/update the location mini-map for the current panorama.
  function updatePanoMapForItem(item) {
    var panel = document.getElementById("pano-map");
    if (!panel) return;
    var loc = panoLoc(item);
    if (!loc || loc.lat == null || !window.L) { panel.classList.remove("show"); return; }
    panel.classList.add("show");
    var labelEl = document.getElementById("pano-map-label");
    if (labelEl) labelEl.textContent = loc.label || "";
    if (!panoMap) {
      panoMap = window.L.map("pano-map-canvas", { zoomControl: false, scrollWheelZoom: false, attributionControl: false });
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap"
      }).addTo(panoMap);
    }
    panoMap.setView([loc.lat, loc.lng], loc.zoom || 13);
    if (panoMarker) panoMarker.setLatLng([loc.lat, loc.lng]);
    else panoMarker = window.L.circleMarker([loc.lat, loc.lng], {
      radius: 7, color: "#fff", weight: 2, fillColor: "#c9a86a", fillOpacity: 1
    }).addTo(panoMap);
    if (loc.label) panoMarker.bindPopup(loc.label);
    setTimeout(function () { try { panoMap.invalidateSize(); } catch (e) {} }, 80);
  }

  // Navigate to panorama `idx` (wraps around). Smooth scene fade when possible.
  function panoGo(idx) {
    if (!panoTour.items.length) return;
    var n = panoTour.items.length;
    idx = ((idx % n) + n) % n;
    panoTour.idx = idx;
    if (panoViewer && panoViewer.loadScene) panoViewer.loadScene("s" + idx);
  }

  function syncPanoUI() {
    var modal = document.getElementById("pano-modal");
    if (modal) modal.classList.toggle("pano-single", panoTour.items.length < 2);
    updatePanoMapForItem(panoTour.items[panoTour.idx]);
  }

  // `arg` is an index into panoTour.items (number); a src string is also accepted.
  function openPano(arg) {
    var modal = document.getElementById("pano-modal");
    var stage = document.getElementById("pano-stage");
    var idx = 0;
    if (typeof arg === "number") idx = arg;
    else idx = Math.max(0, panoTour.items.findIndex(function (it) { return it.src === arg; }));

    // Fall back to the flat lightbox if the viewer library failed to load.
    if (!modal || !stage || !window.pannellum || !panoTour.items.length) {
      if (lb.items[idx]) openLightbox(idx);
      return;
    }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    panoTour.idx = idx;

    if (panoViewer) { panoViewer.destroy(); panoViewer = null; }
    var scenes = {};
    panoTour.items.forEach(function (it, i) {
      scenes["s" + i] = { type: "equirectangular", panorama: it.src, hotSpots: panoHotSpots(i) };
    });
    panoViewer = window.pannellum.viewer(stage, {
      default: {
        firstScene: "s" + idx,
        sceneFadeDuration: 700,
        autoLoad: true,
        autoRotate: -2,
        compass: false,
        showZoomCtrl: true,
        showFullscreenCtrl: true,
        hfov: 110,
        friction: 0.2
      },
      scenes: scenes
    });
    panoViewer.on("scenechange", function (sceneId) {
      var i = parseInt(String(sceneId).slice(1), 10);
      if (!isNaN(i)) panoTour.idx = i;
      updatePanoMapForItem(panoTour.items[panoTour.idx]);
    });
    syncPanoUI();
  }

  function closePano() {
    var modal = document.getElementById("pano-modal");
    if (!modal) return;
    modal.classList.remove("open", "near-left", "near-right");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (panoViewer) { panoViewer.destroy(); panoViewer = null; }
    var panel = document.getElementById("pano-map");
    if (panel) panel.classList.remove("show");
  }

  function initPanoControls() {
    var modal = document.getElementById("pano-modal");
    if (!modal) return;
    modal.querySelector(".pano-close").addEventListener("click", closePano);
    var prev = modal.querySelector(".pano-prev");
    var next = modal.querySelector(".pano-next");
    if (prev) prev.addEventListener("click", function (e) { e.stopPropagation(); panoGo(panoTour.idx - 1); });
    if (next) next.addEventListener("click", function (e) { e.stopPropagation(); panoGo(panoTour.idx + 1); });

    // Reveal the prev/next arrows only when the pointer nears the left/right edge.
    // Capture phase so it fires even though Pannellum handles pointer events on its canvas.
    modal.addEventListener("mousemove", function (e) {
      var w = modal.clientWidth, edge = Math.min(170, w * 0.18);
      modal.classList.toggle("near-left", e.clientX < edge);
      modal.classList.toggle("near-right", e.clientX > w - edge);
    }, true);
    modal.addEventListener("mouseleave", function () {
      modal.classList.remove("near-left", "near-right");
    });

    document.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("open")) return;
      if (e.key === "Escape") closePano();
      else if (e.key === "ArrowLeft") panoGo(panoTour.idx - 1);
      else if (e.key === "ArrowRight") panoGo(panoTour.idx + 1);
    });
  }

  /* ---------- Statistics count-up ---------- */
  function initStats() {
    var nums = document.querySelectorAll(".stat-num");
    if (!nums.length || !("IntersectionObserver" in window)) {
      nums.forEach(function (el) { el.textContent = (parseInt(el.dataset.target, 10) || 0).toLocaleString(); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; obs.unobserve(el);
        var target = parseInt(el.dataset.target, 10) || 0, start = null, dur = 1400;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          // ease-out so it decelerates into the final number
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target).toLocaleString();
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target.toLocaleString();
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { obs.observe(n); });
  }

  /* ---------- Pexels showcase (row of six, gently rotating) ---------- */
  function initPexels() {
    var grid = document.getElementById("pexels-grid");
    var P = window.PEXELS;
    if (!grid || !P || !P.photos || !P.photos.length) return;
    var photos = P.photos, VISIBLE = 6;
    function thumb(p) { return p.img + "?auto=compress&cs=tinysrgb&fit=crop&w=600&h=400"; }
    function fill(slot, p) {
      slot.a.href = p.page || P.profile;
      slot.img.src = thumb(p);
      slot.img.onerror = function () { slot.a.style.visibility = "hidden"; };
      slot.badge.textContent = p.views ? p.views + " views" : "";
      slot.badge.style.display = p.views ? "" : "none";
    }
    // Build 6 fixed slots and show the first six photos.
    var slots = [];
    for (var i = 0; i < VISIBLE; i++) {
      var a = document.createElement("a");
      a.target = "_blank"; a.rel = "noopener"; a.className = "pexels-item";
      var img = document.createElement("img");
      img.loading = "lazy"; img.alt = "Photograph by Lio Photography on Pexels";
      var badge = document.createElement("span"); badge.className = "pexels-views";
      a.appendChild(img); a.appendChild(badge);
      grid.appendChild(a);
      var slot = { a: a, img: img, badge: badge };
      fill(slot, photos[i % photos.length]);
      slots.push(slot);
    }
    if (photos.length <= VISIBLE) return;   // nothing to rotate

    // Every few seconds, fade ONE tile (round-robin) to the next photo in the
    // queue — a gentle ticker that cycles all photos through the six slots.
    var slotPtr = 0, photoPtr = VISIBLE % photos.length;
    setInterval(function () {
      var slot = slots[slotPtr], p = photos[photoPtr];
      var pre = new Image();             // preload so the swap is instant
      pre.onload = pre.onerror = function () {
        slot.a.classList.add("fade");
        setTimeout(function () { fill(slot, p); slot.a.classList.remove("fade"); }, 350);
      };
      pre.src = thumb(p);
      slotPtr = (slotPtr + 1) % slots.length;
      photoPtr = (photoPtr + 1) % photos.length;
    }, 3200);
  }

  /* ---------- Newsletter (Netlify Forms) ---------- */
  function initNewsletter() {
    var form = document.getElementById("newsletter-form");
    if (!form) return;
    var msg = document.getElementById("newsletter-msg");
    function say(text, cls) {
      if (!msg) return;
      msg.textContent = text;
      msg.className = "newsletter-msg" + (cls ? " " + cls : "");
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = new URLSearchParams(new FormData(form)).toString();
      say("Subscribing…");
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body
      }).then(function (r) {
        if (!r.ok) throw new Error("submit failed");
        form.reset();
        say("Thanks — you're subscribed! 🎉", "ok");
      }).catch(function () {
        say("Sorry, that didn't go through. Please try again.", "err");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var io;
  function getObserver() {
    if (io) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("reveal");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    return io;
  }
  function observe(els) { var o = getObserver(); els.forEach(function (el) { o.observe(el); }); }
  function revealTiles() { observe(Array.prototype.slice.call(document.querySelectorAll(".tile"))); }
  function initReveal() { observe(Array.prototype.slice.call(document.querySelectorAll(".reveal-up"))); }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initHero();
    initScreensaver();
    initCategoryCards();
    initPrints();
    initVideos();
    initVideoModal();
    initBlog();
    initPost();
    initSeries();
    initLightboxControls();
    initPanoControls();
    initStats();
    initPexels();
    initNewsletter();
    initReveal();
    var yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();
  });
})();
