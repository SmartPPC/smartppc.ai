// ─── Site config — fill these in ──────────────────────────────────────────────
// Booking lives on book.html (Cal.com: cal.com/smartppc/free-audit); contact: info@smartppc.ai
const CONFIG = {
  linkedinPartnerId: "", // LinkedIn Insight Tag partner ID (Campaign Manager → Insight Tag)
};

const root = document.documentElement;
const nav = document.querySelector(".nav");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const pad = (n) => String(n).padStart(2, "0");

// ─── Starburst motif (same construction as the ad's Starburst.tsx) ───────────
const rand = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attrs) => {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
document.querySelectorAll("[data-starburst]").forEach((g) => {
  const n = Number(g.dataset.spokes || 64);
  const R = 190;
  const inner = 24;
  g.append(svgEl("circle", { r: R * 0.98, class: "ring", "stroke-width": 1.5, opacity: 0.5 }));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const major = i % 4 === 0;
    const outer = R * (major ? 0.82 + 0.1 * rand(i + 1) : 0.42 + 0.42 * rand(i + 101));
    const [cx, cy] = [Math.cos(a) * outer, Math.sin(a) * outer];
    g.append(
      svgEl("line", { x1: cx.toFixed(1), y1: cy.toFixed(1), x2: (Math.cos(a) * inner).toFixed(1), y2: (Math.sin(a) * inner).toFixed(1), "stroke-width": major ? 3 : 1.3 }),
      svgEl("circle", { cx: cx.toFixed(1), cy: cy.toFixed(1), r: major ? 4.5 : 2.4 }),
    );
  }
  g.append(svgEl("circle", { r: 12, class: "core" }));
});

// Desktop with a mouse gets the full-screen zoom stage (index.html adds the "js"
// class for it); phones and tablets get a simple, natively scrolling page.
const STAGE_QUERY = "(min-width: 980px) and (hover: hover) and (pointer: fine)";
const STAGE = root.classList.contains("js");
matchMedia(STAGE_QUERY).addEventListener("change", () => location.reload()); // e.g. window resized across the line

// Shared: a refresh always returns to the top (and drops the #section from the address)
history.scrollRestoration = "manual";
const isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
if (isReload && location.hash) history.replaceState(null, "", location.pathname + location.search);

if (STAGE) {
  // ─── Zoom stage ───────────────────────────────────────────────────────────────
  // Every scene sits on a fixed stage and carries an image "plate". Moving
  // forward, the plate opens out like a window to fill the screen while zooming
  // towards you, then dissolves into the next scene settling into place; moving
  // back plays it in reverse. Touch scrolling scrubs the transition directly via
  // an invisible snap track; wheel, keys and links run it as a timed animation.
  const scenes = [...document.querySelectorAll(".scene")].map((el, i) => {
    const plate = el.querySelector(".plate");
    const portal = document.createElement("div");
    const media = document.createElement("div");
    portal.className = "portal";
    portal.setAttribute("aria-hidden", "true");
    media.className = "portal__media";
    media.append(...plate.childNodes);
    portal.append(media);
    el.append(portal);
    el.style.setProperty("--z", String(100 - i)); // a scene zooming past sits in front of the next
    el.querySelectorAll(".reveal").forEach((r, j) => r.style.setProperty("--i", j));
    return {
      el,
      plate,
      portal,
      media,
      inner: el.querySelector(".scene__inner"),
      reveals: el.querySelectorAll(".reveal"),
      video: media.querySelector("video"),
      cover: plate.hasAttribute("data-cover"),
      rect: null,
      zoom: 1,
    };
  });
  const N = scenes.length;
  // true: zoom through each scene's image into the next; false: a plain fade between scenes
  const ZOOM_TRANSITIONS = false;
  const plainFade = () => !ZOOM_TRANSITIONS || reducedMotion.matches;
  const track = document.getElementById("track");
  track.replaceChildren(...scenes.map(() => document.createElement("div")));

  let W = innerWidth;
  let H = innerHeight;
  let step = innerHeight;
  let active = -1;
  let anim = null;
  let shown = new Set();

  // Measure every scene at rest: shrink its copy if it can't fit the screen,
  // then record where its plate sits so the portal can grow out of it.
  const layout = () => {
    W = innerWidth;
    H = innerHeight;
    step = track.firstElementChild.offsetHeight || H || 1;
    for (const s of scenes) {
      s.el.style.transform = "";
      s.inner.style.setProperty("--lift", "0px");
      const cs = getComputedStyle(s.el);
      const avail = s.el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (avail <= 0) continue;
      s.el.classList.add("is-measuring");
      const natural = s.inner.offsetHeight;
      s.el.classList.remove("is-measuring");
      const fit = !natural ? 1 : clamp(avail / natural, 0.7, 1);
      s.inner.style.setProperty("--fit", fit.toFixed(4));
      s.inner.style.setProperty("--inner-h", `${(avail / fit).toFixed(1)}px`);
      const r = s.plate.getBoundingClientRect();
      s.rect = { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      // how far the image zooms once the window is fully open
      const coverZoom = Math.max(W / r.width, H / r.height);
      const cover = s.cover && s.video && getComputedStyle(s.video).display !== "none";
      s.zoom = cover ? coverZoom * 1.02 : clamp(Math.min(W / r.width, H / r.height) * 1.3, 1.35, Math.max(1.35, coverZoom));
      s.radius = parseFloat(getComputedStyle(s.plate).borderTopLeftRadius) || 0;
      Object.assign(s.media.style, { width: `${r.width}px`, height: `${r.height}px`, transform: `translate(${r.left}px, ${r.top}px)` });
    }
  };

  // Window-open amount k (0 = plate at rest, 1 = full screen)
  const setPortal = (s, k, fade) => {
    const r = s.rect;
    if (!r) return;
    const t = r.y * (1 - k);
    const l = r.x * (1 - k);
    const b = (H - r.y - r.h) * (1 - k);
    const rt = (W - r.x - r.w) * (1 - k);
    s.portal.style.clipPath = `inset(${t.toFixed(1)}px ${rt.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${(s.radius * (1 - k)).toFixed(1)}px)`;
    const z = lerp(1, s.zoom, k) * (1 + 0.12 * fade);
    const x = r.x + (W / 2 - r.cx) * k;
    const y = r.y + (H / 2 - r.cy) * k;
    s.media.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${z.toFixed(4)})`;
  };

  const atRest = (s) => {
    s.el.style.opacity = "";
    s.el.style.transform = "";
    s.inner.style.opacity = "";
    s.inner.style.setProperty("--lift", "0px");
    setPortal(s, 0, 0);
  };

  const render = () => {
    // Which pair of scenes is in transition, and how far (x: 0 → 1 means
    // zooming from scene a into scene b; going backwards runs x from 1 → 0)
    let a, b, x;
    if (anim) {
      a = Math.min(anim.from, anim.to);
      b = Math.max(anim.from, anim.to);
      x = anim.to > anim.from ? anim.e : 1 - anim.e;
    } else {
      const p = scrub.on ? scrub.cur : clamp(scrollY / step || 0, 0, N - 1);
      a = Math.floor(p);
      x = p - a;
      b = a + 1 < N ? a + 1 : -1;
      if (b < 0) x = 0;
    }
    const now = new Set([a]);
    if (b >= 0 && x > 0) now.add(b);
    for (const i of shown) {
      if (now.has(i)) continue;
      scenes[i].el.classList.remove("is-visible");
      scenes[i].el.style.zIndex = "";
      scenes[i].el.style.clipPath = "";
      scenes[i].reveals.forEach((r) => r.classList.remove("is-in")); // replay on return
    }
    shown = now;

    const A = scenes[a];
    A.el.classList.add("is-visible");
    A.el.style.clipPath = "";
    A.el.style.zIndex = "";
    if (plainFade()) {
      atRest(A);
      A.el.style.opacity = (1 - clamp(x / 0.5)).toFixed(3); // out in the first half...
    } else {
      const c = clamp(x / 0.3);
      A.el.style.opacity = "";
      A.el.style.transform = "";
      A.inner.style.opacity = (1 - c).toFixed(3);
      A.inner.style.setProperty("--lift", `${(-28 * c * c).toFixed(1)}px`);
      setPortal(A, easeInOut(clamp(x / 0.7)), clamp((x - 0.6) / 0.4));
    }

    if (b >= 0 && x > 0) {
      const B = scenes[b];
      B.el.classList.add("is-visible");
      atRest(B);
      if (plainFade()) {
        B.el.style.opacity = clamp((x - 0.5) / 0.5).toFixed(3); // ...next one in during the second
        B.el.style.clipPath = "";
      } else {
        // ...then the next scene grows out of its own image frame: you zoom into
        // one picture and back out of the next
        const v = easeInOut(clamp((x - 0.6) / 0.4));
        const r = B.rect;
        B.el.style.zIndex = "200";
        B.el.style.opacity = x > 0.6 ? "1" : "0";
        B.el.style.transform = `scale(${(1 + 0.1 * (1 - v)).toFixed(4)})`;
        B.el.style.clipPath =
          v >= 1 || !r
            ? ""
            : `inset(${(r.y * (1 - v)).toFixed(1)}px ${((W - r.x - r.w) * (1 - v)).toFixed(1)}px ${((H - r.y - r.h) * (1 - v)).toFixed(1)}px ${(r.x * (1 - v)).toFixed(1)}px round ${(B.radius * (1 - v)).toFixed(1)}px)`;
        B.inner.style.opacity = clamp((v - 0.35) / 0.65).toFixed(3);
      }
    }

    const progress = (a + x) / (N - 1);
    nav.style.setProperty("--progress", progress.toFixed(4));
    nav.classList.toggle("is-scrolled", progress > 0.001);
    root.classList.toggle("at-start", a === 0 && x < 0.15);
    setActive(x < 0.5 || b < 0 ? a : b);
  };

  // ─── Active section: nav highlight, counter, reveals ─────────────────────────
  const navItems = [...nav.querySelectorAll("[data-nav]")];
  const ink = nav.querySelector(".nav__ink");
  const countEl = document.getElementById("progressCount");
  const [prevBtn, nextBtn] = document.querySelectorAll(".progress__btn");
  const placeInk = () => {
    const link = nav.querySelector(".nav__links a.is-active");
    ink.style.opacity = link ? "1" : "0";
    if (!link) return;
    ink.style.width = `${link.offsetWidth}px`;
    ink.style.transform = `translateX(${link.offsetLeft}px)`;
  };
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    const s = scenes[i];
    scenes.forEach((o, j) => (o.el.inert = j !== i));
    s.reveals.forEach((r) => r.classList.add("is-in"));
    const key = s.el.dataset.nav;
    for (const a of navItems) {
      const on = a.dataset.nav === key;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    placeInk();
    countEl.textContent = `${pad(i + 1)} / ${pad(N)}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === N - 1;
    for (const o of scenes) {
      if (!o.video) continue;
      if (o === s && matchMedia("(min-width: 980px)").matches && !reducedMotion.matches) {
        o.video.preload = "auto";
        o.video.play().catch(() => {});
      } else o.video.pause();
    }
  };

  // ─── Driving the transition ──────────────────────────────────────────────────
  let queued = false;
  const queueRender = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  };
  addEventListener("scroll", () => !anim && !scrub.on && queueRender(), { passive: true });

  // Wheel, keys, buttons and links: one smooth zoom straight to the target,
  // however far away it is (a jump from the hero to pricing is a single zoom)
  const go = (to) => {
    to = clamp(Math.round(to), 0, N - 1);
    scrub.on = false; // a key, button or link takes over from a wheel scrub
    const from = anim ? anim.to : active;
    if (anim || to === from) return;
    const dur = reducedMotion.matches ? 380 : ZOOM_TRANSITIONS ? 1250 : 700;
    anim = { from, to, e: 0, start: performance.now() };
    root.classList.add("is-animating");
    const tick = (t) => {
      const k = clamp((t - anim.start) / dur);
      anim.e = reducedMotion.matches ? k : k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      render();
      if (k < 1) return requestAnimationFrame(tick);
      anim = null;
      scrollTo({ top: to * step, behavior: "instant" });
      root.classList.remove("is-animating");
      render();
    };
    requestAnimationFrame(tick);
  };
  const indexOf = (id) => (id ? scenes.findIndex((s) => s.el.id === id) : -1);

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const i = indexOf(id);
    if (i < 0) return;
    e.preventDefault();
    go(i);
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
  });
  addEventListener("popstate", () => {
    const i = indexOf(location.hash.slice(1));
    go(i < 0 ? 0 : i);
  });
  prevBtn.addEventListener("click", () => go(active - 1));
  nextBtn.addEventListener("click", () => go(active + 1));

  // Mouse wheel / trackpad scrub the zoom directly: rolling down moves into the
  // image as far as you roll, rolling up comes back out. When the wheel stops,
  // it eases to the nearest scene, leaning the way you were rolling.
  const WHEEL_PER_SCENE = 640; // px of wheel travel for one full transition (~6 notches)
  const scrub = { on: false, cur: 0, target: 0, dir: 1, last: 0, settling: false };
  const scrubTick = () => {
    if (!scrub.on) return;
    if (!scrub.settling && performance.now() - scrub.last > 160) {
      const base = Math.floor(scrub.target);
      const f = scrub.target - base;
      scrub.target = clamp(f < 1e-4 ? base : scrub.dir > 0 ? (f > 0.1 ? base + 1 : base) : f < 0.9 ? base : base + 1, 0, N - 1);
      scrub.settling = true;
    }
    scrub.cur += (scrub.target - scrub.cur) * (scrub.settling ? 0.1 : 0.16);
    if (scrub.settling && Math.abs(scrub.target - scrub.cur) < 0.001) {
      scrub.on = false;
      scrub.settling = false;
      scrollTo({ top: scrub.target * step, behavior: "instant" });
      root.classList.remove("is-animating");
      render();
      return;
    }
    render();
    requestAnimationFrame(scrubTick);
  };
  addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return; // pinch-zoom
      e.preventDefault();
      if (anim) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * H : e.deltaY;
      if (!dy) return;
      if (!scrub.on) {
        scrub.on = true;
        scrub.cur = scrub.target = clamp(scrollY / step || 0, 0, N - 1);
        root.classList.add("is-animating");
        requestAnimationFrame(scrubTick);
      }
      scrub.settling = false;
      scrub.dir = Math.sign(dy);
      scrub.last = performance.now();
      scrub.target = clamp(scrub.target + dy / WHEEL_PER_SCENE, 0, N - 1);
    },
    { passive: false },
  );
  const KEYS = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
  addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, button, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      go(e.key === "Home" ? 0 : N - 1);
    } else if (KEYS[e.key]) {
      e.preventDefault();
      go(active + (e.shiftKey && e.key === " " ? -1 : KEYS[e.key]));
    }
  });

  let resizeQueued = false;
  const relayout = () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      layout();
      render();
      placeInk();
    });
  };
  // Opening scene: a refresh always returns to the hero (and drops the #section
  // from the address); a fresh visit to e.g. /#pricing still opens on that section.
  const start = Math.max(0, indexOf(location.hash.slice(1)));
  addEventListener("resize", relayout);
  addEventListener("load", () => {
    if (!anim && !scrub.on) scrollTo({ top: start * step, behavior: "instant" });
    relayout();
  });
  document.fonts?.ready.then(relayout);
  layout();
  scrollTo({ top: start * step, behavior: "instant" });
  render();
} else {
  // ─── Simple scrolling page (phones / tablets) ─────────────────────────────────
  // Sections stack normally; the header stays pinned and its highlight follows the
  // section in view. Anchor links scroll natively (CSS smooth-scroll + offset).
  const links = [...nav.querySelectorAll(".nav__links [data-nav]")];
  const ink = nav.querySelector(".nav__ink");
  const placeInk = () => {
    const link = nav.querySelector(".nav__links a.is-active");
    ink.style.opacity = link ? "1" : "0";
    if (!link) return;
    ink.style.width = `${link.offsetWidth}px`;
    ink.style.transform = `translateX(${link.offsetLeft}px)`;
  };
  const setSection = (key) => {
    for (const a of links) {
      const on = a.dataset.nav === key;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    placeInk();
  };
  const watcher = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) setSection(e.target.dataset.nav || "");
    },
    { rootMargin: "-40% 0px -55% 0px" }, // the section crossing the upper-middle of the screen
  );
  document.querySelectorAll(".scene").forEach((s) => watcher.observe(s));
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", placeInk);
  document.fonts?.ready.then(placeInk);
  if (isReload) scrollTo({ top: 0, behavior: "instant" });
  onScroll();
}

// ─── LinkedIn Insight Tag — only after consent (UK PECR) ─────────────────────
const CONSENT_KEY = "smartppc-consent";
const readConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
};
const loadInsightTag = () => {
  window._linkedin_partner_id = CONFIG.linkedinPartnerId;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(CONFIG.linkedinPartnerId);
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
  document.head.appendChild(s);
};
if (CONFIG.linkedinPartnerId) {
  const consent = readConsent();
  if (consent === "yes") loadInsightTag();
  else if (consent !== "no") {
    const banner = document.getElementById("consent");
    banner.hidden = false;
    banner.addEventListener("click", (e) => {
      const choice = e.target.closest("[data-consent]")?.dataset.consent;
      if (!choice) return;
      try {
        localStorage.setItem(CONSENT_KEY, choice);
      } catch {
        // storage blocked — choice applies to this visit only
      }
      banner.hidden = true;
      if (choice === "yes") loadInsightTag();
    });
  }
}
