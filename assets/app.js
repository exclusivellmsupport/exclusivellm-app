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

  /* ---------- hero phone: rotating app scenes (≈8.5 s each) ----------
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
    const CYC = 4250;
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
      if (stage === 0) bar.style.transform = `scaleX(${(1 - clamp(cy / 1700)).toFixed(3)})`;
      if (stage === 0 && cy >= 1700) {
        asked++; const ans = Q[qi][3];
        pick = asked % 4 === 3 ? (ans + 1 + rnd(3)) % 4 : ans;
        opts[pick].classList.add("pick"); stage = 1;
      }
      if (stage === 1 && cy >= 2450) {
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

  /* ===== Legion Charge: army run through gates, then a giant ===== */
  function armyGame(root) {
    const cv = $("canvas", root), c = cv.getContext("2d"), lvEl = $(".lv", root), arEl = $(".ar", root);
    let t = 0, level = 6 + rnd(6), army, shown, cx, gates, boss, pops, fightFrom;
    const GT = 2300, BOSS_AT = 5000, ARRIVE = 6600, FIGHT = 1200;
    function setup() {
      t = 0; army = 10 + rnd(5); shown = army; cx = 0; pops = []; fightFrom = 0; level++;
      const g1 = [{ op: "+", v: 8 + rnd(7) }, { op: "−", v: 4 + rnd(5) }], g2 = [{ op: "−", v: 5 + rnd(5) }, { op: "×", v: 2 }];
      gates = [{ at: 250, opts: Math.random() < 0.5 ? g1 : g1.reverse() }, { at: 2650, opts: Math.random() < 0.5 ? g2 : g2.reverse() }];
      gates.forEach((g) => { g.pick = g.opts[0].op === "−" ? 1 : 0; g.done = false; });
      boss = { hp: 1, dead: 0 };
      lvEl.textContent = level; arEl.textContent = army;
    }
    setup();
    let W, H, hy, by;
    const sc = (dd) => 1 / (1 + dd * 5);
    const Y = (dd) => hy + (by - hy) * sc(dd);
    const X = (wx, dd) => W / 2 + wx * W * 0.46 * sc(dd);
    const CD = 0.1; // crowd depth
    function update(dt) {
      t += dt;
      for (const g of gates) {
        const dd = 1.6 * (1 - (t - g.at) / GT);
        if (dd < 1.25 && dd > 0) cx += ((g.pick ? 0.5 : -0.5) - cx) * Math.min(1, dt / 260);
        if (!g.done && dd <= CD) {
          g.done = true; const o = g.opts[g.pick];
          army = o.op === "+" ? army + o.v : o.op === "×" ? army * o.v : Math.max(3, army - o.v);
          pops.push({ s: o.op + o.v, t0: t, good: o.op !== "−" });
        }
      }
      if (t > gates[1].at + GT) cx += (0 - cx) * Math.min(1, dt / 400);
      if (t >= ARRIVE && !fightFrom) fightFrom = army;
      if (fightFrom) {
        const p = clamp((t - ARRIVE) / FIGHT);
        boss.hp = 1 - p; army = Math.max(1, Math.round(fightFrom * (1 - 0.45 * p)));
        if (p >= 1 && !boss.dead) { boss.dead = t; pops.push({ s: tx("ZAFER!", "VICTORY!"), t0: t, good: true, big: true }); }
      }
      shown += (army - shown) * Math.min(1, dt / 160);
      arEl.textContent = Math.round(shown);
    }
    function soldier(px, py, s, i) {
      const b = Math.abs(Math.sin(t * 0.012 + i * 1.7)) * s * 0.22;
      c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(px, py, s * 0.55, s * 0.18, 0, 0, 7); c.fill();
      const g = c.createLinearGradient(0, py - s * 1.6, 0, py); g.addColorStop(0, "#4f8dff"); g.addColorStop(1, "#1f3f9e");
      c.fillStyle = g; rr(c, px - s * 0.42, py - s * 1.5 - b, s * 0.84, s * 1.15, s * 0.32); c.fill();
      c.fillStyle = "#b9c3d4"; c.beginPath(); c.arc(px + s * 0.4, py - s * 0.95 - b, s * 0.33, 0, 7); c.fill();
      c.fillStyle = "#e6ebf3"; c.beginPath(); c.arc(px, py - s * 1.62 - b, s * 0.4, Math.PI, 0); c.fill();
      c.fillStyle = "#f2c9a0"; c.fillRect(px - s * 0.28, py - s * 1.62 - b, s * 0.56, s * 0.16);
    }
    function gate(wx, dd, o, d) {
      const s = sc(dd), gx = X(wx, dd), gy = Y(dd), gw = W * 0.46 * s * 0.9, gh = gw * 1.15, good = o.op !== "−";
      c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(gx - gw / 2, gy - 2 * s, gw, 4 * s);
      const pg = c.createLinearGradient(0, gy - gh, 0, gy);
      if (good) { pg.addColorStop(0, "rgba(120,190,255,.9)"); pg.addColorStop(1, "rgba(40,90,230,.55)"); } else { pg.addColorStop(0, "rgba(255,140,110,.9)"); pg.addColorStop(1, "rgba(200,40,60,.55)"); }
      c.shadowColor = good ? "#4f8dff" : "#ff5a5a"; c.shadowBlur = 16 * d * s;
      c.fillStyle = pg; rr(c, gx - gw * 0.4, gy - gh * 0.92, gw * 0.8, gh * 0.92, [gw * 0.4, gw * 0.4, 0, 0]); c.fill(); c.shadowBlur = 0;
      c.fillStyle = "#8a8fa3"; c.fillRect(gx - gw / 2, gy - gh, gw * 0.12, gh); c.fillRect(gx + gw / 2 - gw * 0.12, gy - gh, gw * 0.12, gh);
      c.fillStyle = "#a3a9bc"; rr(c, gx - gw / 2 - gw * 0.03, gy - gh - gw * 0.1, gw * 1.06, gw * 0.14, gw * 0.04); c.fill();
      c.fillStyle = "#fff"; c.font = `800 ${Math.max(6, gw * 0.3)}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.shadowColor = "rgba(0,0,0,.5)"; c.shadowBlur = 6 * d * s; c.fillText(o.op + o.v, gx, gy - gh * 0.5); c.shadowBlur = 0;
    }
    function giant(dd, d) {
      const s = sc(dd), gx = X(0, dd), gy = Y(dd), bh = H * 0.9 * s;
      let rot = 0, al = 1;
      if (boss.dead) { const p = clamp((t - boss.dead) / 600); rot = -p * 0.5; al = 1 - p; }
      if (al <= 0) return;
      c.save(); c.globalAlpha = al; c.translate(gx, gy); c.rotate(rot);
      const hit = fightFrom && !boss.dead ? Math.sin(t / 40) * bh * 0.012 : 0;
      c.translate(hit, 0);
      c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(0, 0, bh * 0.4, bh * 0.07, 0, 0, 7); c.fill();
      c.fillStyle = "#4a1d22"; c.fillRect(-bh * 0.2, -bh * 0.28, bh * 0.14, bh * 0.28); c.fillRect(bh * 0.06, -bh * 0.28, bh * 0.14, bh * 0.28);
      const g = c.createLinearGradient(0, -bh * 0.85, 0, -bh * 0.25); g.addColorStop(0, "#d2434b"); g.addColorStop(1, "#7d1f29");
      c.fillStyle = "#a8303a"; c.beginPath(); c.ellipse(-bh * 0.36, -bh * 0.55, bh * 0.1, bh * 0.2, 0.3, 0, 7); c.fill(); c.beginPath(); c.ellipse(bh * 0.36, -bh * 0.55, bh * 0.1, bh * 0.2, -0.3, 0, 7); c.fill();
      c.fillStyle = g; rr(c, -bh * 0.3, -bh * 0.85, bh * 0.6, bh * 0.6, bh * 0.2); c.fill();
      c.fillStyle = "#2b1a14"; c.fillRect(-bh * 0.3, -bh * 0.42, bh * 0.6, bh * 0.07);
      c.fillStyle = "#e8b64a"; c.fillRect(-bh * 0.05, -bh * 0.43, bh * 0.1, bh * 0.09);
      c.fillStyle = "#b9343e"; c.beginPath(); c.arc(0, -bh * 0.9, bh * 0.15, 0, 7); c.fill();
      c.fillStyle = "#f3ead8";
      [-1, 1].forEach((k) => { c.beginPath(); c.moveTo(k * bh * 0.1, -bh * 0.98); c.quadraticCurveTo(k * bh * 0.3, -bh * 1.02, k * bh * 0.26, -bh * 1.2); c.quadraticCurveTo(k * bh * 0.22, -bh * 1.06, k * bh * 0.04, -bh * 1.03); c.fill(); });
      c.fillStyle = "#ffd84a"; c.shadowColor = "#ffd84a"; c.shadowBlur = 8 * d * s;
      c.fillRect(-bh * 0.08, -bh * 0.93, bh * 0.05, bh * 0.025); c.fillRect(bh * 0.03, -bh * 0.93, bh * 0.05, bh * 0.025); c.shadowBlur = 0;
      if (!boss.dead) {
        const bw = bh * 0.6; c.fillStyle = "rgba(0,0,0,.45)"; rr(c, -bw / 2, -bh * 1.32, bw, bh * 0.05, bh * 0.025); c.fill();
        c.fillStyle = "#ff5a5a"; rr(c, -bw / 2, -bh * 1.32, bw * boss.hp, bh * 0.05, bh * 0.025); c.fill();
      }
      c.restore();
    }
    function draw() {
      const d = fit(cv); W = cv.width; H = cv.height; if (!W) return;
      hy = H * 0.36; by = H * 1.02;
      const sky = c.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, "#1a1240"); sky.addColorStop(0.55, "#6b3a7a"); sky.addColorStop(1, "#f39a58");
      c.fillStyle = sky; c.fillRect(0, 0, W, hy + 1);
      const sun = c.createRadialGradient(W * 0.72, hy - 10 * d, 0, W * 0.72, hy - 10 * d, 70 * d);
      sun.addColorStop(0, "rgba(255,226,160,.95)"); sun.addColorStop(0.25, "rgba(255,190,120,.6)"); sun.addColorStop(1, "rgba(255,150,90,0)");
      c.fillStyle = sun; c.fillRect(0, 0, W, hy);
      c.fillStyle = "#3b2350"; c.beginPath(); c.moveTo(0, hy);
      for (let x = 0; x <= W; x += W / 8) c.lineTo(x, hy - (14 + 12 * Math.sin(x / W * 9)) * d);
      c.lineTo(W, hy); c.fill();
      const gr = c.createLinearGradient(0, hy, 0, H); gr.addColorStop(0, "#2c3f2c"); gr.addColorStop(1, "#122016");
      c.fillStyle = gr; c.fillRect(0, hy, W, H - hy);
      // road
      c.beginPath(); c.moveTo(X(-1, 0), Y(0)); c.lineTo(X(-1, 40), Y(40)); c.lineTo(X(1, 40), Y(40)); c.lineTo(X(1, 0), Y(0)); c.closePath();
      const rg = c.createLinearGradient(0, hy, 0, H); rg.addColorStop(0, "#5f5a6a"); rg.addColorStop(1, "#8a8494");
      c.fillStyle = rg; c.fill();
      const run = fightFrom ? ARRIVE / 1000 : t / 1000, off = (run * 1.2) % 0.25;
      c.strokeStyle = "rgba(30,24,40,.35)"; c.lineWidth = 1 * d;
      for (let k = 0; k < 40; k++) { const dd = k * 0.25 - off; if (dd < 0) continue; c.beginPath(); c.moveTo(X(-1, dd), Y(dd)); c.lineTo(X(1, dd), Y(dd)); c.stroke(); }
      [-0.5, 0, 0.5].forEach((wx) => { c.beginPath(); c.moveTo(X(wx, 0), Y(0)); c.lineTo(X(wx, 40), Y(40)); c.stroke(); });
      c.strokeStyle = "rgba(230,220,200,.35)"; c.lineWidth = 2 * d;
      [-1, 1].forEach((wx) => { c.beginPath(); c.moveTo(X(wx, 0), Y(0)); c.lineTo(X(wx, 40), Y(40)); c.stroke(); });
      const fog = c.createLinearGradient(0, hy - 4 * d, 0, hy + 60 * d); fog.addColorStop(0, "rgba(243,154,88,.55)"); fog.addColorStop(1, "rgba(243,154,88,0)");
      c.fillStyle = fog; c.fillRect(0, hy - 4 * d, W, 64 * d);
      // gates & giant behind the crowd
      for (const g of gates) {
        const dd = 1.6 * (1 - (t - g.at) / GT);
        if (dd > 1.6 || dd < CD + 0.02) continue;
        gate(-0.5, dd, g.opts[0], d); gate(0.5, dd, g.opts[1], d);
      }
      if (t > BOSS_AT) giant(Math.max(CD + 0.32, 1.6 - (1.6 - CD - 0.32) * clamp((t - BOSS_AT) / (ARRIVE - BOSS_AT))), d);
      // crowd
      const n = Math.min(64, Math.round(shown)), pts = [];
      for (let i = 0; i < n; i++) { const r = 0.06 * Math.sqrt(i + 0.3), a = i * 2.39996; pts.push({ wx: cx + r * Math.cos(a) * 1.1, dd: CD + 0.04 + r * Math.sin(a) * 0.35, i }); }
      if (fightFrom && !boss.dead) pts.forEach((p) => (p.dd += 0.08 * clamp((t - ARRIVE) / 300)));
      pts.sort((a, b) => b.dd - a.dd).forEach((p) => soldier(X(p.wx, p.dd), Y(p.dd), 11 * d * sc(p.dd) * 1.6, p.i));
      // count badge
      const far = pts.reduce((m, q) => Math.max(m, q.dd), CD), bx = X(cx, CD), byy = Y(far) - 11 * d * sc(far) * 1.6 * 2.2 - 14 * d;
      c.fillStyle = "rgba(47,111,228,.92)"; rr(c, bx - 20 * d, byy - 11 * d, 40 * d, 22 * d, 11 * d); c.fill();
      c.fillStyle = "#fff"; c.font = `800 ${13 * d}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(Math.round(shown), bx, byy + 1 * d);
      // clash sparks
      if (fightFrom && !boss.dead) for (let k = 0; k < 6; k++) {
        const sx = X(cx + (Math.random() - 0.5) * 0.5, CD + 0.3), sy = Y(CD + 0.3) - Math.random() * 30 * d;
        c.fillStyle = Math.random() < 0.5 ? "#fff3c4" : "#ffb35c"; c.beginPath(); c.arc(sx, sy, (1 + Math.random() * 2) * d, 0, 7); c.fill();
      }
      // floating numbers
      pops = pops.filter((p) => {
        const q = (t - p.t0) / (p.big ? 1600 : 900); if (q >= 1) return false;
        c.globalAlpha = 1 - q * q; c.fillStyle = p.good ? (p.big ? "#ffe08a" : "#7dffb2") : "#ff8a8a";
        c.font = `800 ${(p.big ? 30 : 20) * d}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
        c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 8 * d;
        c.fillText(p.s, p.big ? W / 2 : bx, (p.big ? H * 0.42 : byy - 18 * d) - q * 30 * d); c.shadowBlur = 0; c.globalAlpha = 1;
        return true;
      });
    }
    return { enter: setup, update, draw };
  }

  /* ===== ExStudio: trim, voice, background removal ===== */
  function studioApp(root) {
    const pc = $(".st-prev canvas", root), p = pc.getContext("2d"), tl = $(".st-tl", root), q = tl.getContext("2d");
    const fxEl = $(".st-fx", root), tmEl = $(".st-time", root), tools = $$(".st-tool", root);
    const PH = 2833, CLIP = 12;
    const FX = [[tx("Kes · 00:03.4", "Trim · 00:03.4"), 0], [tx("Ses efekti: Robot", "Voice effect: Robot"), 1], [tx("Arka planı sil", "Remove background"), 3]];
    const wave = Array.from({ length: 90 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23) + 0.3 * Math.sin(i * 2.1)));
    let t = 0, ph = -1;
    function setPhase(k) { ph = k; fxEl.textContent = FX[k][0]; tools.forEach((el, i) => el.classList.toggle("on", i === FX[k][1])); fxEl.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 350 }); }
    function update(dt) { t += dt; const k = Math.min(2, (t / PH) | 0); if (k !== ph) setPhase(k); }
    function preview(now, d) {
      const W = pc.width, H = pc.height, k = ph, lt = t - k * PH;
      const sky = p.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#ff5fd2"); sky.addColorStop(0.5, "#8b3cf0"); sky.addColorStop(1, "#24164f");
      p.fillStyle = sky; p.fillRect(0, 0, W, H);
      const sy = H * 0.5 - (t / 8500) * H * 0.12;
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
      const W = tl.width, H = tl.height, L0 = 14 * d, R0 = W - 14 * d, span = R0 - L0, ph2 = clamp(t / 8500);
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
  const DUR = 8500;
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
