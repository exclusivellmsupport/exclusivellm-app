/* Exclusive LLM — site interactions */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- language: each page is TR or EN (separate URLs) ---------- */
  const setLang = (l) => { document.body.dataset.lang = l; restartRotator(); };
  const initial = document.body.dataset.lang || "tr";
  $$(".lang a").forEach((a) => a.addEventListener("click", () => { try { localStorage.setItem("lang", a.getAttribute("hreflang")); } catch (e) {} }));

  /* ---------- rotating headline word ---------- */
  let rotTimer = null;
  function restartRotator() {
    clearInterval(rotTimer);
    const lang = document.body.dataset.lang;
    const rot = $(`.rotator.${lang}`);
    if (!rot) return;
    const words = $$("span", rot);
    let i = 0;
    words.forEach((w, k) => { w.classList.toggle("on", k === 0); w.classList.remove("out"); });
    if (reduce) return;
    rotTimer = setInterval(() => {
      const cur = words[i];
      cur.classList.remove("on"); cur.classList.add("out");
      setTimeout(() => cur.classList.remove("out"), 650);
      i = (i + 1) % words.length;
      words[i].classList.add("on");
    }, 2600);
  }
  setLang(initial);

  /* ---------- header + year ---------- */
  const header = $("header.top");
  const onScroll = () => header.classList.toggle("scrolled", scrollY > 20);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- cursor spotlight + card glow ---------- */
  const spot = $(".spot");
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    spot.style.left = e.clientX + "px"; spot.style.top = e.clientY + "px";
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  addEventListener("pointerleave", () => { pointer.active = false; });
  $$(".card").forEach((c) => c.addEventListener("pointermove", (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", e.clientX - r.left + "px");
    c.style.setProperty("--my", e.clientY - r.top + "px");
  }));

  /* ---------- 3D tilt (apps + phone) ---------- */
  if (!reduce && matchMedia("(hover: hover)").matches) {
    $$(".app").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1400px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
    const stage = $(".stage"), phone = $(".phone");
    if (stage && phone) stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      phone.style.transform = `rotateY(${-14 + x * 22}deg) rotateX(${6 - y * 16}deg)`;
    });
    if (stage && phone) stage.addEventListener("pointerleave", () => { phone.style.transform = ""; });
  }

  /* ---------- reveal on scroll + counters + meter ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add("in");
      if (el.classList.contains("meter")) el.classList.add("on");
      $$("[data-count]", el).forEach(countUp);
      io.unobserve(el);
    });
  }, { threshold: 0.18 });
  $$(".rv, .meter").forEach((el) => io.observe(el));
  function countUp(el) {
    const end = +el.dataset.count, pct = "pct" in el.dataset, tr = document.body.dataset.lang === "tr";
    const pre = pct && tr ? "%" : "", suf = pct && !tr ? "%" : "";
    if (reduce) { el.textContent = pre + end + suf; return; }
    const t0 = performance.now(), dur = 1600;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = pre + v + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- measurement: Play / social clicks (works with whichever analytics is installed) ---------- */
  const track = (name, params) => {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params);
      if (window.goatcounter && window.goatcounter.count)
        window.goatcounter.count({ path: name + "/" + Object.values(params).join("/"), title: name, event: true });
    } catch (e) {}
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const lang = document.body.dataset.lang || "tr";
    if (a.dataset.play) track("play_click", { app: a.dataset.play, page: a.dataset.page || "", lang });
    else if (/instagram\.com|tiktok\.com|youtube\.com|x\.com/.test(a.hostname)) track("social_click", { network: a.hostname.replace(/^www\./, ""), lang });
  });

  /* ---------- YouTube: load the player only on click ---------- */
  $$(".yt").forEach((el) => el.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + el.dataset.id + "?autoplay=1&rel=0";
    f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullScreen = true; f.title = el.dataset.title || "Video";
    el.replaceChildren(f);
  }, { once: true }));

  /* ---------- neural network background ---------- */
  const pointer = { x: -1e4, y: -1e4, active: false };
  const cv = $("#neural"), ctx = cv.getContext("2d");
  let W, H, DPR, nodes = [], pulses = [];
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
    const n = Math.round(Math.min(110, (innerWidth * innerHeight) / 14000));
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25 * DPR, vy: (Math.random() - 0.5) * 0.25 * DPR,
      r: (Math.random() * 1.6 + 0.8) * DPR, hue: Math.random() < 0.18 ? 265 : 205 + Math.random() * 25,
    }));
  }
  resize(); addEventListener("resize", resize);
  const LINK = 140;
  function tick() {
    ctx.clearRect(0, 0, W, H);
    const link = LINK * DPR, px = pointer.x * DPR, py = pointer.y * DPR;
    for (const p of nodes) {
      if (!reduce) { p.x += p.vx; p.y += p.vy; }
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      if (pointer.active) {
        const dx = px - p.x, dy = py - p.y, d = Math.hypot(dx, dy);
        if (d < 180 * DPR) { p.x += dx * 0.004; p.y += dy * 0.004; }
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) {
          ctx.strokeStyle = `hsla(${a.hue},90%,65%,${(1 - d / link) * 0.28})`;
          ctx.lineWidth = DPR * 0.8;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (!reduce && Math.random() < 0.0006 && pulses.length < 24) pulses.push({ a, b, t: 0 });
        }
      }
      if (pointer.active) {
        const d = Math.hypot(a.x - px, a.y - py);
        if (d < 200 * DPR) {
          ctx.strokeStyle = `rgba(56,214,255,${(1 - d / (200 * DPR)) * 0.5})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(px, py); ctx.stroke();
        }
      }
    }
    for (const p of nodes) {
      ctx.fillStyle = `hsla(${p.hue},95%,72%,.9)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    pulses = pulses.filter((s) => {
      s.t += 0.02;
      const x = s.a.x + (s.b.x - s.a.x) * s.t, y = s.a.y + (s.b.y - s.a.y) * s.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7 * DPR);
      g.addColorStop(0, "rgba(160,235,255,.95)"); g.addColorStop(1, "rgba(56,214,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7 * DPR, 0, 7); ctx.fill();
      return s.t < 1;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- hero phone: rotating app scenes (≈10 s each) ----------
     Stylised, original mini-scenes inspired by our apps (not screenshots). */
  const screen = $(".phone .screen");
  if (!screen) return;
  const EN = document.body.dataset.lang === "en";
  const tx = (tr, en) => (EN ? en : tr);
  const pr = () => Math.min(devicePixelRatio || 1, 2);
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const eo = (p) => 1 - Math.pow(1 - p, 3);
  const rnd = (n) => (Math.random() * n) | 0;
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Array.isArray(r) ? r : Math.max(0, r)); };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function fit(c) {
    const d = pr(), w = Math.round(c.clientWidth * d), h = Math.round(c.clientHeight * d);
    if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
    return d;
  }
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "K" : Math.round(n).toLocaleString(EN ? "en" : "tr"));

  /* ===== block puzzle engine (gem + wood skins) ===== */
  const SHAPES = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  ];
  const GEM = {
    colors: [["#4f8dff", "#2f5fe0"], ["#38d6ff", "#1aa3d1"], ["#8b5cf6", "#6d3fe0"], ["#f472b6", "#d9468f"], ["#fbbf24", "#e0950b"], ["#34d399", "#13a874"]],
    flash: "255,255,255",
    empty(c, x, y, s) { c.fillStyle = "rgba(255,255,255,.06)"; rr(c, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.2); c.fill(); },
    tile(c, x, y, s, col, alpha = 1, scale = 1) {
      const [a, b] = this.colors[col];
      const pad = s * 0.06, w = (s - pad * 2) * scale, ox = x + (s - w) / 2, oy = y + (s - w) / 2, r = w * 0.22;
      c.globalAlpha = alpha;
      const g = c.createLinearGradient(ox, oy, ox + w, oy + w);
      g.addColorStop(0, a); g.addColorStop(1, b);
      c.fillStyle = g; rr(c, ox, oy, w, w, r); c.fill();
      c.fillStyle = "rgba(255,255,255,.28)"; rr(c, ox + w * 0.12, oy + w * 0.1, w * 0.76, w * 0.22, r * 0.6); c.fill();
      c.globalAlpha = 1;
    },
  };
  const woodSkin = (colors, hole) => ({
    colors, flash: "255,226,170",
    empty(c, x, y, s) {
      c.fillStyle = hole; rr(c, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.12); c.fill();
      c.fillStyle = "rgba(0,0,0,.22)"; rr(c, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.16, s * 0.1); c.fill();
    },
    tile(c, x, y, s, col, alpha = 1, scale = 1) {
      const [hi, lo, edge] = this.colors[col];
      const pad = s * 0.05, w = (s - pad * 2) * scale, ox = x + (s - w) / 2, oy = y + (s - w) / 2, r = w * 0.14, fh = w * 0.88;
      c.globalAlpha = alpha;
      c.fillStyle = edge; rr(c, ox, oy, w, w, r); c.fill();
      const g = c.createLinearGradient(ox, oy, ox, oy + fh);
      g.addColorStop(0, hi); g.addColorStop(1, lo);
      c.fillStyle = g; rr(c, ox, oy, w, fh, r); c.fill();
      c.save(); rr(c, ox, oy, w, fh, r); c.clip();
      c.strokeStyle = "rgba(110,55,15,.22)"; c.lineWidth = Math.max(1, w * 0.035);
      const ph = (((x * 13 + y * 7) | 0) % 17) / 17 * 6.28;
      for (let k = 1; k <= 3; k++) {
        const yy = oy + (fh * k) / 4;
        c.beginPath(); c.moveTo(ox, yy);
        c.bezierCurveTo(ox + w * 0.33, yy + Math.sin(ph + k) * w * 0.07, ox + w * 0.66, yy - Math.cos(ph + k) * w * 0.07, ox + w, yy);
        c.stroke();
      }
      c.restore();
      c.fillStyle = "rgba(255,244,214,.38)"; rr(c, ox + w * 0.1, oy + w * 0.07, w * 0.8, w * 0.09, w * 0.05); c.fill();
      c.globalAlpha = 1;
    },
  });
  const BN_WOOD = woodSkin([["#f6bd6a", "#d98a3a", "#94561f"], ["#eba650", "#c47a2c", "#844a19"], ["#de8648", "#b55a28", "#773614"], ["#f7d08a", "#e0a050", "#a26b2b"]], "rgba(28,14,6,.55)");
  const WD_WOOD = woodSkin([["#ecd09c", "#c99a5a", "#86602f"], ["#dcb07a", "#b07d45", "#714c27"], ["#cf9a66", "#a06a3a", "#653f20"], ["#f2dfb6", "#d6b27a", "#94713e"]], "rgba(20,12,6,.6)");

  function blockGame(root, skin, N) {
    const board = $(".board", root), bc = board.getContext("2d");
    const trays = $$(".tray canvas", root), scEl = $(".sc", root), bsEl = $(".bs", root), combo = $(".combo", root);
    let grid, tray, score = 0, best = 0, anims = [], clearing = null, acc = 0;
    const piece = () => ({ cells: SHAPES[rnd(SHAPES.length)], col: rnd(skin.colors.length) });
    const fits = (cells, x, y) => cells.every(([dx, dy]) => { const cx = x + dx, cy = y + dy; return cx < N && cy < N && grid[cy][cx] < 0; });
    function bestSpot(p) {
      let b = null;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!fits(p.cells, x, y)) continue;
        p.cells.forEach(([dx, dy]) => (grid[y + dy][x + dx] = 9));
        let lines = 0, near = 0;
        for (let i = 0; i < N; i++) { if (grid[i].every((v) => v >= 0)) lines++; if (grid.every((r) => r[i] >= 0)) lines++; }
        p.cells.forEach(([dx, dy]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ax, ay]) => {
          const nx = x + dx + ax, ny = y + dy + ay;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || grid[ny][nx] >= 0) near++;
        }));
        p.cells.forEach(([dx, dy]) => (grid[y + dy][x + dx] = -1));
        const s = lines * 100 + near + Math.random() * 2;
        if (!b || s > b.s) b = { x, y, s };
      }
      return b;
    }
    function fullLines() {
      const rows = [], cols = [];
      for (let i = 0; i < N; i++) { if (grid[i].every((v) => v >= 0)) rows.push(i); if (grid.every((r) => r[i] >= 0)) cols.push(i); }
      const cells = new Set();
      rows.forEach((r) => { for (let x = 0; x < N; x++) cells.add(r * N + x); });
      cols.forEach((c) => { for (let y = 0; y < N; y++) cells.add(y * N + c); });
      return { n: rows.length + cols.length, cells: [...cells] };
    }
    function reset(prefill) {
      grid = Array.from({ length: N }, () => Array(N).fill(-1));
      tray = [piece(), piece(), piece()];
      score = 0;
      if (prefill) for (let k = 0; k < N - 1; k++) {
        const p = piece(), s = bestSpot(p);
        if (s) { p.cells.forEach(([dx, dy]) => (grid[s.y + dy][s.x + dx] = p.col)); score += p.cells.length; }
        fullLines().cells.forEach((k2) => (grid[(k2 / N) | 0][k2 % N] = -1));
      }
    }
    function step() {
      if (clearing) return;
      const p = tray.shift(); tray.push(piece()); drawTray();
      const spot = bestSpot(p);
      if (!spot) { wipe(); return; }
      const t = performance.now();
      p.cells.forEach(([dx, dy], k) => { grid[spot.y + dy][spot.x + dx] = p.col; anims.push({ x: spot.x + dx, y: spot.y + dy, t0: t + k * 35 }); });
      score += p.cells.length; hud();
      setTimeout(checkLines, 320);
    }
    function checkLines() {
      const { n, cells } = fullLines();
      if (!n) return;
      clearing = { cells, t0: performance.now() };
      score += n * 10 * n; hud();
      combo.textContent = n > 1 ? `COMBO ×${n}` : "+" + n * 10;
      combo.classList.remove("show"); void combo.offsetWidth; combo.classList.add("show");
      setTimeout(() => { clearing.cells.forEach((k) => (grid[(k / N) | 0][k % N] = -1)); clearing = null; }, 520);
    }
    function wipe() {
      clearing = { cells: [...Array(N * N).keys()].filter((k) => grid[(k / N) | 0][k % N] >= 0), t0: performance.now() };
      setTimeout(() => { reset(false); drawTray(); hud(); clearing = null; }, 600);
    }
    function hud() { best = Math.max(best, score); scEl.textContent = score; bsEl.textContent = best; }
    function drawTray() {
      trays.forEach((c, i) => {
        const d = pr(); c.width = c.height = 70 * d;
        const t = c.getContext("2d"), p = tray[i]; t.clearRect(0, 0, c.width, c.height);
        const w = Math.max(...p.cells.map((q) => q[0])) + 1, h = Math.max(...p.cells.map((q) => q[1])) + 1;
        const s = Math.min(c.width / 4, c.width / Math.max(w, h));
        const ox = (c.width - w * s) / 2, oy = (c.height - h * s) / 2;
        p.cells.forEach(([dx, dy]) => skin.tile(t, ox + dx * s, oy + dy * s, s, p.col, i === 0 ? 1 : 0.65));
      });
    }
    function draw(now) {
      const d = pr(), cssW = board.clientWidth;
      if (!cssW) return;
      if (board.width !== Math.round(cssW * d)) board.width = board.height = Math.round(cssW * d);
      const size = board.width / N;
      bc.clearRect(0, 0, board.width, board.width);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) skin.empty(bc, x * size, y * size, size);
      const clearSet = clearing ? new Set(clearing.cells) : null;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = grid[y][x]; if (v < 0) continue;
        let scale = 1, alpha = 1;
        const an = anims.find((a) => a.x === x && a.y === y);
        if (an) { const p = clamp((now - an.t0) / 260); scale = 0.4 + 0.6 * (1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)); alpha = p; }
        if (clearSet && clearSet.has(y * N + x)) {
          const p = Math.min(1, (now - clearing.t0) / 500);
          scale = 1 + p * 0.35; alpha = 1 - p;
          bc.fillStyle = `rgba(${skin.flash},${0.6 * (1 - p)})`; rr(bc, x * size, y * size, size, size, size * 0.2); bc.fill();
        }
        skin.tile(bc, x * size, y * size, size, v, alpha, scale);
      }
      anims = anims.filter((a) => now - a.t0 < 300);
    }
    reset(true);
    return {
      enter() { drawTray(); hud(); },
      update(dt) { acc += dt; if (acc >= 900) { acc = 0; step(); } },
      draw,
    };
  }

  /* ===== Neon Eco-Grid: merge generators, power a neon city ===== */
  function neonGame(root) {
    const cv = $("canvas", root), c = cv.getContext("2d"), eEl = $(".nv-e", root), rEl = $(".nv-r", root);
    const C = 4, R = 4, COL = ["#38d6ff", "#34d399", "#f472b6", "#a78bfa", "#fbbf24", "#ffffff"];
    let items = [], energy = 18400, acc = 0, sAcc = 0, mv = null, fx = [], sparks = [], hAcc = 0;
    const city = []; for (let x = 0; x < 1.02;) { const w = 0.07 + Math.random() * 0.07; city.push({ x, w, h: 0.3 + Math.random() * 0.65, hue: city.length % 3 }); x += w + 0.012; }
    const occ = (cc, r) => items.some((it) => it.c === cc && it.r === r);
    function spawn(lv, now) {
      const free = []; for (let r = 0; r < R; r++) for (let cc = 0; cc < C; cc++) if (!occ(cc, r)) free.push([cc, r]);
      if (!free.length) return false;
      const [cc, r] = free[rnd(free.length)]; items.push({ lv, c: cc, r, born: now }); return true;
    }
    for (let k = 0; k < 9; k++) spawn(1 + rnd(3), -1e4);
    const rate = () => items.reduce((s, it) => s + Math.pow(3, it.lv - 1) * 6, 0);
    let L = null; // layout
    const cellXY = (cc, r) => [L.pad + cc * (L.cs + L.gap), L.top + r * (L.cs + L.gap)];
    function act(now) {
      for (let lv = 1; lv < 6; lv++) {
        const same = items.filter((it) => it.lv === lv);
        if (same.length >= 2) { mv = { a: same[0], b: same[1], t0: now }; return; }
      }
      if (!spawn(1, now)) items = items.filter((it) => it.lv < 4);
    }
    function burst(it, now, big) {
      if (!L) return;
      const [x, y] = cellXY(it.c, it.r), cx = x + L.cs / 2, cy = y + L.cs / 2, col = COL[Math.min(5, it.lv - 1)];
      fx.push({ x: cx, y: cy, t0: now, col, big, ps: Array.from({ length: big ? 18 : 10 }, () => ({ a: Math.random() * 6.28, v: 0.4 + Math.random() * 0.8 })) });
    }
    function update(dt, now) {
      energy += (rate() * dt) / 1000;
      acc += dt; sAcc += dt; hAcc += dt;
      if (!mv && acc > 850) { acc = 0; act(now); }
      if (sAcc > 1500) { sAcc = 0; spawn(1, now); }
      if (mv && now - mv.t0 > 430) {
        items = items.filter((it) => it !== mv.a); mv.b.lv++; mv.b.born = now; burst(mv.b, now, false);
        if (mv.b.lv >= 6) mv.b.launch = now + 1100;
        mv = null;
      }
      items = items.filter((it) => { if (it.launch && now > it.launch) { burst(it, now, true); energy += 2500; return false; } return true; });
      if (L && Math.random() < dt / 160 && items.length) {
        const it = items[rnd(items.length)], [x, y] = cellXY(it.c, it.r);
        sparks.push({ x: x + L.cs / 2, y: y + L.cs / 2, t0: now, col: COL[Math.min(5, it.lv - 1)], dx: (Math.random() - 0.5) * 40 });
      }
      if (hAcc > 120) { hAcc = 0; eEl.textContent = fmt(energy); rEl.textContent = "+" + fmt(rate()); }
    }
    function glyph(lv, s, now, d) {
      const col = COL[Math.min(5, lv - 1)], h = s * 0.42, u = h * 0.62, t = now / 1000;
      c.shadowColor = col; c.shadowBlur = 14 * d;
      c.strokeStyle = col; c.lineWidth = 1.6 * d; rr(c, -h, -h, h * 2, h * 2, h * 0.32); c.stroke();
      c.shadowBlur = 0;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, h * 1.4); g.addColorStop(0, rgba(col, 0.3)); g.addColorStop(1, rgba(col, 0.03));
      c.fillStyle = g; c.fill();
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2 * d; c.lineCap = "round"; c.lineJoin = "round"; c.shadowBlur = 10 * d;
      c.beginPath();
      if (lv === 1) {
        c.moveTo(u * 0.2, -u); c.lineTo(-u * 0.45, u * 0.12); c.lineTo(u * 0.02, u * 0.12); c.lineTo(-u * 0.2, u); c.lineTo(u * 0.45, -u * 0.12); c.lineTo(-u * 0.02, -u * 0.12); c.closePath(); c.fill();
      } else if (lv === 2) {
        c.save(); c.transform(1, 0, -0.3, 1, 0, 0);
        c.strokeRect(-u * 0.8, -u * 0.6, u * 1.6, u * 1.05);
        c.moveTo(-u * 0.27, -u * 0.6); c.lineTo(-u * 0.27, u * 0.45); c.moveTo(u * 0.27, -u * 0.6); c.lineTo(u * 0.27, u * 0.45);
        c.moveTo(-u * 0.8, -u * 0.08); c.lineTo(u * 0.8, -u * 0.08); c.stroke(); c.restore();
        c.beginPath(); c.moveTo(0, u * 0.45); c.lineTo(0, u * 0.95); c.stroke();
      } else if (lv === 3) {
        c.moveTo(0, -u * 0.25); c.lineTo(0, u); c.stroke();
        for (let k = 0; k < 3; k++) {
          const a = t * 3.2 + k * 2.094;
          c.beginPath(); c.moveTo(0, -u * 0.25); c.lineTo(Math.cos(a) * u * 0.85, -u * 0.25 + Math.sin(a) * u * 0.85); c.stroke();
        }
        c.beginPath(); c.arc(0, -u * 0.25, u * 0.13, 0, 7); c.fill();
      } else if (lv === 4) {
        const rad = u * (0.82 + 0.06 * Math.sin(t * 4));
        for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.52; k ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        c.closePath(); c.stroke(); c.beginPath(); c.arc(0, 0, u * 0.32, 0, 7); c.fill();
      } else if (lv === 5) {
        c.arc(0, 0, u * 0.38, 0, 7); c.fill();
        c.beginPath(); c.ellipse(0, 0, u * 0.95, u * 0.34, t * 1.4, 0, 7); c.stroke();
        c.beginPath(); c.ellipse(0, 0, u * 0.95, u * 0.34, -t * 1.1 + 1, 0, 7); c.stroke();
      } else {
        for (let k = 0; k < 16; k++) { const a = t + (k * Math.PI) / 8, rad = k % 2 ? u * 0.4 : u; k ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        c.closePath(); c.fill();
      }
      c.shadowBlur = 0;
      for (let k = 0; k < lv; k++) { c.fillStyle = col; c.beginPath(); c.arc((k - (lv - 1) / 2) * 5 * d, h * 0.78, 1.4 * d, 0, 7); c.fill(); }
    }
    function draw(now) {
      const d = fit(cv), W = cv.width, H = cv.height;
      if (!W) return;
      c.clearRect(0, 0, W, H);
      const pad = 16 * d, gap = 8 * d, cs = (W - pad * 2 - gap * (C - 1)) / C;
      L = { pad, gap, cs, top: 6 * d };
      const gy = L.top + R * (cs + gap) + 4 * d, base = H - 26 * d;
      // power line from grid to city
      const lit = 0.35 + 0.25 * Math.sin(now / 1400) + 0.25 * Math.sin(now / 530);
      // city skyline
      const hgt = base - gy - 24 * d;
      city.forEach((b, i) => {
        const x = b.x * W, w = b.w * W, h = b.h * hgt, y = base - h, col = ["#f472b6", "#38d6ff", "#a78bfa"][b.hue];
        c.fillStyle = "#12082c"; c.fillRect(x, y, w, h);
        c.strokeStyle = col; c.lineWidth = 1.2 * d; c.shadowColor = col; c.shadowBlur = 10 * d;
        c.beginPath(); c.moveTo(x, base); c.lineTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, base); c.stroke(); c.shadowBlur = 0;
        const ww = 3 * d, wh = 4 * d;
        for (let fy = y + 6 * d, row = 0; fy < base - 6 * d; fy += 9 * d, row++) for (let fx2 = x + 4 * d, col2 = 0; fx2 < x + w - 5 * d; fx2 += 7 * d, col2++) {
          const hsh = ((i * 97 + row * 31 + col2 * 17) % 100) / 100;
          if (hsh < lit) { c.fillStyle = hsh < lit * 0.4 ? rgba(col, 0.95) : "rgba(255,236,170,.75)"; c.fillRect(fx2, fy, ww, wh); }
        }
      });
      // neon road
      c.strokeStyle = "#f472b6"; c.lineWidth = 2 * d; c.shadowColor = "#f472b6"; c.shadowBlur = 12 * d;
      c.beginPath(); c.moveTo(0, base + 2 * d); c.lineTo(W, base + 2 * d); c.stroke(); c.shadowBlur = 0;
      c.strokeStyle = "rgba(56,214,255,.9)"; c.setLineDash([10 * d, 14 * d]); c.lineDashOffset = -now / 20;
      c.beginPath(); c.moveTo(0, base + 12 * d); c.lineTo(W, base + 12 * d); c.stroke(); c.setLineDash([]);
      // slots
      for (let r = 0; r < R; r++) for (let cc = 0; cc < C; cc++) {
        const [x, y] = cellXY(cc, r);
        c.fillStyle = "rgba(255,255,255,.025)"; c.strokeStyle = "rgba(167,139,250,.2)"; c.lineWidth = 1 * d;
        rr(c, x, y, cs, cs, 10 * d); c.fill(); c.stroke();
      }
      // items
      for (const it of items) {
        let [x, y] = cellXY(it.c, it.r);
        if (mv && it === mv.a) { const [bx, by] = cellXY(mv.b.c, mv.b.r), p = eo(clamp((now - mv.t0) / 420)); x += (bx - x) * p; y += (by - y) * p; }
        const pb = clamp((now - it.born) / 320), sc = pb < 1 ? 0.3 + 0.7 * (1 + 2.4 * Math.pow(pb - 1, 3) + 1.4 * Math.pow(pb - 1, 2)) : 1;
        const pulse = it.launch ? 1 + 0.08 * Math.sin(now / 50) : 1;
        c.save(); c.translate(x + cs / 2, y + cs / 2); c.scale(sc * pulse, sc * pulse); glyph(it.lv, cs, now, d); c.restore();
      }
      // bursts
      fx = fx.filter((f) => {
        const p = (now - f.t0) / (f.big ? 700 : 480); if (p >= 1) return false;
        c.strokeStyle = rgba(f.col, 1 - p); c.lineWidth = 2 * d; c.beginPath(); c.arc(f.x, f.y, cs * (0.3 + p * (f.big ? 1.2 : 0.7)), 0, 7); c.stroke();
        c.fillStyle = rgba(f.col, 1 - p);
        f.ps.forEach((q) => { const rad = cs * (0.2 + eo(p) * q.v); c.beginPath(); c.arc(f.x + Math.cos(q.a) * rad, f.y + Math.sin(q.a) * rad, 1.8 * d, 0, 7); c.fill(); });
        return true;
      });
      // energy sparks rising to the counter
      sparks = sparks.filter((s) => {
        const p = (now - s.t0) / 900; if (p >= 1) return false;
        const x = s.x + s.dx * d * p, y = s.y - (s.y + 10 * d) * eo(p);
        c.fillStyle = rgba(s.col, 1 - p); c.shadowColor = s.col; c.shadowBlur = 8 * d;
        c.beginPath(); c.arc(x, y, 2 * d, 0, 7); c.fill(); c.shadowBlur = 0;
        return true;
      });
    }
    return { update, draw };
  }

  /* ===== Exclusive Quiz ===== */
  function quizGame(root) {
    const Q = [
      [["Coğrafya", "Geography"], ["Dünyanın en büyük okyanusu hangisi?", "Which is the largest ocean on Earth?"], [["Atlas", "Atlantic"], ["Hint", "Indian"], ["Pasifik", "Pacific"], ["Arktik", "Arctic"]], 2],
      [["Genel kültür", "General knowledge"], ["Bir haftada kaç saat vardır?", "How many hours are there in a week?"], ["144", "168", "172", "186"], 1],
      [["Uzay", "Space"], ["Hangisi “Kızıl Gezegen” olarak bilinir?", "Which one is known as the “Red Planet”?"], [["Venüs", "Venus"], "Mars", ["Jüpiter", "Jupiter"], ["Merkür", "Mercury"]], 1],
      [["Spor", "Sports"], ["Satrançta her oyuncu kaç piyonla başlar?", "How many pawns does each chess player start with?"], ["6", "8", "10", "12"], 1],
      [["Bilim", "Science"], ["Su, deniz seviyesinde kaç °C'de kaynar?", "At sea level, water boils at how many °C?"], ["90", "100", "110", "120"], 1],
      [["Müzik", "Music"], ["Bir oktavda kaç beyaz piyano tuşu vardır?", "How many white piano keys are in one octave?"], ["5", "7", "8", "12"], 1],
      [["Tarih", "History"], ["Hangisi bir antik dünya harikasıdır?", "Which one is an ancient wonder of the world?"], [["Eyfel Kulesi", "Eiffel Tower"], ["Büyük Piramit", "Great Pyramid"], ["Big Ben", "Big Ben"], ["Kremlin", "Kremlin"]], 1],
    ];
    const L2 = (v) => (Array.isArray(v) ? v[EN ? 1 : 0] : v);
    const cat = $(".q-cat", root), qt = $(".q-text", root), opts = $$(".q-opt", root), bar = $(".q-bar i", root), scEl = $(".sc", root), stEl = $(".st", root);
    let qi = rnd(Q.length), t = 0, stage = -1, score = 1200 + rnd(8) * 100, streak = 2, asked = 0, pick = 0;
    const CYC = 5000;
    function show() {
      const q = Q[qi];
      cat.textContent = L2(q[0]); qt.textContent = L2(q[1]);
      opts.forEach((o, k) => { o.textContent = L2(q[2][k]); o.className = "q-opt"; o.style.setProperty("--k", k); });
      root.classList.remove("in"); void root.offsetWidth; root.classList.add("in");
      scEl.textContent = score; stEl.textContent = streak;
    }
    function update(dt) {
      t += dt;
      const cy = t % CYC;
      if (cy < dt && t > dt) { qi = (qi + 1) % Q.length; stage = -1; }
      if (stage < 0) { show(); stage = 0; }
      if (stage === 0) bar.style.transform = `scaleX(${(1 - clamp(cy / 2000)).toFixed(3)})`;
      if (stage === 0 && cy >= 2000) {
        asked++; const ans = Q[qi][3];
        pick = asked % 4 === 3 ? (ans + 1 + rnd(3)) % 4 : ans;
        opts[pick].classList.add("pick"); stage = 1;
      }
      if (stage === 1 && cy >= 2800) {
        const ans = Q[qi][3]; opts[pick].classList.remove("pick");
        opts[ans].classList.add("ok");
        if (pick !== ans) { opts[pick].classList.add("no"); streak = 0; } else { streak++; score += 100 + streak * 10; }
        scEl.textContent = score; stEl.textContent = streak; stage = 2;
      }
    }
    return { enter() { t = 0; stage = -1; qi = (qi + 1) % Q.length; }, update };
  }

  /* ===== Block Four: number merge ===== */
  function mergeGame(root) {
    const box = $(".mgrid", root), scEl = $(".sc", root), bsEl = $(".bs", root);
    for (let i = 0; i < 16; i++) box.appendChild(document.createElement("span"));
    let tiles = [], score = 0, best = 0, acc = 0, busy = false;
    const put = (t) => { t.el.style.setProperty("--x", t.x); t.el.style.setProperty("--y", t.y); };
    const paint = (t) => { t.el.textContent = t.v; t.el.dataset.v = Math.min(t.v, 2048); };
    function make(v, x, y) { const el = document.createElement("b"); el.className = "mt pop"; const t = { v, x, y, el }; paint(t); put(t); box.appendChild(el); tiles.push(t); return t; }
    function spawn() {
      const free = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!tiles.some((t) => t.x === x && t.y === y)) free.push([x, y]);
      if (!free.length) return; const [x, y] = free[rnd(free.length)]; make(Math.random() < 0.85 ? 2 : 4, x, y);
    }
    function plan(dir) { // 0 left, 1 right, 2 up, 3 down
      const res = [], H = dir < 2; let moved = false, gain = 0;
      for (let i = 0; i < 4; i++) {
        const line = tiles.filter((t) => (H ? t.y : t.x) === i).sort((a, b) => { const ka = H ? a.x : a.y, kb = H ? b.x : b.y; return dir % 2 ? kb - ka : ka - kb; });
        let k = 0, last = null;
        for (const t of line) {
          if (last && !last.m && last.t.v === t.v) { res.push({ t, x: last.x, y: last.y, into: last.t }); last.m = true; gain += t.v * 2; moved = true; continue; }
          const p = dir % 2 ? 3 - k : k, x = H ? p : i, y = H ? i : p;
          if (x !== t.x || y !== t.y) moved = true;
          last = { t, x, y, m: false }; res.push(last); k++;
        }
      }
      return { res, moved, gain };
    }
    function seed() {
      tiles.forEach((t) => t.el.remove()); tiles = []; score = 0;
      const vals = [2, 2, 4, 4, 8, 8, 16, 32, 64];
      for (let k = 0; k < 7; k++) spawn();
      tiles.forEach((t, k) => { t.v = vals[(k + rnd(3)) % vals.length]; paint(t); });
    }
    function move() {
      let bp = null;
      [3, 0, 1, 2].forEach((dr) => { const p = plan(dr); if (!p.moved) return; p.s = p.gain * 2 + (dr === 2 ? -6 : dr === 3 || dr === 0 ? 3 : 0) + Math.random() * 5; if (!bp || p.s > bp.s) bp = p; });
      if (!bp || tiles.length >= 15 && bp.gain === 0 && Math.random() < 0.3) {
        busy = true; tiles.forEach((t) => t.el.classList.add("out"));
        setTimeout(() => { seed(); hud(); busy = false; }, 420); return;
      }
      for (const r of bp.res) {
        r.t.x = r.x; r.t.y = r.y; put(r.t);
        if (r.into) {
          const tgt = r.into, src = r.t; src.dead = true; src.el.style.zIndex = 0; tgt.v *= 2;
          setTimeout(() => { src.el.remove(); paint(tgt); tgt.el.classList.remove("pop", "bump"); void tgt.el.offsetWidth; tgt.el.classList.add("bump"); }, 140);
        }
      }
      tiles = tiles.filter((t) => !t.dead);
      score += bp.gain; hud();
      setTimeout(spawn, 170);
    }
    function hud() { best = Math.max(best, score); scEl.textContent = score; bsEl.textContent = best; }
    seed(); score = 248; hud();
    return { enter: hud, update(dt) { acc += dt; if (acc >= 620 && !busy) { acc = 0; move(); } } };
  }

  /* ===== Legion Charge: grow the army at gates, clash with an enemy legion, topple a giant ===== */
  function armyGame(root) {
    const cv = $("canvas", root), c = cv.getContext("2d"), lvEl = $(".lv", root), arEl = $(".ar", root);
    const hsh = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const BLUE = ["#5b8fff", "#2f6fe4", "#173a92"], RED = ["#ff6b6b", "#d92f3c", "#7e1320"];
    const BRICK = ["#d3c5ae", "#c8b8a0", "#dccfba", "#bfae95"];
    let W = 0, H = 0, hy = 0, by = 0, d = 1;
    const sc = (dd) => 1 / (1 + Math.max(-0.15, dd) * 3.2);
    const Y = (dd) => hy + (by - hy) * sc(dd);
    const X = (wx, dd) => W / 2 + wx * W * 0.4 * sc(dd);
    const CD = 0.12, V = 0.9, SLAMS = [650, 1500], FIGHT = 2300, CLASH = 1500;
    let level = 6 + rnd(6), t, p, v, army, shown, cx, surge, gates, enemy, boss, pops, arrows, fx, fallers, coins, shake, born, lastN, won, aAcc, clashArmy, fightArmy;
    const result = (o, n) => (o.op === "+" ? n + o.v : o.op === "×" ? n * o.v : n - o.v);
    function setup() {
      t = 0; p = 0; v = V; army = 30 + rnd(14); shown = army; cx = 0; surge = 0;
      pops = []; arrows = []; fx = []; fallers = []; coins = []; shake = 0; born = []; lastN = 0; won = 0; aAcc = 0; level++;
      const g1 = [{ op: "+", v: 26 + rnd(16), ic: 0 }, { op: "+", v: 8 + rnd(8), ic: 1 }];
      const g2 = [{ op: "×", v: 2, ic: 2 }, { op: "−", v: 18 + rnd(12), ic: 3 }];
      gates = [{ z: 2.2, opts: Math.random() < 0.5 ? g1 : g1.reverse() }, { z: 3.9, opts: Math.random() < 0.5 ? g2 : g2.reverse() }];
      gates.forEach((g) => { g.done = false; g.pick = result(g.opts[0], 50) >= result(g.opts[1], 50) ? 0 : 1; });
      enemy = { z: 3.2, n: 38 + rnd(18), st: 0 }; enemy.n0 = enemy.n;
      boss = { z: 4.85, hp: 1, max: 900 + rnd(90), st: 0, e: 0, slams: 0 };
      lvEl.textContent = level; arEl.textContent = army;
    }
    setup();

    /* ---- simulation ---- */
    function shoot(kind, tdd) { // 0 blue→enemy, 1 enemy→blue, 2 blue→giant (arrow rain)
      const blue = kind !== 1, sp = (m) => (Math.random() - 0.5) * m;
      arrows.push({
        a: blue ? { wx: cx + sp(0.7), dd: CD + surge + Math.random() * 0.25, lift: 0.025 } : { wx: sp(0.6), dd: tdd + Math.random() * 0.2, lift: 0.025 },
        b: blue ? { wx: sp(kind === 2 ? 0.45 : 0.7), dd: tdd + Math.random() * 0.2, lift: kind === 2 ? 0.15 + Math.random() * 0.3 : 0.02 } : { wx: cx + sp(0.6), dd: CD + surge + Math.random() * 0.2, lift: 0.02 },
        t0: t, dur: 380 + Math.random() * 220, arc: (kind === 2 ? 0.2 : 0.09) + Math.random() * 0.05, red: !blue,
      });
    }
    function slam() {
      boss.slams++; shake = 1;
      fx.push({ k: "wave", t0: t, wx: 0, dd: CD + surge + 0.18 });
      for (let k = 0; k < 12; k++) fallers.push({ wx: cx + (Math.random() - 0.5) * 0.7, dd: CD + surge + Math.random() * 0.2, vx: (Math.random() - 0.5) * 0.9, up: 0.6 + Math.random() * 0.8, t0: t, spin: (Math.random() - 0.5) * 12 });
    }
    function update(dt) {
      t += dt;
      const ng = gates.find((g) => !g.done);
      let aim = ng && ng.z - p < 1.7 ? (ng.pick ? 0.5 : -0.5) : 0;
      if (enemy.st < 2 && enemy.z - p < 1.3 && (!ng || enemy.z < ng.z)) aim = 0;
      cx += (aim - cx) * Math.min(1, dt / 320);
      const stop = enemy.st === 1 || boss.st >= 1;
      v += ((stop ? 0 : V) - v) * Math.min(1, dt / 160);
      p += (v * dt) / 1000;
      const want = enemy.st === 1 ? 0.03 : boss.st === 1 ? 0.07 : 0;
      surge += (want - surge) * Math.min(1, dt / 250);
      for (const g of gates) if (!g.done && g.z - p <= CD) {
        g.done = true; const o = g.opts[g.pick];
        army = Math.max(3, result(o, army));
        pops.push({ s: o.op + o.v, t0: t, col: o.op === "−" ? "#ff8a8a" : "#9dffb9", wx: cx, dd: CD, lift: 0.2, size: 22 });
        fx.push({ k: "ring", t0: t, wx: cx, dd: CD + 0.08, col: o.op === "−" ? "255,90,90" : "90,160,255" });
      }
      if (enemy.st === 0 && enemy.z - p <= CD + 0.46) { enemy.st = 1; enemy.t0 = t; clashArmy = army; aAcc = 0; }
      if (enemy.st === 1) {
        const q = clamp((t - enemy.t0) / CLASH);
        enemy.n = Math.round(enemy.n0 * (1 - q * (0.6 + 0.4 * q)));
        army = Math.max(3, Math.round(clashArmy - enemy.n0 * 0.3 * q));
        aAcc += dt; while (aAcc > 32) { aAcc -= 32; shoot(Math.random() < 0.78 ? 0 : 1, enemy.z - p); }
        if (q >= 1) { enemy.st = 2; fx.push({ k: "poof", t0: t, wx: 0, dd: enemy.z - p }); }
      }
      if (boss.st === 0 && boss.z - p <= CD + 0.6) { boss.st = 1; boss.t0 = t; fightArmy = army; boss.next = 0; aAcc = 0; }
      if (boss.st === 1) {
        const e = t - boss.t0, q = clamp(e / FIGHT);
        boss.hp = 1 - q;
        aAcc += dt; while (aAcc > 40) { aAcc -= 40; shoot(2, boss.z - p); }
        if (e > boss.next) { boss.next = e + 280 + rnd(140); pops.push({ s: "−" + (40 + rnd(160)), t0: t, col: "#ffd27a", wx: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.45), dd: boss.z - p, lift: 0.2 + Math.random() * 0.3, size: 16 + rnd(5) }); }
        SLAMS.forEach((s0) => { if (e >= s0 && boss.e < s0) slam(); });
        boss.e = e;
        army = Math.max(5, Math.round(fightArmy * (1 - 0.13 * boss.slams)));
        if (q >= 1) {
          boss.st = 2; boss.dead = t; won = t; shake = 0.7;
          for (let k = 0; k < 26; k++) coins.push({ a: -Math.PI * (0.1 + Math.random() * 0.8), v: 0.5 + Math.random() * 0.7, t0: t + rnd(200), r: Math.random() * 6 });
        }
      }
      shake = Math.max(0, shake - dt / 380);
      shown += (army - shown) * Math.min(1, dt / 140);
      arEl.textContent = Math.round(shown);
    }

    /* ---- painting helpers ---- */
    function quad(a0, a1, d0, d1) {
      c.beginPath(); c.moveTo(X(a0, d0), Y(d0)); c.lineTo(X(a1, d0), Y(d0)); c.lineTo(X(a1, d1), Y(d1)); c.lineTo(X(a0, d1), Y(d1)); c.closePath();
    }
    function sky(now) {
      const g = c.createLinearGradient(0, 0, 0, hy);
      g.addColorStop(0, "#161340"); g.addColorStop(0.45, "#4b2f7e"); g.addColorStop(0.8, "#d4697a"); g.addColorStop(1, "#ffbf7d");
      c.fillStyle = g; c.fillRect(0, 0, W, hy + 1);
      for (let k = 0; k < 22; k++) { c.fillStyle = `rgba(255,255,255,${0.2 + 0.25 * Math.sin(now / 500 + k * 3)})`; c.fillRect(hsh(k) * W, hsh(k + 40) * hy * 0.42, 1.3 * d, 1.3 * d); }
      const sx = W * 0.26, sy = hy - 4 * d;
      const glow = c.createRadialGradient(sx, sy, 0, sx, sy, W * 0.7);
      glow.addColorStop(0, "rgba(255,214,150,.75)"); glow.addColorStop(0.18, "rgba(255,170,120,.3)"); glow.addColorStop(1, "rgba(255,140,110,0)");
      c.fillStyle = glow; c.fillRect(0, 0, W, hy);
      c.fillStyle = "#fff3cf"; c.beginPath(); c.arc(sx, sy, 15 * d, Math.PI, 0); c.fill();
      for (let k = 0; k < 6; k++) {
        const w = (60 + hsh(k + 7) * 70) * d, x = ((hsh(k) * W * 1.6 + now * 0.005 * (1 + k * 0.25) * d) % (W + w * 2)) - w, y = hy * (0.3 + 0.1 * k);
        c.fillStyle = `rgba(255,${150 + k * 12},${150 + k * 6},${0.16 + k * 0.035})`; c.beginPath(); c.ellipse(x, y, w, (3 + hsh(k + 3) * 4) * d, 0, 0, 7); c.fill();
      }
      // distant giant's fortress on the horizon
      const fx0 = W * 0.5, fb = hy + 1;
      c.fillStyle = "#5a3a6e"; c.beginPath(); c.moveTo(fx0 - 70 * d, fb); c.quadraticCurveTo(fx0 - 30 * d, fb - 14 * d, fx0, fb - 12 * d); c.quadraticCurveTo(fx0 + 34 * d, fb - 15 * d, fx0 + 74 * d, fb); c.fill();
      c.fillStyle = "#3e2856";
      c.fillRect(fx0 - 18 * d, fb - 20 * d, 36 * d, 10 * d);
      for (let k = 0; k < 7; k++) c.fillRect(fx0 + (-18 + k * 5.4) * d, fb - 23 * d, 3 * d, 3 * d);
      [[-24, 30, 6], [18, 28, 6], [-4, 38, 8]].forEach(([ox, hh, ww]) => {
        c.fillRect(fx0 + ox * d, fb - hh * d, ww * d, (hh - 10) * d);
        c.beginPath(); c.moveTo(fx0 + (ox - 1.5) * d, fb - hh * d); c.lineTo(fx0 + (ox + ww / 2) * d, fb - (hh + 12) * d); c.lineTo(fx0 + (ox + ww + 1.5) * d, fb - hh * d); c.fill();
        c.fillStyle = "#d92f3c"; c.fillRect(fx0 + (ox + ww / 2) * d, fb - (hh + 17) * d, 5 * d, 3 * d); c.fillStyle = "#3e2856";
        c.fillRect(fx0 + (ox + ww / 2 - 0.4) * d, fb - (hh + 17) * d, 0.8 * d, 6 * d);
      });
      for (let k = 0; k < 5; k++) { c.fillStyle = `rgba(255,170,80,${0.55 + 0.35 * Math.sin(now / 240 + k * 2)})`; c.fillRect(fx0 + (-13 + k * 6) * d, fb - 16 * d, 1.5 * d, 2.2 * d); }
    }
    function sea(now) {
      const g = c.createLinearGradient(0, hy, 0, H);
      g.addColorStop(0, "#f2a57c"); g.addColorStop(0.07, "#a0618e"); g.addColorStop(0.35, "#3b3f88"); g.addColorStop(1, "#121a48");
      c.fillStyle = g; c.fillRect(0, hy, W, H - hy);
      const sx = W * 0.26;
      for (let k = 0; k < 80; k++) {
        const f = Math.pow(hsh(k + 3), 1.5), yy = hy + f * (H - hy);
        const w = (5 + 34 * f) * d * (0.5 + hsh(k + 9)), xx = sx + (hsh(k + 21) - 0.5) * (16 + 130 * f) * d + Math.sin(now / 650 + k) * 5 * d;
        c.fillStyle = `rgba(255,214,160,${(0.55 * (1 - f) + 0.08) * (0.5 + 0.5 * Math.sin(now / 280 + k * 1.7))})`;
        c.fillRect(xx - w / 2, yy, w, 1.4 * d);
      }
      for (let k = 0; k < 46; k++) {
        const f = hsh(k + 77), yy = hy + Math.pow(f, 1.3) * (H - hy), xx = hsh(k + 55) * W + Math.sin(now / 900 + k) * 8 * d;
        c.fillStyle = `rgba(170,190,255,${0.1 + 0.08 * Math.sin(now / 400 + k)})`; c.fillRect(xx, yy, (6 + 18 * f) * d, 1.2 * d);
      }
    }
    function causeway(now) {
      const RL = 0.065, rows = 44, off = ((p % RL) + RL) % RL, base = Math.floor(p / RL), BW = 0.3;
      c.fillStyle = "#b9a98f"; quad(-1, 1, rows * RL - off, 60); c.fill();
      const wallH = (dd, merlon) => W * 0.4 * sc(dd) * (merlon ? 0.2 : 0.12);
      for (let k = rows; k >= -3; k--) {
        const d0 = k * RL - off, d1 = d0 + RL, id = base + k;
        if (d1 < -0.15) continue;
        const shift = id % 2 ? BW / 2 : 0, lw = Math.max(0.7 * d, 2.2 * d * sc(d0));
        c.strokeStyle = "rgba(96,78,58,.55)"; c.lineWidth = lw;
        for (let b = -1; b < 8; b++) {
          const a0 = Math.max(-1, -1 + b * BW + shift), a1 = Math.min(1, -1 + (b + 1) * BW + shift);
          if (a1 - a0 < 0.01) continue;
          c.fillStyle = BRICK[(hsh(id * 7 + b) * 4) | 0]; quad(a0, a1, d0, d1); c.fill();
          if (a0 > -1) { c.beginPath(); c.moveTo(X(a0, d0), Y(d0)); c.lineTo(X(a0, d1), Y(d1)); c.stroke(); }
        }
        c.beginPath(); c.moveTo(X(-1, d0), Y(d0)); c.lineTo(X(1, d0), Y(d0)); c.stroke();
        // crenellated walls (inner faces)
        [-1, 1].forEach((side) => {
          const merlon = id % 4 < 2, h0 = wallH(d0, merlon), h1 = wallH(d1, merlon), x0 = X(side, d0), x1 = X(side, d1), o0 = X(side * 1.13, d0), o1 = X(side * 1.13, d1);
          c.fillStyle = side < 0 ? "#efe6d6" : "#d6cab6";
          c.beginPath(); c.moveTo(x0, Y(d0)); c.lineTo(x1, Y(d1)); c.lineTo(x1, Y(d1) - h1); c.lineTo(x0, Y(d0) - h0); c.closePath(); c.fill();
          c.fillStyle = "#f8f3ea";
          c.beginPath(); c.moveTo(x0, Y(d0) - h0); c.lineTo(x1, Y(d1) - h1); c.lineTo(o1, Y(d1) - h1); c.lineTo(o0, Y(d0) - h0); c.closePath(); c.fill();
          c.fillStyle = "rgba(60,40,30,.18)"; c.fillRect(Math.min(x0, x1), Y(d1) - h1, 1 * d, Math.max(1, h1));
          if (id % 12 === 0 && d0 > 0.05) { // torch
            const tx2 = (x0 + o0) / 2, ty = Y(d0) - h0, s = sc(d0), fl = 1 + 0.25 * Math.sin(now / 70 + id);
            c.fillStyle = "#4a3324"; c.fillRect(tx2 - 1 * d * s, ty - 12 * d * s, 2 * d * s, 12 * d * s);
            const tg = c.createRadialGradient(tx2, ty - 14 * d * s, 0, tx2, ty - 14 * d * s, 22 * d * s * fl);
            tg.addColorStop(0, "rgba(255,230,150,.95)"); tg.addColorStop(0.25, "rgba(255,150,60,.55)"); tg.addColorStop(1, "rgba(255,120,40,0)");
            c.fillStyle = tg; c.beginPath(); c.arc(tx2, ty - 14 * d * s, 22 * d * s * fl, 0, 7); c.fill();
          }
        });
      }
      const fog = c.createLinearGradient(0, hy - 2 * d, 0, hy + 70 * d);
      fog.addColorStop(0, "rgba(246,170,130,.75)"); fog.addColorStop(1, "rgba(246,170,130,0)");
      c.fillStyle = fog; c.fillRect(0, hy - 2 * d, W, 72 * d);
    }
    function icon(k, x, y, s) {
      c.save(); c.translate(x, y); c.lineCap = "round"; c.lineJoin = "round";
      if (k === 0) { // sword
        c.rotate(-0.7); c.strokeStyle = "#f4f7ff"; c.lineWidth = s * 0.16; c.beginPath(); c.moveTo(0, -s * 0.55); c.lineTo(0, s * 0.3); c.stroke();
        c.strokeStyle = "#ffcf5a"; c.lineWidth = s * 0.14; c.beginPath(); c.moveTo(-s * 0.25, s * 0.3); c.lineTo(s * 0.25, s * 0.3); c.moveTo(0, s * 0.3); c.lineTo(0, s * 0.5); c.stroke();
      } else if (k === 1) { // shield
        c.fillStyle = "#f4f7ff"; c.beginPath(); c.moveTo(0, -s * 0.5); c.lineTo(s * 0.4, -s * 0.35); c.quadraticCurveTo(s * 0.4, s * 0.25, 0, s * 0.5); c.quadraticCurveTo(-s * 0.4, s * 0.25, -s * 0.4, -s * 0.35); c.closePath(); c.fill();
        c.fillStyle = "#3a6df0"; c.fillRect(-s * 0.06, -s * 0.3, s * 0.12, s * 0.55); c.fillRect(-s * 0.22, -s * 0.1, s * 0.44, s * 0.12);
      } else if (k === 3) { // skull
        c.fillStyle = "#fff"; c.beginPath(); c.arc(0, -s * 0.08, s * 0.36, 0, 7); c.fill(); c.fillRect(-s * 0.2, s * 0.15, s * 0.4, s * 0.22);
        c.fillStyle = "#7e1320"; c.beginPath(); c.arc(-s * 0.13, -s * 0.06, s * 0.1, 0, 7); c.arc(s * 0.13, -s * 0.06, s * 0.1, 0, 7); c.fill();
      }
      c.restore();
    }
    function gate(g, dd, now) {
      const s = sc(dd), al = dd < CD ? clamp((dd + 0.06) / (CD + 0.06)) : clamp((2.6 - dd) / 0.4);
      if (al <= 0) return;
      c.globalAlpha = al;
      const yb = Y(dd), ph = W * 0.4 * s * 0.5;
      g.opts.forEach((o, k) => {
        const x0 = X(k ? 0.03 : -0.97, dd), x1 = X(k ? 0.97 : -0.03, dd), good = o.op !== "−", col = good ? "70,140,255" : "255,70,80";
        const gr = c.createLinearGradient(0, yb - ph, 0, yb);
        gr.addColorStop(0, `rgba(${col},.82)`); gr.addColorStop(1, `rgba(${col},.32)`);
        c.fillStyle = gr; c.fillRect(x0, yb - ph, x1 - x0, ph);
        c.save(); c.beginPath(); c.rect(x0, yb - ph, x1 - x0, ph); c.clip();
        const sx = x0 + ((now / 1100 + k * 0.5) % 1.8 - 0.4) * (x1 - x0);
        c.fillStyle = "rgba(255,255,255,.22)"; c.beginPath(); c.moveTo(sx, yb - ph); c.lineTo(sx + ph * 0.35, yb - ph); c.lineTo(sx + ph * 0.05, yb); c.lineTo(sx - ph * 0.3, yb); c.fill();
        c.restore();
        c.fillStyle = `rgba(${col},1)`; c.fillRect(x0, yb - ph - 2.5 * d * s, x1 - x0, 3.5 * d * s);
        const fs = ph * 0.46, label = o.op + o.v, tw = (c.font = `800 ${fs}px Sora, sans-serif`, c.measureText(label).width);
        const iw = o.ic === 2 ? 0 : fs * 0.75, lx = (x0 + x1) / 2 - iw / 2, ly = yb - ph * 0.5;
        c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
        c.lineWidth = fs * 0.18; c.strokeStyle = "rgba(10,16,50,.65)"; c.strokeText(label, lx, ly);
        c.fillStyle = "#fff"; c.fillText(label, lx, ly);
        if (iw) icon(o.ic, lx + tw / 2 + iw * 0.6, ly, fs * 0.95);
      });
      [-1, 0, 1].forEach((wx) => {
        const x = X(wx, dd), pw = 9 * d * s;
        c.fillStyle = "#efe7da"; c.fillRect(x - pw / 2, yb - ph * 1.18, pw, ph * 1.18);
        c.fillStyle = "#cbbfac"; c.fillRect(x, yb - ph * 1.18, pw / 2, ph * 1.18);
        c.fillStyle = "#ffcf5a"; c.beginPath(); c.arc(x, yb - ph * 1.18 - pw * 0.35, pw * 0.42, 0, 7); c.fill();
      });
      c.globalAlpha = 1;
    }
    function trooper(px, py, s, team, i, ph, front) {
      const C = team ? RED : BLUE, run = Math.sin(ph), b = Math.abs(run) * s * 0.13, kind = i % 3;
      c.fillStyle = "rgba(20,10,10,.28)"; c.beginPath(); c.ellipse(px, py, s * 0.42, s * 0.13, 0, 0, 7); c.fill();
      c.fillStyle = "#2b2233";
      c.fillRect(px - s * 0.2, py - s * 0.4 + run * s * 0.07, s * 0.14, s * 0.38);
      c.fillRect(px + s * 0.06, py - s * 0.4 - run * s * 0.07, s * 0.14, s * 0.38);
      if (kind === 2 && !front) { c.strokeStyle = "#8a6038"; c.lineWidth = s * 0.08; c.beginPath(); c.arc(px - s * 0.05, py - s * 0.85 - b, s * 0.42, -1.2, 1.2); c.stroke(); }
      c.fillStyle = C[1]; rr(c, px - s * 0.32, py - s * 0.98 - b, s * 0.64, s * 0.62, s * 0.16); c.fill();
      c.fillStyle = C[2]; c.fillRect(px - s * 0.32, py - s * 0.52 - b, s * 0.64, s * 0.08);
      if (front) { c.fillStyle = "#f1c7a0"; c.beginPath(); c.arc(px, py - s * 1.1 - b, s * 0.22, 0, 7); c.fill(); }
      c.fillStyle = C[0]; c.beginPath(); c.arc(px, py - s * 1.16 - b, s * 0.27, front ? Math.PI : 0, front ? 0 : 7); c.fill();
      c.fillStyle = "rgba(255,255,255,.45)"; c.beginPath(); c.arc(px - s * 0.09, py - s * 1.25 - b, s * 0.08, 0, 7); c.fill();
      if (kind === 0) {
        c.strokeStyle = "#7b5a3c"; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(px + s * 0.34, py - s * 0.45 - b); c.lineTo(px + s * 0.44, py - s * 1.75 - b); c.stroke();
        c.fillStyle = "#eef2f8"; c.beginPath(); c.moveTo(px + s * 0.38, py - s * 1.7 - b); c.lineTo(px + s * 0.5, py - s * 1.72 - b); c.lineTo(px + s * 0.46, py - s * 1.98 - b); c.fill();
      } else if (kind === 1) {
        c.fillStyle = C[2]; c.beginPath(); c.arc(px + (front ? -0.36 : 0.36) * s, py - s * 0.72 - b, s * 0.3, 0, 7); c.fill();
        c.strokeStyle = "#ffcf5a"; c.lineWidth = s * 0.07; c.stroke();
      }
    }
    function legion(n, wx0, dd0, team, front, now, spread) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const r = spread * Math.sqrt(i + 0.5), a = i * 2.39996;
        pts.push({ wx: clamp(wx0 + r * Math.cos(a) * 1.5, -0.93, 0.93), dd: dd0 + r * Math.sin(a) * 0.3, i });
      }
      pts.sort((a, b) => b.dd - a.dd);
      let far = dd0;
      for (const q of pts) {
        far = Math.max(far, q.dd);
        let s = 11 * d * sc(q.dd) * (team ? 1.85 : 1.5);
        if (!team) { if (q.i >= lastN || born[q.i] === undefined) born[q.i] = t; const a = clamp((t - born[q.i]) / 260); s *= 0.3 + 0.7 * eo(a); }
        trooper(X(q.wx, q.dd), Y(q.dd), s, team, q.i, now * (team ? 0.006 : 0.018) + q.i * 1.3, front);
      }
      if (!team) lastN = n;
      return far;
    }
    function banner(x, y, s, now) {
      c.strokeStyle = "#e8c36a"; c.lineWidth = 2 * d * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 58 * d * s); c.stroke();
      c.fillStyle = "#ffd76a"; c.beginPath(); c.arc(x, y - 59 * d * s, 2.6 * d * s, 0, 7); c.fill();
      const fw = 34 * d * s, fh = 20 * d * s, top = y - 56 * d * s;
      c.beginPath(); c.moveTo(x, top);
      for (let k = 0; k <= 8; k++) c.lineTo(x + (fw * k) / 8, top + Math.sin(now / 160 - k * 0.7) * 3 * d * s * (k / 8));
      for (let k = 8; k >= 0; k--) c.lineTo(x + (fw * k) / 8, top + fh + Math.sin(now / 160 - k * 0.7) * 3 * d * s * (k / 8));
      c.closePath();
      const g = c.createLinearGradient(x, top, x + fw, top + fh); g.addColorStop(0, "#2f6fe4"); g.addColorStop(1, "#1a3f9e");
      c.fillStyle = g; c.fill();
      c.fillStyle = "#ffd76a"; c.beginPath(); c.arc(x + fw * 0.45, top + fh * 0.5 + Math.sin(now / 160 - 3.2) * 1.5 * d * s, fh * 0.24, 0, 7); c.fill();
    }
    function badge(x, y, n, red) {
      const s = String(n), fs = 15 * d;
      c.font = `800 ${fs}px Sora, sans-serif`;
      const ww = Math.max(34 * d, c.measureText(s).width + 20 * d);
      c.fillStyle = red ? "rgba(214,40,56,.95)" : "rgba(47,111,228,.95)"; rr(c, x - ww / 2, y - 12 * d, ww, 24 * d, 12 * d); c.fill();
      c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1 * d; c.stroke();
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, x, y + 1 * d);
    }
    function clubAngle(e) {
      for (const s0 of SLAMS) {
        if (e > s0 - 420 && e <= s0) return -0.35 - 2.3 * eo((e - (s0 - 420)) / 420);
        if (e > s0 && e <= s0 + 110) return -2.65 + 2.95 * ((e - s0) / 110);
        if (e > s0 + 110 && e <= s0 + 520) return 0.3 - 0.65 * eo((e - s0 - 110) / 410);
      }
      return -0.35 + Math.sin(e / 280) * 0.06;
    }
    function giant(dd, now) {
      const s = sc(dd), gx = X(0, dd), gy = Y(dd), bh = H * 0.6 * s;
      let fall = 0, al = 1;
      if (boss.st === 2) { fall = clamp((t - boss.dead) / 750); al = 1 - clamp((fall - 0.65) / 0.35); }
      if (al <= 0) return;
      const e = boss.st === 1 ? t - boss.t0 : 0, walk = boss.st === 0 ? Math.sin(now / 170) : 0, hit = boss.st === 1 ? Math.sin(now / 35) * bh * 0.006 : 0;
      c.save(); c.globalAlpha = al; c.translate(gx + hit, gy);
      c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.ellipse(0, 0, bh * 0.44, bh * 0.075, 0, 0, 7); c.fill();
      c.rotate(-fall * 0.5); c.scale(1, 1 - fall * 0.45);
      const leg = (sx, o) => {
        c.fillStyle = "#6e1f26"; rr(c, sx - bh * 0.08, -bh * 0.38 + o, bh * 0.16, bh * 0.34, bh * 0.05); c.fill();
        c.fillStyle = "#3a2a24"; rr(c, sx - bh * 0.105, -bh * 0.07, bh * 0.21, bh * 0.08, bh * 0.03); c.fill();
      };
      leg(-bh * 0.12, walk * bh * 0.02); leg(bh * 0.12, -walk * bh * 0.02);
      c.fillStyle = "#4a2f22"; c.beginPath(); c.moveTo(-bh * 0.24, -bh * 0.4); c.lineTo(bh * 0.24, -bh * 0.4); c.lineTo(bh * 0.17, -bh * 0.2); c.lineTo(-bh * 0.17, -bh * 0.2); c.fill();
      c.fillStyle = "#b9343e"; c.beginPath(); c.ellipse(-bh * 0.37, -bh * 0.56, bh * 0.09, bh * 0.21, 0.25, 0, 7); c.fill();
      c.beginPath(); c.arc(-bh * 0.42, -bh * 0.37, bh * 0.07, 0, 7); c.fill();
      const tg = c.createLinearGradient(0, -bh * 0.9, 0, -bh * 0.36); tg.addColorStop(0, "#de4b52"); tg.addColorStop(1, "#7d1f29");
      c.fillStyle = tg; rr(c, -bh * 0.31, -bh * 0.88, bh * 0.62, bh * 0.52, bh * 0.19); c.fill();
      c.fillStyle = "#3b3f4e"; rr(c, -bh * 0.2, -bh * 0.82, bh * 0.4, bh * 0.27, bh * 0.08); c.fill();
      c.strokeStyle = "#8a91a6"; c.lineWidth = bh * 0.012; c.stroke();
      c.fillStyle = "#5ee7ff"; c.shadowColor = "#5ee7ff"; c.shadowBlur = 12 * d * s; c.beginPath(); c.arc(0, -bh * 0.69, bh * 0.045, 0, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = "#2b1a14"; c.fillRect(-bh * 0.31, -bh * 0.47, bh * 0.62, bh * 0.07);
      c.fillStyle = "#e8b64a"; rr(c, -bh * 0.06, -bh * 0.485, bh * 0.12, bh * 0.1, bh * 0.02); c.fill();
      [-1, 1].forEach((k) => {
        c.fillStyle = "#4b5163"; c.beginPath(); c.ellipse(k * bh * 0.3, -bh * 0.82, bh * 0.14, bh * 0.09, 0, 0, 7); c.fill();
        c.fillStyle = "#d9dee8";
        for (let j = 0; j < 3; j++) { const sx = k * bh * (0.22 + j * 0.07); c.beginPath(); c.moveTo(sx - bh * 0.025, -bh * 0.88); c.lineTo(sx + k * bh * 0.01, -bh * 0.97); c.lineTo(sx + bh * 0.025, -bh * 0.88); c.fill(); }
      });
      c.fillStyle = "#c13a44"; c.beginPath(); c.arc(0, -bh * 0.98, bh * 0.135, 0, 7); c.fill();
      c.fillStyle = "#f1e6cf";
      [-1, 1].forEach((k) => {
        c.beginPath(); c.moveTo(k * bh * 0.09, -bh * 1.06); c.quadraticCurveTo(k * bh * 0.32, -bh * 1.08, k * bh * 0.28, -bh * 1.3); c.quadraticCurveTo(k * bh * 0.24, -bh * 1.12, k * bh * 0.03, -bh * 1.1); c.fill();
        c.beginPath(); c.moveTo(k * bh * 0.05, -bh * 0.92); c.lineTo(k * bh * 0.075, -bh * 1.0); c.lineTo(k * bh * 0.1, -bh * 0.92); c.fill();
      });
      c.fillStyle = "#3a0e14"; c.fillRect(-bh * 0.1, -bh * 1.04, bh * 0.2, bh * 0.025);
      c.fillStyle = "#ffe066"; c.shadowColor = "#ffd84a"; c.shadowBlur = 10 * d * s;
      c.fillRect(-bh * 0.085, -bh * 1.015, bh * 0.055, bh * 0.024); c.fillRect(bh * 0.03, -bh * 1.015, bh * 0.055, bh * 0.024); c.shadowBlur = 0;
      c.save(); c.translate(bh * 0.33, -bh * 0.8); c.rotate(clubAngle(e));
      c.fillStyle = "#b9343e"; c.beginPath(); c.ellipse(0, bh * 0.18, bh * 0.085, bh * 0.21, 0, 0, 7); c.fill();
      c.fillStyle = "#5a3a22"; c.fillRect(-bh * 0.025, bh * 0.3, bh * 0.05, bh * 0.42);
      c.fillStyle = "#5b6072"; rr(c, -bh * 0.1, bh * 0.66, bh * 0.2, bh * 0.26, bh * 0.05); c.fill();
      c.fillStyle = "#d9dee8";
      for (let j = 0; j < 3; j++) { const yy = bh * (0.71 + j * 0.08); c.beginPath(); c.moveTo(bh * 0.1, yy - bh * 0.02); c.lineTo(bh * 0.15, yy); c.lineTo(bh * 0.1, yy + bh * 0.02); c.fill(); c.beginPath(); c.moveTo(-bh * 0.1, yy - bh * 0.02); c.lineTo(-bh * 0.15, yy); c.lineTo(-bh * 0.1, yy + bh * 0.02); c.fill(); }
      c.restore();
      c.restore();
    }
    function hud(now) {
      const x0 = W * 0.13, x1 = W * 0.87, y = 116 * d, total = boss.z - CD - 0.6;
      c.fillStyle = "rgba(10,8,30,.45)"; rr(c, x0 - 8 * d, y - 7 * d, x1 - x0 + 16 * d, 14 * d, 7 * d); c.fill();
      const prog = clamp(p / total);
      const pg = c.createLinearGradient(x0, 0, x1, 0); pg.addColorStop(0, "#5b8fff"); pg.addColorStop(1, "#38d6ff");
      c.fillStyle = "rgba(255,255,255,.15)"; c.fillRect(x0, y - 1.5 * d, x1 - x0, 3 * d);
      c.fillStyle = pg; c.fillRect(x0, y - 1.5 * d, (x1 - x0) * prog, 3 * d);
      [[gates[0].z - CD, "#5b8fff"], [enemy.z - CD - 0.46, "#ff5a5a"], [gates[1].z - CD, "#5b8fff"]].forEach(([z, col]) => {
        const f = clamp(z / total), done = p >= z;
        c.fillStyle = done ? "#34d399" : col; c.beginPath(); c.arc(x0 + (x1 - x0) * f, y, 4 * d, 0, 7); c.fill();
      });
      c.fillStyle = boss.st === 2 ? "#34d399" : "#ffcf5a"; c.beginPath(); c.arc(x1, y, 6 * d, 0, 7); c.fill();
      icon(3, x1, y, 8 * d);
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x0 + (x1 - x0) * prog, y, 3 * d, 0, 7); c.fill();
      if (boss.st >= 1 && !(boss.st === 2 && t - boss.dead > 600)) {
        const by2 = 136 * d, bw = W * 0.74, bx = (W - bw) / 2;
        c.font = `800 ${10.5 * d}px Sora, sans-serif`; c.textBaseline = "middle";
        c.fillStyle = "#ffe2b8"; c.textAlign = "left"; c.fillText(tx("DEV", "GIANT"), bx + 16 * d, by2 - 9 * d);
        c.textAlign = "right"; c.fillText(Math.ceil(boss.hp * boss.max), bx + bw, by2 - 9 * d);
        icon(3, bx + 6 * d, by2 - 9 * d, 10 * d);
        c.fillStyle = "rgba(10,8,30,.6)"; rr(c, bx, by2, bw, 7 * d, 3.5 * d); c.fill();
        const hg = c.createLinearGradient(bx, 0, bx + bw, 0); hg.addColorStop(0, "#b3121f"); hg.addColorStop(1, "#ff6b3d");
        c.fillStyle = hg; rr(c, bx, by2, Math.max(0.01, bw * boss.hp), 7 * d, 3.5 * d); c.fill();
        c.fillStyle = "rgba(0,0,0,.35)"; for (let k = 1; k < 4; k++) c.fillRect(bx + (bw * k) / 4, by2, 1 * d, 7 * d);
      }
    }
    function victory(now) {
      const e = t - won; if (!won || e < 250) return;
      const q = clamp((e - 250) / 420), sc2 = 0.4 + 0.6 * (1 + 2.2 * Math.pow(q - 1, 3) + 1.2 * Math.pow(q - 1, 2)), cy = H * 0.42;
      c.save(); c.translate(W / 2, cy); c.scale(sc2, sc2); c.globalAlpha = clamp(q * 2);
      const bw = W * 0.66, bh2 = 40 * d;
      c.fillStyle = "#8e1522";
      [-1, 1].forEach((k) => { c.beginPath(); c.moveTo(k * bw * 0.42, -bh2 * 0.32); c.lineTo(k * bw * 0.62, -bh2 * 0.32); c.lineTo(k * bw * 0.55, bh2 * 0.05); c.lineTo(k * bw * 0.62, bh2 * 0.42); c.lineTo(k * bw * 0.42, bh2 * 0.42); c.fill(); });
      const rg = c.createLinearGradient(0, -bh2 / 2, 0, bh2 / 2); rg.addColorStop(0, "#ff5a4f"); rg.addColorStop(1, "#c41d2e");
      c.fillStyle = rg; rr(c, -bw / 2, -bh2 / 2, bw, bh2, 8 * d); c.fill();
      c.strokeStyle = "#ffd76a"; c.lineWidth = 2.5 * d; c.stroke();
      c.font = `800 ${23 * d}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.lineWidth = 5 * d; c.strokeStyle = "#7e1320"; c.strokeText(tx("ZAFER!", "VICTORY!"), 0, 1 * d);
      c.fillStyle = "#fff6d8"; c.fillText(tx("ZAFER!", "VICTORY!"), 0, 1 * d);
      for (let k = 0; k < 3; k++) {
        const sq = clamp((e - 500 - k * 140) / 260); if (sq <= 0) continue;
        const ss = (k === 1 ? 17 : 13) * d * (0.3 + 0.7 * (1 + 2.6 * Math.pow(sq - 1, 3) + 1.6 * Math.pow(sq - 1, 2)));
        const sx = (k - 1) * 30 * d, sy = -bh2 * 0.5 - (k === 1 ? 20 : 12) * d;
        c.fillStyle = "#ffd23f"; c.shadowColor = "#ffb300"; c.shadowBlur = 12 * d; c.beginPath();
        for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, r = j % 2 ? ss * 0.45 : ss; c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
        c.closePath(); c.fill(); c.shadowBlur = 0;
      }
      c.restore();
      coins.forEach((k) => {
        const ce = (t - k.t0) / 1000; if (ce <= 0) return;
        const x = W / 2 + Math.cos(k.a) * k.v * ce * W * 0.9, y = cy + Math.sin(k.a) * k.v * ce * H * 0.7 + ce * ce * H * 0.9;
        if (y > H + 20 * d) return;
        const w = Math.abs(Math.cos(ce * 9 + k.r)) * 5 * d + 1 * d;
        c.fillStyle = "#ffcf3f"; c.beginPath(); c.ellipse(x, y, w, 5 * d, 0, 0, 7); c.fill();
        c.fillStyle = "#e29b12"; c.beginPath(); c.ellipse(x, y, w * 0.55, 2.8 * d, 0, 0, 7); c.fill();
      });
    }

    function draw(now) {
      d = fit(cv); W = cv.width; H = cv.height; if (!W) return;
      hy = H * 0.33; by = H * 1.04;
      c.save();
      if (shake > 0) c.translate((Math.random() - 0.5) * 9 * d * shake, (Math.random() - 0.5) * 7 * d * shake);
      sky(now); sea(now); causeway(now);
      const layers = [];
      for (const g of gates) { const dd = g.z - p; if (dd >= CD && dd < 2.6) layers.push([dd, () => gate(g, dd, now)]); }
      if (enemy.st < 2 && enemy.z - p < 2.6) {
        const ed = enemy.z - p;
        layers.push([ed, () => {
          const far = legion(Math.min(110, enemy.n), 0, ed, 1, true, now, 0.04);
          if (enemy.n > 0) badge(X(0, ed), Y(far) - 11 * d * sc(far) * 1.85 * 2.2 - 16 * d, enemy.n, true);
        }]);
      }
      if (boss.z - p < 2.6) { const bd = Math.max(CD + 0.6, boss.z - p); layers.push([bd, () => giant(bd, now)]); }
      layers.sort((a, b) => b[0] - a[0]).forEach((l) => l[1]());
      // ground effects
      fx = fx.filter((f) => {
        const q = (t - f.t0) / (f.k === "wave" ? 650 : f.k === "poof" ? 800 : 500); if (q >= 1) return false;
        const x = X(f.wx, f.dd), y = Y(f.dd), s = sc(f.dd);
        if (f.k === "ring") { c.strokeStyle = `rgba(${f.col},${1 - q})`; c.lineWidth = 3 * d; c.beginPath(); c.ellipse(x, y, W * 0.4 * s * (0.3 + q * 0.6), W * 0.4 * s * (0.08 + q * 0.14), 0, 0, 7); c.stroke(); }
        if (f.k === "wave") {
          c.strokeStyle = `rgba(255,236,200,${1 - q})`; c.lineWidth = 4 * d * (1 - q) + 1; c.beginPath(); c.ellipse(x, y, W * (0.1 + q * 0.6), W * (0.03 + q * 0.13), 0, 0, 7); c.stroke();
          c.fillStyle = `rgba(200,170,130,${0.45 * (1 - q)})`; for (let k = 0; k < 9; k++) { const a = k * 0.7; c.beginPath(); c.arc(x + Math.cos(a) * W * 0.3 * q, y - Math.abs(Math.sin(a)) * 18 * d * q, (6 + 10 * q) * d, 0, 7); c.fill(); }
        }
        if (f.k === "poof") { for (let k = 0; k < 10; k++) { const a = k * 0.63; c.fillStyle = `rgba(255,${120 + k * 8},${110 + k * 6},${0.5 * (1 - q)})`; c.beginPath(); c.arc(x + Math.cos(a) * W * 0.22 * s * (0.5 + q), y - 14 * d * s - Math.abs(Math.sin(a)) * 30 * d * s * q, (8 + 12 * q) * d * s, 0, 7); c.fill(); } }
        return true;
      });
      // our legion + standard + count
      const n = Math.min(150, Math.round(shown)), far = legion(n, cx, CD + surge + 0.05, 0, false, now, 0.042);
      banner(X(cx, CD + surge + 0.07), Y(CD + surge + 0.07), sc(CD + surge + 0.07) * 1.5, now);
      badge(X(cx, CD + surge), Y(far) - 9.5 * d * sc(far) * 1.5 * 2.1 - 14 * d, Math.round(shown), false);
      for (const g of gates) { const dd = g.z - p; if (dd < CD && dd > -0.06) gate(g, dd, now); }
      // knocked-back soldiers
      fallers = fallers.filter((f) => {
        const q = (t - f.t0) / 800; if (q >= 1) return false;
        const x = X(f.wx + f.vx * q, f.dd), y = Y(f.dd) - Math.sin(Math.PI * q) * f.up * 60 * d;
        c.save(); c.globalAlpha = 1 - q * q; c.translate(x, y); c.rotate(f.spin * q); trooper(0, 0, 9 * d, 0, 0, 0, false); c.restore();
        return true;
      });
      // arrows
      arrows = arrows.filter((a) => {
        const q = (t - a.t0) / a.dur; if (q >= 1) return false;
        const pos = (u) => {
          const dd = a.a.dd + (a.b.dd - a.a.dd) * u, wx = a.a.wx + (a.b.wx - a.a.wx) * u, lift = a.a.lift + (a.b.lift - a.a.lift) * u;
          return [X(wx, dd), Y(dd) - lift * H * sc(dd) - a.arc * H * 4 * u * (1 - u)];
        };
        const [x, y] = pos(q), [px2, py2] = pos(Math.max(0, q - 0.06));
        c.strokeStyle = a.red ? "rgba(255,150,150,.35)" : "rgba(220,235,255,.35)"; c.lineWidth = 1 * d;
        c.beginPath(); c.moveTo(px2, py2); c.lineTo(x, y); c.stroke();
        const ang = Math.atan2(y - py2, x - px2), L = 11 * d;
        c.strokeStyle = "#f6efe2"; c.lineWidth = 1.8 * d; c.beginPath(); c.moveTo(x - Math.cos(ang) * L, y - Math.sin(ang) * L); c.lineTo(x, y); c.stroke();
        c.fillStyle = a.red ? "#ff6b6b" : "#9fc2ff"; c.fillRect(x - Math.cos(ang) * L - 1.4 * d, y - Math.sin(ang) * L - 1.4 * d, 2.8 * d, 2.8 * d);
        return true;
      });
      // floating numbers
      pops = pops.filter((o) => {
        const q = (t - o.t0) / 900; if (q >= 1) return false;
        const x = X(o.wx, o.dd), y = Y(o.dd) - o.lift * H * sc(o.dd) - q * 34 * d, fs = o.size * d * (q < 0.15 ? 0.6 + q * 2.7 : 1);
        c.globalAlpha = 1 - q * q; c.font = `800 ${fs}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.lineJoin = "round"; c.lineWidth = fs * 0.2; c.strokeStyle = "rgba(30,10,20,.75)"; c.strokeText(o.s, x, y);
        c.fillStyle = o.col; c.fillText(o.s, x, y); c.globalAlpha = 1;
        return true;
      });
      c.restore();
      hud(now);
      victory(now);
      const vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(5,3,20,.45)");
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }
    return { enter: setup, update, draw };
  }

  /* ===== ExStudio: trim, voice, background removal ===== */
  function studioApp(root) {
    const pc = $(".st-prev canvas", root), p = pc.getContext("2d"), tl = $(".st-tl", root), q = tl.getContext("2d");
    const fxEl = $(".st-fx", root), tmEl = $(".st-time", root), tools = $$(".st-tool", root);
    const PH = 3333, CLIP = 12;
    const FX = [[tx("Kes · 00:03.4", "Trim · 00:03.4"), 0], [tx("Ses efekti: Robot", "Voice effect: Robot"), 1], [tx("Arka planı sil", "Remove background"), 3]];
    const wave = Array.from({ length: 90 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23) + 0.3 * Math.sin(i * 2.1)));
    let t = 0, ph = -1;
    function setPhase(k) { ph = k; fxEl.textContent = FX[k][0]; tools.forEach((el, i) => el.classList.toggle("on", i === FX[k][1])); fxEl.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 350 }); }
    function update(dt) { t += dt; const k = Math.min(2, (t / PH) | 0); if (k !== ph) setPhase(k); }
    function preview(now, d) {
      const W = pc.width, H = pc.height, k = ph, lt = t - k * PH;
      const sky = p.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#ff5fd2"); sky.addColorStop(0.5, "#8b3cf0"); sky.addColorStop(1, "#24164f");
      p.fillStyle = sky; p.fillRect(0, 0, W, H);
      const sy = H * 0.5 - (t / 10000) * H * 0.12;
      p.fillStyle = "rgba(255,214,140,.95)"; p.beginPath(); p.arc(W * 0.7, sy, W * 0.12, 0, 7); p.fill();
      p.fillStyle = "#5b2aa8"; p.beginPath(); p.moveTo(0, H * 0.7); p.lineTo(W * 0.3, H * 0.5); p.lineTo(W * 0.55, H * 0.66); p.lineTo(W * 0.8, H * 0.46); p.lineTo(W, H * 0.6); p.lineTo(W, H); p.lineTo(0, H); p.fill();
      p.fillStyle = "#3a1a78"; p.beginPath(); p.moveTo(0, H * 0.82); p.lineTo(W * 0.4, H * 0.68); p.lineTo(W, H * 0.84); p.lineTo(W, H); p.lineTo(0, H); p.fill();
      if (k === 2) { // background removal: checkerboard wipes in
        const wx = W * eo(clamp(lt / 900)), s = 12 * d;
        p.save(); p.beginPath(); p.rect(0, 0, wx, H); p.clip();
        for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { p.fillStyle = ((x + y) / s) % 2 ? "#d9d6e6" : "#f4f2fa"; p.fillRect(x, y, s, s); }
        p.restore();
        if (lt < 900) { p.fillStyle = "#fff"; p.shadowColor = "#38d6ff"; p.shadowBlur = 14 * d; p.fillRect(wx - 1 * d, 0, 2 * d, H); p.shadowBlur = 0; }
      }
      // subject silhouette
      const cx = W * 0.42, base = H, hr = W * 0.11;
      p.fillStyle = "#170d33"; p.beginPath(); p.arc(cx, base - H * 0.5, hr, 0, 7); p.fill();
      p.beginPath(); p.moveTo(cx - W * 0.24, base); p.quadraticCurveTo(cx - W * 0.22, base - H * 0.3, cx, base - H * 0.34); p.quadraticCurveTo(cx + W * 0.22, base - H * 0.3, cx + W * 0.24, base); p.fill();
      p.strokeStyle = k === 2 ? "rgba(56,214,255,.95)" : "rgba(255,120,220,.55)"; p.lineWidth = (k === 2 ? 2 : 1.5) * d;
      if (k === 2) p.setLineDash([5 * d, 4 * d]), (p.lineDashOffset = -now / 40);
      p.beginPath(); p.arc(cx, base - H * 0.5, hr, Math.PI * 0.9, Math.PI * 2.1); p.stroke(); p.setLineDash([]);
      if (k === 1) { // voice: live waveform
        const n = 28, bw = W / n;
        for (let i = 0; i < n; i++) {
          const a = Math.abs(Math.sin(now / 160 + i * 0.6) * Math.sin(now / 410 + i * 0.27));
          const h = Math.round((0.15 + a * 0.85) * 5) / 5 * H * 0.22;
          p.fillStyle = `rgba(56,214,255,${0.55 + a * 0.45})`; rr(p, i * bw + bw * 0.2, H * 0.86 - h / 2, bw * 0.6, h, bw * 0.3); p.fill();
        }
      }
      if (k === 0 && lt > 700 && lt < 950) { p.fillStyle = `rgba(255,255,255,${0.5 * (1 - (lt - 700) / 250)})`; p.fillRect(0, 0, W, H); }
    }
    function timeline(now, d) {
      const W = tl.width, H = tl.height, L0 = 14 * d, R0 = W - 14 * d, span = R0 - L0, ph2 = clamp(t / 10000);
      q.clearRect(0, 0, W, H);
      q.fillStyle = "rgba(255,255,255,.35)"; q.font = `600 ${8.5 * d}px Inter, sans-serif`; q.textAlign = "center"; q.textBaseline = "top";
      for (let s = 0; s <= CLIP; s++) { const x = L0 + (s / CLIP) * span; q.fillRect(x, 4 * d, 1 * d, s % 2 ? 3 * d : 6 * d); if (s % 4 === 0) q.fillText(s + "s", x, 12 * d); }
      const vy = 28 * d, vh = 34 * d, cut = L0 + span * (3.4 / CLIP);
      const split = ph >= 0 && t > 700 ? eo(clamp((t - 700) / 300)) * 5 * d : 0;
      const clips = [[0, 0.28, "#ff4fd8", "#a855f7"], [0.28 + 0.005, 0.62, "#6d5cff", "#38d6ff"], [0.625, 1, "#f59e0b", "#f472b6"]];
      clips.forEach(([a, b, c1, c2], i) => {
        let x0 = L0 + a * span, x1 = L0 + b * span - 2 * d;
        if (i === 0) x1 = Math.min(x1, cut) - split / 2;
        const g = q.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
        q.fillStyle = g; rr(q, x0, vy, x1 - x0, vh, 6 * d); q.fill();
        q.fillStyle = "rgba(255,255,255,.18)";
        for (let fx2 = x0 + 4 * d; fx2 < x1 - 14 * d; fx2 += 16 * d) { rr(q, fx2, vy + 5 * d, 12 * d, vh - 10 * d, 3 * d); q.fill(); }
        if (i === 0 && split) { const s0 = cut + split / 2, s1 = L0 + b * span - 2 * d; if (s1 > s0) { q.fillStyle = g; rr(q, s0, vy, s1 - s0, vh, 6 * d); q.fill(); } }
      });
      const ay = vy + vh + 10 * d, ah = 30 * d, bw = span / wave.length, robot = ph === 1;
      wave.forEach((v, i) => {
        const x = L0 + i * bw, played = x < L0 + ph2 * span;
        let h = v * ah; if (robot) h = Math.round(v * 4) / 4 * ah;
        q.fillStyle = robot ? (played ? "#38d6ff" : "rgba(56,214,255,.35)") : played ? "#ff6ad5" : "rgba(255,106,213,.35)";
        q.fillRect(x + bw * 0.15, ay + (ah - h) / 2, bw * 0.7, h);
      });
      const px = L0 + ph2 * span;
      q.fillStyle = "#fff"; q.shadowColor = "#fff"; q.shadowBlur = 6 * d; q.fillRect(px - 1 * d, 22 * d, 2 * d, ay + ah - 18 * d); q.shadowBlur = 0;
      q.beginPath(); q.arc(px, 22 * d, 4 * d, 0, 7); q.fill();
      const secs = ph2 * CLIP; tmEl.textContent = `00:${String(Math.floor(secs)).padStart(2, "0")} / 00:${CLIP}`;
    }
    function draw(now) { const d = fit(pc); fit(tl); if (!pc.width || !tl.width) return; if (ph < 0) setPhase(0); preview(now, d); timeline(now, d); }
    return { enter() { t = 0; ph = -1; }, update, draw };
  }

  /* ===== scene rotation ===== */
  const META = {
    gem: ["Block Four", "blockfour", ["Blok bulmaca", "Block puzzle"], 1],
    neon: ["Neon Eco-Grid", "neonecogrid", ["Birleştir ve boşta", "Merge & idle"], 0],
    bn: ["BlockNest", "blocknest", ["Ahşap blok bulmaca", "Wood block puzzle"], 1],
    quiz: ["Exclusive Quiz", "quiz", ["Bilgi yarışması", "Trivia"], 0],
    merge: ["Block Four", "blockfour", ["Sayı birleştirme", "Number merge"], 1],
    army: ["Legion Charge", "legioncharge", ["Ordu koşusu", "Army run"], 0],
    wd: ["Woodora Classic", "woodoraclassic", ["Klasik ahşap bulmaca", "Classic wood puzzle"], 1],
    studio: ["ExStudio", "exstudio", ["Video, ses ve fotoğraf", "Video, audio & photo"], 0],
  };
  const MAKE = {
    gem: (el) => blockGame(el, GEM, 8), neon: neonGame, bn: (el) => blockGame(el, BN_WOOD, 8), quiz: quizGame,
    merge: mergeGame, army: armyGame, wd: (el) => blockGame(el, WD_WOOD, 9), studio: studioApp,
  };
  const DUR = 10000;
  const scenes = $$(".scene", screen), ctl = scenes.map((el) => MAKE[el.dataset.k](el));
  const card = $(".now"), icon = $(".now-ic", card), segBox = $(".now-seg", card);
  const imgBase = icon.getAttribute("src").replace(/blockfour\.png$/, "");
  const segs = scenes.map((_, i) => { const s = document.createElement("i"); s.addEventListener("click", (e) => { e.stopPropagation(); go(i); }); segBox.appendChild(s); return s; });
  let cur = 0, prev = -1, st = 0, swapAt = 0, last = performance.now(), visible = true;
  function setCard() {
    const [name, ic, genre, live] = META[scenes[cur].dataset.k];
    icon.src = imgBase + ic + ".png"; icon.alt = "";
    $(".now-name", card).textContent = name;
    $(".now-genre", card).textContent = genre[EN ? 1 : 0];
    const b = $(".now-badge", card); b.className = "now-badge " + (live ? "b-live" : "b-soon"); b.textContent = live ? "Google Play" : tx("Yolda", "On the way");
    card.classList.remove("flip"); void card.offsetWidth; card.classList.add("flip");
    segs.forEach((s, i) => { s.classList.toggle("done", i < cur); s.style.removeProperty("--p"); });
  }
  function go(i) {
    i = (i + scenes.length) % scenes.length; if (i === cur) return;
    if (prev >= 0) scenes[prev].classList.remove("leave");
    prev = cur; scenes[prev].classList.remove("on"); scenes[prev].classList.add("leave");
    cur = i; st = 0; swapAt = performance.now();
    scenes[cur].classList.add("on");
    screen.classList.remove("swap"); void screen.offsetWidth; screen.classList.add("swap");
    ctl[cur].enter && ctl[cur].enter();
    if (reduce && ctl[cur].update) ctl[cur].update(16, performance.now());
    setCard();
  }
  $(".phone").addEventListener("click", () => go(cur + 1));
  new IntersectionObserver((es) => es.forEach((e) => (visible = e.isIntersecting))).observe($(".stage"));
  ctl[0].enter && ctl[0].enter();
  setCard();
  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    if (visible && !document.hidden) {
      st += dt;
      if (!reduce && ctl[cur].update) ctl[cur].update(dt, now);
      if (st >= DUR) go(cur + 1);
      ctl[cur].draw && ctl[cur].draw(now);
      if (prev >= 0) {
        if (now - swapAt < 950) ctl[prev].draw && ctl[prev].draw(now);
        else { scenes[prev].classList.remove("leave"); prev = -1; }
      }
      segs[cur].style.setProperty("--p", Math.min(1, st / DUR).toFixed(3));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
