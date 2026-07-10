/* ============================================================
   Albert & Tamara — App logic
   Renders all content from content.json + cinematic motion
   ============================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let stopPresentation = null;
let uiStrings = {};

/* ---------- Boot ---------- */
async function boot() {
  let data;
  try {
    const res = await fetch("content.json", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    console.log("[v0] Failed to load content.json:", e.message);
    return;
  }

  document.title = data.meta.title;
  const metaDesc = $('meta[name="description"]');
  if (metaDesc && data.meta.description) metaDesc.setAttribute("content", data.meta.description);

  uiStrings = data.ui || {};

  renderLoader(data.loader);
  renderHero(data.hero);
  renderEvent(data.event);
  renderCountdown(data.countdown, data.meta.weddingDateISO);
  renderMemories(data.memories);
  renderGallery(data.gallery);
  renderClosing(data.closing);
  renderFooter(data.meta);

  spawnParticles($("#hero .particles"), 26);
  spawnParticles($("#countdown .particles"), 18);
  spawnParticles($("#closing .particles"), 22);

  setupReveal();
  setupParallax();
  setupTilt();
  setupLightbox(uiStrings);
  setupAutoScroll(uiStrings);
  setupBackgroundMusic(uiStrings);

  runLoaderSequence();
}

/* ---------- Helpers ---------- */
function splitChars(text, baseDelay = 0, step = 0.04) {
  return text
    .split("")
    .map((ch, i) => {
      if (ch === " ") return `<span class="char" style="animation-delay:${baseDelay + i * step}s">&nbsp;</span>`;
      return `<span class="char" style="animation-delay:${baseDelay + i * step}s">${ch}</span>`;
    })
    .join("");
}

function splitWords(el, text) {
  if (!el) return;
  if (prefersReduced) {
    el.textContent = text;
    return;
  }
  el.innerHTML = text
    .split(/\s+/)
    .map((w) => `<span class="word-mask"><span class="word">${w}</span></span>`)
    .join(" ");
}

function spawnParticles(container, count) {
  if (!container || prefersReduced) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const size = Math.random() * 5 + 2;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.setProperty("--drift", `${(Math.random() - 0.5) * 120}px`);
    p.style.animationDuration = `${Math.random() * 12 + 10}s`;
    p.style.animationDelay = `${Math.random() * 12}s`;
    container.appendChild(p);
  }
}

/* ---------- Scene 1: Loader ---------- */
function renderLoader(d) {
  $("#loader-monogram").textContent = d.monogram;
  $("#loader-names").textContent = d.names;
  $("#loader-tagline").textContent = d.tagline;
}

function runLoaderSequence() {
  const loader = $("#loader");
  const delay = prefersReduced ? 400 : 4200;
  setTimeout(() => {
    loader.classList.add("done");
    document.body.classList.remove("is-loading");
  }, delay);
}

/* ---------- Scene 2: Hero ---------- */
function renderHero(d) {
  $("#hero-kicker").textContent = d.kicker;
  $("#hero-date").textContent = d.date;
  $("#hero-subtitle").textContent = d.subtitle;
  $("#hero-message").textContent = d.message;
  $("#hero-scroll-text").textContent = d.scrollHint;

  const base = prefersReduced ? 0 : 2.3;
  $("#hero-groom").innerHTML = splitChars(d.groom, base);
  $("#hero-amp").innerHTML = `<span class="char" style="animation-delay:${base + 0.5}s">${d.ampersand}</span>`;
  $("#hero-bride").innerHTML = splitChars(d.bride, base + 0.7);

  // sequenced fades for the rest
  const fadeEls = [
    ["#hero-kicker", base - 0.4 < 0 ? 0 : base - 0.4],
    ["#hero-date", base + 1.6],
    ["#hero-divider", base + 1.8],
    ["#hero-subtitle", base + 2.0],
    ["#hero-message", base + 2.2],
  ];
  fadeEls.forEach(([sel, dl]) => {
    const el = $(sel);
    el.classList.add("fade-seq");
    el.style.animationDelay = `${dl}s`;
  });
}

function setupParallax() {
  const progress = $("#scroll-progress");
  const layers = $$("[data-parallax]").map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax) || 0,
    fade: el.dataset.parallaxFade === "true",
    section: el.closest("section") || el.parentElement,
  }));
  const imgs = $$(".parallax-img").map((el) => ({
    el,
    frame: el.closest(".memory-media, .masonry-item") || el.parentElement,
  }));

  const vh = () => window.innerHeight;
  let ticking = false;

  function update() {
    ticking = false;
    const scrollY = window.scrollY;
    const docH = document.documentElement.scrollHeight - vh();

    // progress bar
    if (progress) {
      const p = docH > 0 ? scrollY / docH : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    }

    if (prefersReduced) return;

    const viewH = vh();

    // depth layers — translate relative to their section's position in viewport
    for (const { el, speed, fade, section } of layers) {
      if (!section) continue;
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > viewH + 200) continue;
      // distance of section center from viewport center
      const center = rect.top + rect.height / 2 - viewH / 2;
      const offset = -center * speed;
      el.style.setProperty("--py", `${offset.toFixed(2)}px`);
      if (fade) {
        const f = 1 - Math.min(1, Math.max(0, -rect.top / (viewH * 0.85)));
        el.style.setProperty("--pf", f.toFixed(3));
      }
    }

    // in-frame image parallax — slides within its overflow:hidden frame
    for (const { el, frame } of imgs) {
      const rect = frame.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > viewH + 100) continue;
      const progressThrough = (rect.top + rect.height / 2 - viewH / 2) / viewH; // -1..1
      const shift = -progressThrough * 36; // px range
      el.style.setProperty("--py", `${shift.toFixed(2)}px`);
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
}

/* ---------- Pointer tilt on cards ---------- */
function setupTilt() {
  if (prefersReduced) return;
  if (window.matchMedia("(hover: none)").matches) return;
  const cards = $$(".tilt");
  cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-6px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

/* ---------- Scene 3: Event ---------- */
function renderEvent(d) {
  $("#event-label").textContent = d.label;
  splitWords($("#event-title"), d.title);
  const labels = d.labels || {};
  const grid = $("#event-grid");
  grid.innerHTML = d.cards
    .map(
      (c, i) => `
    <div class="event-card tilt reveal-scale delay-${i + 1}">
      <div class="heading">${c.heading}</div>
      <div class="ornament"></div>
      <div class="row"><span class="lbl">${labels.date || ""}</span><span class="val">${c.date}</span></div>
      <div class="row"><span class="lbl">${labels.time || ""}</span><span class="val">${c.time}</span></div>
      <div class="row"><span class="lbl">${labels.venue || ""}</span><span class="val">${c.venue}</span></div>
      <div class="row"><span class="lbl">${labels.address || ""}</span><span class="val sm">${
        c.mapUrl
          ? `<a class="address-link" href="${c.mapUrl}" target="_blank" rel="noopener noreferrer">📍 ${c.address}</a>`
          : `📍 ${c.address}`
      }</span></div>
    </div>`
    )
    .join("");
}

/* ---------- Scene 4: Countdown ---------- */
function renderCountdown(d, targetISO) {
  $("#countdown-label").textContent = d.label;
  splitWords($("#countdown-title"), d.title);

  const target = new Date(targetISO).getTime();
  const grid = $("#count-grid");
  grid.classList.add("reveal");
  const order = ["days", "hours", "minutes", "seconds"];
  grid.innerHTML = order
    .map(
      (u, i) => `
      <div class="count-unit">
        <div class="count-num" id="count-${u}">00</div>
        <div class="count-label">${d.units[u]}</div>
      </div>
      ${i < order.length - 1 ? '<div class="count-sep">:</div>' : ""}`
    )
    .join("");

  const prev = {};
  function tick() {
    const now = Date.now();
    let diff = target - now;
    if (diff <= 0) {
      grid.innerHTML = `<p class="count-passed">${d.passed}</p>`;
      clearInterval(timer);
      return;
    }
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000);
    diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);

    const vals = { days, hours, minutes, seconds };
    order.forEach((u) => {
      const el = $(`#count-${u}`);
      if (!el) return;
      const str = String(vals[u]).padStart(2, "0");
      if (prev[u] !== str) {
        el.textContent = str;
        if (!prefersReduced) {
          el.classList.remove("count-flip");
          void el.offsetWidth;
          el.classList.add("count-flip");
        }
        prev[u] = str;
      }
    });
  }
  tick();
  const timer = setInterval(tick, 1000);
}

/* ---------- Scene 5: Memories ---------- */
function renderMemories(d) {
  $("#memories-label").textContent = d.label;
  splitWords($("#memories-title"), d.title);
  const wrap = $("#memories-list");
  wrap.innerHTML =
    d.items
      .map(
        (m, i) => {
          const fromLeft = i % 2 === 0;
          return `
            <div class="memory reveal">
              <div class="memory-media clip-reveal"><img class="parallax-img" src="${m.image}" alt="${d.memoryAlt || ""}" loading="lazy" /></div>
              <blockquote class="memory-body ${fromLeft ? "reveal-right" : "reveal-left"}">
                <p class="memory-quote">&ldquo;${m.quote}&rdquo;</p>
                <cite class="memory-author">${m.author}</cite>
              </blockquote>
            </div>`;
        }
      )
      .join("") + `<p class="memory-wish reveal-scale">${d.wish}</p>`;
}

/* ---------- Scene 6: Gallery ---------- */
let galleryImages = [];
function renderGallery(d) {
  $("#gallery-label").textContent = d.label;
  splitWords($("#gallery-title"), d.title);
  galleryImages = d.images;
  const grid = $("#gallery-grid");
  grid.innerHTML = d.images
    .map(
      (img, i) => `
    <figure class="masonry-item reveal-scale" data-index="${i}" style="transition-delay:${(i % 3) * 0.08}s">
      <img src="${img.src}" alt="${img.alt}" loading="lazy" />
    </figure>`
    )
    .join("");
}

function setupLightbox(ui = {}) {
  const lb = $("#lightbox");
  const lbImg = $("#lightbox-img");
  let current = 0;

  if (ui.imageViewer) lb.setAttribute("aria-label", ui.imageViewer);
  if (ui.close) $("#lightbox-close").setAttribute("aria-label", ui.close);
  if (ui.previousImage) $("#lightbox-prev").setAttribute("aria-label", ui.previousImage);
  if (ui.nextImage) $("#lightbox-next").setAttribute("aria-label", ui.nextImage);

  function open(i) {
    current = i;
    if (stopPresentation) stopPresentation();
    lbImg.src = galleryImages[i].src;
    lbImg.alt = galleryImages[i].alt;
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function close() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
  }
  function step(dir) {
    current = (current + dir + galleryImages.length) % galleryImages.length;
    lbImg.src = galleryImages[current].src;
    lbImg.alt = galleryImages[current].alt;
  }

  $("#gallery-grid").addEventListener("click", (e) => {
    const item = e.target.closest(".masonry-item");
    if (item) open(Number(item.dataset.index));
  });
  $("#lightbox-close").addEventListener("click", close);
  $("#lightbox-prev").addEventListener("click", () => step(-1));
  $("#lightbox-next").addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => {
    if (e.target === lb) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}

/* ---------- Scene 7: Closing ---------- */
function renderClosing(d) {
  $("#closing-message").textContent = d.message;
  $("#closing-signature").textContent = d.signature;
  $("#closing-names").textContent = d.names;
}

function renderFooter(meta) {
  $("#footer-mono").textContent = meta.monogram;
  $("#footer-text").textContent = meta.title;
}

/* ---------- Background music ---------- */
function setupBackgroundMusic(ui = {}) {
  const audio = $("#bg-music");
  const btn = $("#music-btn");
  if (!audio || !btn) return;

  let muted = false;

  function syncUI() {
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-pressed", String(muted));
    btn.setAttribute("aria-label", muted ? ui.unmuteMusic || "Unmute music" : ui.muteMusic || "Mute music");
    audio.muted = muted;
  }

  function tryPlay() {
    if (!muted) audio.play().catch(() => {});
  }

  btn.addEventListener("click", () => {
    muted = !muted;
    syncUI();
    if (!muted) tryPlay();
  });

  syncUI();

  document.addEventListener("pointerdown", tryPlay, { once: true });
  setTimeout(tryPlay, prefersReduced ? 500 : 4300);
}

/* ---------- Presentation auto-scroll ---------- */
function setupAutoScroll(ui = {}) {
  const btn = $("#presentation-btn");
  if (!btn) return;

  const PAUSE_AT_END_MS = 2800;
  const speedPxPerSec = () => window.innerHeight * 0.25;

  let active = false;
  let rafId = null;
  let pauseTimer = null;
  let lastTime = 0;
  let scrollPos = 0;
  let pausing = false;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function clearMotion() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
    lastTime = 0;
    pausing = false;
  }

  function tick(now) {
    if (!active || pausing) return;

    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const limit = maxScroll();
    scrollPos += speedPxPerSec() * dt;

    if (scrollPos >= limit) {
      scrollPos = limit;
      window.scrollTo(0, scrollPos);
      pausing = true;
      pauseTimer = setTimeout(() => {
        if (!active) return;
        scrollPos = 0;
        window.scrollTo(0, 0);
        pausing = false;
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }, PAUSE_AT_END_MS);
      return;
    }

    window.scrollTo(0, scrollPos);
    rafId = requestAnimationFrame(tick);
  }

  function setUi(on) {
    btn.classList.toggle("is-active", on);
    document.body.classList.toggle("is-presenting", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? ui.pausePresentation : ui.startPresentation);
    $(".presentation-btn-label", btn).textContent = on ? ui.pause : ui.present;
  }

  function start() {
    active = true;
    scrollPos = window.scrollY;
    setUi(true);
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    active = false;
    clearMotion();
    setUi(false);
  }

  stopPresentation = stop;

  btn.addEventListener("click", () => {
    if (active) stop();
    else start();
  });

  const stopOnUser = () => {
    if (active) stop();
  };
  window.addEventListener("wheel", stopOnUser, { passive: true });
  window.addEventListener("touchstart", stopOnUser, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) {
      stopOnUser();
    }
  });
  window.addEventListener("resize", () => {
    if (!active) return;
    scrollPos = Math.min(scrollPos, maxScroll());
  });
}

/* ---------- Reveal on scroll ---------- */
function setupReveal() {
  const els = $$(".reveal, .reveal-left, .reveal-right, .reveal-scale, .clip-reveal");
  if (prefersReduced) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          entry.target
            .querySelectorAll(".clip-reveal, .reveal-left, .reveal-right, .reveal-scale")
            .forEach((child) => child.classList.add("in"));
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

document.addEventListener("DOMContentLoaded", boot);
