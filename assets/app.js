/* Exclusive LLM — site interactions */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- language ---------- */
  const setLang = (l) => {
    document.body.dataset.lang = l;
    document.documentElement.lang = l;
    $$(".lang button").forEach((b) => b.classList.toggle("on", b.dataset.set === l));
    try { localStorage.setItem("lang", l); } catch (e) {}
    restartRotator();
  };
  let saved = null;
  try { saved = localStorage.getItem("lang"); } catch (e) {}
  const initial = saved || ((navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en");
  $$(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.set)));

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
  $("#yr").textContent = new Date().getFullYear();

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
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      phone.style.transform = `rotateY(${-14 + x * 22}deg) rotateX(${6 - y * 16}deg)`;
    });
    stage.addEventListener("pointerleave", () => { phone.style.transform = ""; });
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

  /* ---------- self-playing block puzzle ---------- */
  const board = $("#board"), bctx = board.getContext("2d");
  const N = 8;
  const COLORS = [["#4f8dff", "#2f5fe0"], ["#38d6ff", "#1aa3d1"], ["#8b5cf6", "#6d3fe0"], ["#f472b6", "#d9468f"], ["#fbbf24", "#e0950b"], ["#34d399", "#13a874"]];
  const SHAPES = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  ];
  let grid, tray, score = 0, best = 0, anims = [], clearing = null, size;
  const scoreEl = $("#score"), bestEl = $("#best"), comboEl = $(".combo");
  const trayCanvases = $$(".tray canvas");
  const newPiece = () => ({ cells: SHAPES[(Math.random() * SHAPES.length) | 0], col: (Math.random() * COLORS.length) | 0 });
  function reset() {
    grid = Array.from({ length: N }, () => Array(N).fill(-1));
    tray = [newPiece(), newPiece(), newPiece()];
    score = 0; drawTray();
  }
  function fits(cells, x, y) {
    return cells.every(([dx, dy]) => { const cx = x + dx, cy = y + dy; return cx < N && cy < N && grid[cy][cx] < 0; });
  }
  function bestSpot(piece) {
    let best = null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!fits(piece.cells, x, y)) continue;
      piece.cells.forEach(([dx, dy]) => (grid[y + dy][x + dx] = 9));
      let lines = 0, near = 0;
      for (let i = 0; i < N; i++) { if (grid[i].every((v) => v >= 0)) lines++; if (grid.every((r) => r[i] >= 0)) lines++; }
      piece.cells.forEach(([dx, dy]) => {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ax, ay]) => {
          const nx = x + dx + ax, ny = y + dy + ay;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || grid[ny][nx] >= 0) near++;
        });
      });
      piece.cells.forEach(([dx, dy]) => (grid[y + dy][x + dx] = -1));
      const s = lines * 100 + near + Math.random() * 2;
      if (!best || s > best.s) best = { x, y, s };
    }
    return best;
  }
  function step() {
    if (clearing) return;
    const piece = tray.shift(); tray.push(newPiece()); drawTray();
    const spot = bestSpot(piece);
    if (!spot) { wipe(); return; }
    const t = performance.now();
    piece.cells.forEach(([dx, dy], k) => {
      grid[spot.y + dy][spot.x + dx] = piece.col;
      anims.push({ x: spot.x + dx, y: spot.y + dy, t0: t + k * 35 });
    });
    score += piece.cells.length; updateHud();
    setTimeout(checkLines, 320);
  }
  function checkLines() {
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) { if (grid[i].every((v) => v >= 0)) rows.push(i); if (grid.every((r) => r[i] >= 0)) cols.push(i); }
    const n = rows.length + cols.length;
    if (!n) return;
    const cells = new Set();
    rows.forEach((r) => { for (let x = 0; x < N; x++) cells.add(r * N + x); });
    cols.forEach((c) => { for (let y = 0; y < N; y++) cells.add(y * N + c); });
    clearing = { cells: [...cells], t0: performance.now() };
    score += n * 10 * n; updateHud();
    comboEl.textContent = n > 1 ? `COMBO ×${n}` : "+" + n * 10;
    comboEl.classList.remove("show"); void comboEl.offsetWidth; comboEl.classList.add("show");
    setTimeout(() => { clearing.cells.forEach((k) => (grid[(k / N) | 0][k % N] = -1)); clearing = null; }, 520);
  }
  function wipe() {
    clearing = { cells: [...Array(N * N).keys()].filter((k) => grid[(k / N) | 0][k % N] >= 0), t0: performance.now() };
    setTimeout(() => { reset(); clearing = null; }, 600);
  }
  function updateHud() {
    best = Math.max(best, score);
    scoreEl.textContent = score; bestEl.textContent = best;
  }
  function tile(c, x, y, s, col, alpha = 1, scale = 1) {
    const [a, b] = COLORS[col];
    const pad = s * 0.06, w = (s - pad * 2) * scale, ox = x + (s - w) / 2, oy = y + (s - w) / 2, r = w * 0.22;
    c.globalAlpha = alpha;
    const g = c.createLinearGradient(ox, oy, ox + w, oy + w);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g;
    c.beginPath(); c.roundRect(ox, oy, w, w, r); c.fill();
    c.fillStyle = "rgba(255,255,255,.28)";
    c.beginPath(); c.roundRect(ox + w * 0.12, oy + w * 0.1, w * 0.76, w * 0.22, r * 0.6); c.fill();
    c.globalAlpha = 1;
  }
  function drawBoard(now) {
    const dpr = Math.min(devicePixelRatio || 1, 2), cssW = board.clientWidth;
    if (board.width !== Math.round(cssW * dpr)) { board.width = board.height = Math.round(cssW * dpr); }
    size = board.width / N;
    bctx.clearRect(0, 0, board.width, board.width);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      bctx.fillStyle = "rgba(255,255,255,.06)";
      bctx.beginPath(); bctx.roundRect(x * size + size * 0.06, y * size + size * 0.06, size * 0.88, size * 0.88, size * 0.2); bctx.fill();
    }
    const clearSet = clearing ? new Set(clearing.cells) : null;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = grid[y][x]; if (v < 0) continue;
      let scale = 1, alpha = 1;
      const an = anims.find((a) => a.x === x && a.y === y);
      if (an) { const p = Math.min(1, Math.max(0, (now - an.t0) / 260)); scale = 0.4 + 0.6 * (1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)); alpha = p; }
      if (clearSet && clearSet.has(y * N + x)) {
        const p = Math.min(1, (now - clearing.t0) / 500);
        scale = 1 + p * 0.35; alpha = 1 - p;
        bctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - p)})`;
        bctx.beginPath(); bctx.roundRect(x * size, y * size, size, size, size * 0.2); bctx.fill();
      }
      tile(bctx, x * size, y * size, size, v, alpha, scale);
    }
    anims = anims.filter((a) => now - a.t0 < 300);
  }
  function drawTray() {
    trayCanvases.forEach((c, i) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = c.height = 70 * dpr;
      const t = c.getContext("2d"), p = tray[i]; t.clearRect(0, 0, c.width, c.height);
      const w = Math.max(...p.cells.map((q) => q[0])) + 1, h = Math.max(...p.cells.map((q) => q[1])) + 1;
      const s = Math.min(c.width / 4, c.width / Math.max(w, h));
      const ox = (c.width - w * s) / 2, oy = (c.height - h * s) / 2;
      p.cells.forEach(([dx, dy]) => tile(t, ox + dx * s, oy + dy * s, s, p.col, i === 0 ? 1 : 0.65));
    });
  }
  function loop(now) { drawBoard(now); requestAnimationFrame(loop); }
  reset();
  // pre-fill a little so it looks alive on first paint
  for (let k = 0; k < 6; k++) { const p = tray.shift(); tray.push(newPiece()); const s = bestSpot(p); if (s) p.cells.forEach(([dx, dy]) => (grid[s.y + dy][s.x + dx] = p.col)); }
  drawTray(); updateHud();
  requestAnimationFrame(loop);
  if (!reduce) setInterval(() => { if (!document.hidden) step(); }, 950);
})();
