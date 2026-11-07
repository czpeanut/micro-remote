"use strict";
/*
 * engine.js — 酷丁狐遊戲工坊的小遊戲引擎（仿 MakeCode Arcade 的規則，160×120 畫面）
 *  角色（Sprite）：x、y 是中心點；vx、vy 速度（像素／秒）；ax、ay 加速度。
 *  貼圖地圖：每格 16×16，「牆」會擋住角色；地圖邊界也算牆。
 *  積木產生的程式只會呼叫 ArcEngine.api 裡的函式。
 */
window.ArcEngine = (function () {
  const W = 160, H = 120, T = 16;
  const PAL = ["#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52", "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000"];
  const AS = window.ARC_ASSETS;
  const KINDS = ["Player", "Projectile", "Food", "Enemy"];

  /* ---------- 圖片 ---------- */
  const cache = {};
  function img(key) {
    if (!key) return null;
    if (cache[key]) return cache[key];
    const a = AS.img[key]; if (!a) return null;
    const c = document.createElement("canvas"); c.width = a.w; c.height = a.h;
    const g = c.getContext("2d"), id = g.createImageData(a.w, a.h);
    let x0 = a.w, y0 = a.h, x1 = -1, y1 = -1;
    const mask = new Uint8Array(a.w * a.h);
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const v = parseInt(a.d[y * a.w + x], 16); if (!v) continue;
      const hx = PAL[v], o = (y * a.w + x) * 4;
      id.data[o] = parseInt(hx.slice(1, 3), 16); id.data[o + 1] = parseInt(hx.slice(3, 5), 16); id.data[o + 2] = parseInt(hx.slice(5, 7), 16); id.data[o + 3] = 255;
      mask[y * a.w + x] = 1;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    g.putImageData(id, 0, 0);
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = a.w - 1; y1 = a.h - 1; }
    return (cache[key] = { key, canvas: c, w: a.w, h: a.h, box: [x0, y0, x1 + 1, y1 + 1], mask });
  }
  function thumb(key, size) {   // 給積木下拉選單用的縮圖（data URL）
    const im = img(key); if (!im) return "";
    const s = size || 32, c = document.createElement("canvas"); c.width = s; c.height = s;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    const k = Math.min(s / im.w, s / im.h);
    g.drawImage(im.canvas, (s - im.w * k) / 2, (s - im.h * k) / 2, im.w * k, im.h * k);
    return c.toDataURL();
  }

  /* ---------- 音效（WebAudio 合成） ---------- */
  let ac = null;
  function tone(seq, type) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      for (const [f, d] of seq) {
        if (f) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = type || "square"; o.frequency.value = f; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + d / 1000);
          o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d / 1000);
        }
        t += d / 1000;
      }
    } catch (e) {}
  }
  const SOUNDS = {
    baDing: [[988, 90], [1319, 220]], powerUp: [[523, 70], [659, 70], [784, 70], [1047, 160]], powerDown: [[784, 90], [659, 90], [523, 90], [392, 200]],
    jumpUp: [[440, 50], [660, 50], [880, 80]], wawawa: [[392, 200], [370, 200], [349, 200], [330, 500]], magicWand: [[1568, 60], [2093, 60], [2637, 60], [3136, 140]],
    win: [[523, 120], [659, 120], [784, 120], [1047, 360]], lose: [[392, 180], [330, 180], [262, 400]], hit: [[200, 80], [140, 120]],
  };
  function sound(n) { if (SOUNDS[n]) tone(SOUNDS[n], n === "hit" ? "sawtooth" : "square"); }

  /* ---------- 世界 ---------- */
  let W0 = null;       // 目前的遊戲世界
  let view = null;     // { canvas, ctx, small, sctx, scale }
  let onStatus = () => {};
  const keys = { up: false, down: false, left: false, right: false, A: false, B: false };

  function newWorld() {
    return {
      t: 0, sprites: [], nextId: 1, bgColor: 0, bg: null, scroll: [0, 0], scrollOff: [0, 0], map: null, cam: { x: 0, y: 0, follow: null },
      score: null, life: null, countdown: null, h: { start: [], btn: [], interval: [], update: [], overlap: [], destroyed: [], cdEnd: [], lifeZero: [], tile: [], scoreReach: [] },
      movers: [], fx: [], over: null, loopBudget: 0, err: null,
    };
  }

  class Sprite {
    constructor(key, kind) {
      this.id = W0.nextId++; this.kind = kind || "Player"; this.setImg(key);
      this.x = W / 2 + W0.cam.x; this.y = H / 2 + W0.cam.y; this.vx = 0; this.vy = 0; this.ax = 0; this.ay = 0;
      this.stay = false; this.bounce = false; this.ghost = false; this.auto = false; this.dead = false; this.hit = {}; this.anim = null; this.sayT = null; this.z = 0;
    }
    setImg(key) { this.im = img(key) || img("monkey"); }
    get width() { return this.im.w; } get height() { return this.im.h; }
    get left() { return this.x - this.im.w / 2; } set left(v) { this.x = v + this.im.w / 2; }
    get right() { return this.x + this.im.w / 2; } set right(v) { this.x = v - this.im.w / 2; }
    get top() { return this.y - this.im.h / 2; } set top(v) { this.y = v + this.im.h / 2; }
    get bottom() { return this.y + this.im.h / 2; } set bottom(v) { this.y = v - this.im.h / 2; }
    box() { const b = this.im.box, l = this.left, t = this.top; return [l + b[0], t + b[1], l + b[2], t + b[3]]; }
  }

  /* ---------- 貼圖地圖 ---------- */
  function loadMap(key) {
    const m = AS.maps[key]; if (!m) return null;
    return { key, w: m.w, h: m.h, tiles: m.tiles.slice(), cells: m.cells.slice(), walls: m.walls.split("").map(Number) };
  }
  function tileAt(c, r) { const m = W0.map; if (!m || c < 0 || r < 0 || c >= m.w || r >= m.h) return null; return m.tiles[m.cells[r * m.w + c]] || ""; }
  function wallAt(c, r) { const m = W0.map; if (!m) return false; if (c < 0 || r < 0 || c >= m.w || r >= m.h) return true; return !!m.walls[r * m.w + c]; }
  function tileIndex(key) {
    const m = W0.map; let i = m.tiles.indexOf(key || "");
    if (i < 0) { m.tiles.push(key || ""); i = m.tiles.length - 1; }
    return i;
  }

  /* ---------- 物理 ---------- */
  function moveAxis(s, d, axis) {
    if (!d) return;
    const m = W0.map;
    if (!m || s.ghost) { if (axis === 0) s.x += d; else s.y += d; return; }
    const steps = Math.ceil(Math.abs(d) / 6), st = d / steps;
    for (let i = 0; i < steps; i++) {
      if (axis === 0) s.x += st; else s.y += st;
      const b = s.box(), e = 0.001;
      if (axis === 0) {
        const r0 = Math.floor(b[1] / T), r1 = Math.floor((b[3] - e) / T);
        const c = st > 0 ? Math.floor((b[2] - e) / T) : Math.floor(b[0] / T);
        let blocked = false; for (let r = r0; r <= r1; r++) if (wallAt(c, r)) { blocked = true; break; }
        if (blocked) {
          if (st > 0) s.x -= b[2] - c * T; else s.x += (c + 1) * T - b[0];
          s.hit[st > 0 ? "right" : "left"] = true;
          if (s.bounce) s.vx = -s.vx; else s.vx = 0;
          return;
        }
      } else {
        const c0 = Math.floor(b[0] / T), c1 = Math.floor((b[2] - e) / T);
        const r = st > 0 ? Math.floor((b[3] - e) / T) : Math.floor(b[1] / T);
        let blocked = false; for (let c = c0; c <= c1; c++) if (wallAt(c, r)) { blocked = true; break; }
        if (blocked) {
          if (st > 0) s.y -= b[3] - r * T; else s.y += (r + 1) * T - b[1];
          s.hit[st > 0 ? "bottom" : "top"] = true;
          if (s.bounce) s.vy = -s.vy; else s.vy = 0;
          return;
        }
      }
    }
  }
  function screenEdges(s) {
    const cx = W0.cam.x, cy = W0.cam.y, b = s.box();
    if (b[0] < cx) { s.x += cx - b[0]; s.vx = s.bounce ? Math.abs(s.vx) : Math.max(0, s.vx); s.hit.left = true; }
    else if (b[2] > cx + W) { s.x -= b[2] - cx - W; s.vx = s.bounce ? -Math.abs(s.vx) : Math.min(0, s.vx); s.hit.right = true; }
    if (b[1] < cy) { s.y += cy - b[1]; s.vy = s.bounce ? Math.abs(s.vy) : Math.max(0, s.vy); s.hit.top = true; }
    else if (b[3] > cy + H) { s.y -= b[3] - cy - H; s.vy = s.bounce ? -Math.abs(s.vy) : Math.min(0, s.vy); s.hit.bottom = true; }
  }
  const MAXV = 500;
  const clampV = (v) => Math.max(-MAXV, Math.min(MAXV, v));
  function physics(dt) {
    for (const mv of W0.movers) {
      const s = mv.s; if (s.dead) continue;
      const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (mv.vx) s.vx = dx * mv.vx;
      if (mv.vy) s.vy = dy * mv.vy;
    }
    for (const s of W0.sprites) {
      if (s.dead) continue;
      s.hit = {};
      s.vx = clampV(s.vx + s.ax * dt); s.vy = clampV(s.vy + s.ay * dt);
      moveAxis(s, s.vx * dt, 0); moveAxis(s, s.vy * dt, 1);
      if (s.stay || (s.bounce && !W0.map)) screenEdges(s);
      if (s.anim) {
        const a = s.anim; a.t += dt * 1000;
        if (a.t >= a.ms) { a.t -= a.ms; a.i++; if (a.i >= a.f.length) { if (a.loop) a.i = 0; else { a.i = a.f.length - 1; s.anim = null; } } s.setImg(a.f[a.i]); }
      }
      if (s.auto) {
        const cx = W0.cam.x, cy = W0.cam.y;
        if (s.right < cx - 1 || s.left > cx + W + 1 || s.bottom < cy - 1 || s.top > cy + H + 1) destroy(s);
      }
    }
  }
  function overlapBox(a, b) {
    const p = a.box(), q = b.box();
    if (p[0] >= q[2] || q[0] >= p[2] || p[1] >= q[3] || q[1] >= p[3]) return false;
    // 像素檢查
    const x0 = Math.floor(Math.max(p[0], q[0])), x1 = Math.ceil(Math.min(p[2], q[2])), y0 = Math.floor(Math.max(p[1], q[1])), y1 = Math.ceil(Math.min(p[3], q[3]));
    const al = Math.floor(a.left), at = Math.floor(a.top), bl = Math.floor(b.left), bt = Math.floor(b.top);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const ax = x - al, ay = y - at, bx = x - bl, by = y - bt;
      if (ax >= 0 && ay >= 0 && ax < a.im.w && ay < a.im.h && bx >= 0 && by >= 0 && bx < b.im.w && by < b.im.h && a.im.mask[ay * a.im.w + ax] && b.im.mask[by * b.im.w + bx]) return true;
    }
    return false;
  }
  function events() {
    const H_ = W0.h;
    for (const o of H_.overlap) {
      const A = W0.sprites.filter((s) => s.kind === o.a && !s.dead), B = W0.sprites.filter((s) => s.kind === o.b && !s.dead);
      for (const s of A) for (const t of B) {
        if (W0.over) return;
        if (s === t || s.dead || t.dead) continue;
        if (overlapBox(s, t)) call(o.fn, s, t);
      }
    }
    if (W0.map) for (const o of H_.tile) {
      for (const s of W0.sprites) {
        if (W0.over) return;
        if (s.dead || s.kind !== o.kind) continue;
        const b = s.box(), x = s.x, y = s.y;
        const c0 = Math.floor((b[0] + 1) / T), c1 = Math.floor((b[2] - 1) / T), r0 = Math.floor((b[1] + 1) / T), r1 = Math.floor((b[3] - 1) / T);
        outer: for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (tileAt(c, r) === o.tile) { call(o.fn, s, { c, r }); if (s.dead || s.x !== x || s.y !== y || W0.over) break outer; }
        }
      }
    }
  }

  /* ---------- 執行積木產生的程式 ---------- */
  function call(fn, ...args) {
    if (W0.over || W0.err) return;
    W0.loopBudget = 200000;
    try { fn(...args); } catch (e) { fail(e); }
  }
  function fail(e) {
    if (W0.err) return;
    W0.err = e; console.error(e);
    const msg = e === "loop" ? "迴圈跑太多次停不下來了，檢查一下迴圈的條件。" : "程式出錯了：" + (e && e.message ? e.message : e);
    onStatus({ type: "error", msg });
  }
  function destroy(s, effect) {
    if (!s || s.dead) return;
    s.dead = true;
    if (effect) W0.fx.push({ im: s.im, x: s.left, y: s.top, t: 0, ms: 300, kind: effect });
    for (const o of W0.h.destroyed) if (o.kind === s.kind) call(o.fn, s);
  }
  function gameOver(win) {
    if (W0.over) return;
    W0.over = { win: !!win, t: 0 };
    sound(win ? "win" : "lose");
    onStatus({ type: "over", win: !!win, score: W0.score });
  }

  const S = (s) => (s instanceof Sprite && !s.dead ? s : null);
  const N = (v) => { v = Number(v); return Number.isFinite(v) ? v : 0; };
  const PROPS = { x: 1, y: 1, vx: 1, vy: 1, ax: 1, ay: 1, left: 1, right: 1, top: 1, bottom: 1, width: 0, height: 0 };

  const api = {
    // 事件
    onStart: (fn) => W0.h.start.push(fn),
    onButton: (btn, ev, fn) => W0.h.btn.push({ btn, ev, fn }),
    onInterval: (ms, fn) => W0.h.interval.push({ ms: Math.max(20, N(ms)), next: Math.max(20, N(ms)), fn }),
    onUpdate: (fn) => W0.h.update.push(fn),
    onOverlap: (a, b, fn) => W0.h.overlap.push({ a, b, fn }),
    onDestroyed: (kind, fn) => W0.h.destroyed.push({ kind, fn }),
    onCountdownEnd: (fn) => W0.h.cdEnd.push(fn),
    onLifeZero: (fn) => W0.h.lifeZero.push(fn),
    onOverlapTile: (kind, tile, fn) => W0.h.tile.push({ kind, tile, fn }),
    // 角色
    create: (key, kind) => { const s = new Sprite(key, kind); W0.sprites.push(s); return s; },
    projectileFromSide: (key, vx, vy) => {
      const s = new Sprite(key, "Projectile"); vx = N(vx); vy = N(vy); s.vx = vx; s.vy = vy; s.auto = true;
      const cx = W0.cam.x, cy = W0.cam.y;
      if (vx < 0) s.x = cx + W + s.width / 2 - 1; else if (vx > 0) s.x = cx - s.width / 2 + 1;
      if (vy < 0) s.y = cy + H + s.height / 2 - 1; else if (vy > 0) s.y = cy - s.height / 2 + 1;
      W0.sprites.push(s); return s;
    },
    setImage: (s, key) => { if ((s = S(s))) { s.anim = null; s.setImg(key); } },
    setPos: (s, x, y) => { if ((s = S(s))) { s.x = N(x); s.y = N(y); } },
    setProp: (s, p, v) => { if ((s = S(s)) && PROPS[p]) s[p] = N(v); },
    changeProp: (s, p, v) => { if ((s = S(s)) && PROPS[p]) s[p] = s[p] + N(v); },
    getProp: (s, p) => { s = s instanceof Sprite ? s : null; return s && p in PROPS ? s[p] : 0; },
    setVel: (s, vx, vy) => { if ((s = S(s))) { s.vx = N(vx); s.vy = N(vy); } },
    setFlag: (s, f, on) => { if ((s = S(s))) { if (f === "stay") s.stay = !!on; else if (f === "bounce") s.bounce = !!on; else if (f === "ghost") s.ghost = !!on; else if (f === "auto") s.auto = !!on; } },
    setKind: (s, k) => { if ((s = S(s))) s.kind = k; },
    kindOf: (s) => (s instanceof Sprite ? s.kind : ""),
    destroy: (s, effect) => destroy(S(s), effect),
    say: (s, text, ms) => { if ((s = S(s))) s.sayT = { text: String(text), until: ms ? W0.t + N(ms) : Infinity }; },
    animate: (s, animKey, ms, loop) => {
      if (!(s = S(s))) return;
      const a = AS.anim[animKey]; if (!a || !a.f.length) return;
      s.anim = { f: a.f, ms: Math.max(20, N(ms) || 100), loop: !!loop, i: 0, t: 0 }; s.setImg(a.f[0]);
    },
    stopAnim: (s) => { if ((s = S(s))) s.anim = null; },
    // 場景
    bgImage: (key) => { W0.bg = img(key); },
    bgColor: (c) => { W0.bgColor = N(c); },
    scroll: (vx, vy) => { W0.scroll = [N(vx), N(vy)]; },
    tilemap: (key) => { W0.map = loadMap(key); },
    camera: (s) => { W0.cam.follow = S(s); },
    shake: () => { W0.shake = 300; },
    loc: (c, r) => ({ c: Math.round(N(c)), r: Math.round(N(r)) }),
    place: (s, loc) => { if ((s = S(s)) && loc) { s.x = loc.c * T + T / 2; s.y = loc.r * T + T / 2; } },
    setTile: (loc, key) => { if (W0.map && loc) { const m = W0.map; if (loc.c >= 0 && loc.r >= 0 && loc.c < m.w && loc.r < m.h) m.cells[loc.r * m.w + loc.c] = tileIndex(key); } },
    setWall: (loc, on) => { if (W0.map && loc) { const m = W0.map; if (loc.c >= 0 && loc.r >= 0 && loc.c < m.w && loc.r < m.h) m.walls[loc.r * m.w + loc.c] = on ? 1 : 0; } },
    tileIs: (loc, key) => !!(loc && tileAt(loc.c, loc.r) === key),
    tilesOf: (key) => {
      const out = [], m = W0.map; if (!m) return out;
      for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) if (tileAt(c, r) === key) out.push({ c, r });
      return out;
    },
    hitting: (s, dir) => !!(S(s) && s.hit[dir]),
    randomLoc: () => { const m = W0.map; if (!m) return { c: 0, r: 0 }; return { c: Math.floor(Math.random() * m.w), r: Math.floor(Math.random() * m.h) }; },
    // 控制器
    move: (s, vx, vy) => { if (!(s = S(s))) return; W0.movers = W0.movers.filter((m) => m.s !== s); W0.movers.push({ s, vx: N(vx), vy: N(vy) }); },
    pressed: (b) => !!keys[b],
    // 資訊
    setScore: (v) => { W0.score = N(v); checkScore(); },
    changeScore: (v) => { W0.score = (W0.score || 0) + N(v); checkScore(); },
    score: () => W0.score || 0,
    setLife: (v) => { W0.life = N(v); checkLife(); },
    changeLife: (v) => { W0.life = (W0.life == null ? 3 : W0.life) + N(v); checkLife(); },
    life: () => W0.life || 0,
    countdown: (sec) => { W0.countdown = { left: Math.max(0, N(sec)) * 1000, done: false }; },
    changeCountdown: (sec) => { if (W0.countdown) W0.countdown.left = Math.max(0, W0.countdown.left + N(sec) * 1000); },
    timeLeft: () => (W0.countdown ? Math.ceil(W0.countdown.left / 1000) : 0),
    // 遊戲
    gameOver: (win) => gameOver(win),
    sound: (n) => sound(n),
    randint: (a, b) => { a = Math.round(N(a)); b = Math.round(N(b)); if (a > b) [a, b] = [b, a]; return a + Math.floor(Math.random() * (b - a + 1)); },
    loop: () => { if (--W0.loopBudget < 0) throw "loop"; },
    time: () => W0.t,
  };
  function checkScore() {}
  function checkLife() {
    if (W0.life != null && W0.life <= 0 && !W0.lifeZeroFired) {
      W0.lifeZeroFired = true;
      if (W0.h.lifeZero.length) W0.h.lifeZero.forEach((fn) => call(fn)); else gameOver(false);
    } else if (W0.life > 0) W0.lifeZeroFired = false;
  }

  /* ---------- 畫面 ---------- */
  function draw() {
    const g = view.sctx, w = W0;
    // 鏡頭
    const f = w.cam.follow;
    if (f && !f.dead) {
      w.cam.x = f.x - W / 2; w.cam.y = f.y - H / 2;
      if (w.map) { w.cam.x = Math.max(0, Math.min(w.map.w * T - W, w.cam.x)); w.cam.y = Math.max(0, Math.min(w.map.h * T - H, w.cam.y)); }
    }
    let cx = Math.round(w.cam.x), cy = Math.round(w.cam.y);
    if (w.shake > 0) { cx += Math.round(Math.random() * 4 - 2); cy += Math.round(Math.random() * 4 - 2); }
    g.fillStyle = PAL[w.bgColor] || "#000"; g.fillRect(0, 0, W, H);
    if (w.bg) {
      const bw = w.bg.w, bh = w.bg.h;
      const ox = ((Math.round(w.scrollOff[0]) % bw) + bw) % bw, oy = ((Math.round(w.scrollOff[1]) % bh) + bh) % bh;
      for (let y = oy - bh; y < H; y += bh) for (let x = ox - bw; x < W; x += bw) g.drawImage(w.bg.canvas, x, y);
    }
    if (w.map) {
      const m = w.map;
      const c0 = Math.max(0, Math.floor(cx / T)), c1 = Math.min(m.w - 1, Math.floor((cx + W) / T)), r0 = Math.max(0, Math.floor(cy / T)), r1 = Math.min(m.h - 1, Math.floor((cy + H) / T));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const k = m.tiles[m.cells[r * m.w + c]]; if (!k) continue;
        const im = img(k); if (im) g.drawImage(im.canvas, c * T - cx, r * T - cy);
      }
    }
    for (const s of w.sprites) if (!s.dead) g.drawImage(s.im.canvas, Math.floor(s.left) - cx, Math.floor(s.top) - cy);
    for (const e of w.fx) {
      g.globalAlpha = Math.max(0, 1 - e.t / e.ms);
      const k = e.t / e.ms * 6;
      g.drawImage(e.im.canvas, Math.floor(e.x - cx + (Math.random() - 0.5) * k), Math.floor(e.y - cy - k * 2));
      g.globalAlpha = 1;
    }
    // 放大到大畫布，再畫文字
    const c = view.ctx, k = view.scale;
    c.imageSmoothingEnabled = false; c.drawImage(view.small, 0, 0, W * k, H * k);
    c.textBaseline = "middle"; c.font = `900 ${7 * k}px system-ui, sans-serif`;
    for (const s of w.sprites) {
      if (s.dead || !s.sayT || w.t > s.sayT.until) continue;
      const tw = c.measureText(s.sayT.text).width + 4 * k, x = Math.max(2, Math.min(W * k - tw - 2, (s.x - cx) * k - tw / 2)), y = (s.top - cy) * k - 12 * k;
      c.fillStyle = "#fff"; c.strokeStyle = "#000"; c.lineWidth = k / 2; c.beginPath(); c.roundRect(x, y, tw, 10 * k, 2 * k); c.fill(); c.stroke();
      c.fillStyle = "#000"; c.textAlign = "left"; c.fillText(s.sayT.text, x + 2 * k, y + 5 * k);
    }
    const pill = (x, y, text, bg, fg, align) => {
      c.font = `900 ${7 * k}px system-ui, sans-serif`;
      const tw = c.measureText(text).width + 6 * k, bx = align === "r" ? x - tw : align === "c" ? x - tw / 2 : x;
      c.fillStyle = bg; c.strokeStyle = "#000"; c.lineWidth = k / 2; c.beginPath(); c.roundRect(bx, y, tw, 11 * k, 2 * k); c.fill(); c.stroke();
      c.fillStyle = fg; c.textAlign = "left"; c.fillText(text, bx + 3 * k, y + 5.7 * k);
    };
    if (w.score != null) pill(W * k - 2 * k, 2 * k, String(w.score), "#fff", "#000", "r");
    if (w.countdown) pill(W * k / 2, 2 * k, String(Math.ceil(w.countdown.left / 1000)), "#fff", "#000", "c");
    if (w.life != null) {
      const hi = img("heart"); const n = Math.max(0, Math.min(10, w.life));
      if (hi && n <= 5) for (let i = 0; i < n; i++) c.drawImage(hi.canvas, (2 + i * 9) * k, 2 * k, 8 * k, 8 * k);
      else pill(2 * k, 2 * k, "♥ " + w.life, "#ff2121", "#fff", "l");
    }
    if (w.over) {
      c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(0, 0, W * k, H * k);
      c.textAlign = "center"; c.font = `900 ${15 * k}px system-ui, sans-serif`; c.fillStyle = w.over.win ? "#fff609" : "#ff93c4";
      c.strokeStyle = "#000"; c.lineWidth = 2 * k; c.strokeText(w.over.win ? "你贏了！" : "遊戲結束", W * k / 2, H * k / 2 - 6 * k); c.fillText(w.over.win ? "你贏了！" : "遊戲結束", W * k / 2, H * k / 2 - 6 * k);
      if (w.score != null) { c.font = `900 ${8 * k}px system-ui, sans-serif`; c.fillStyle = "#fff"; c.fillText("得分 " + w.score, W * k / 2, H * k / 2 + 10 * k); }
      c.font = `700 ${5.5 * k}px system-ui, sans-serif`; c.fillStyle = "#cfe3f5"; c.fillText("按「執行」再玩一次", W * k / 2, H * k / 2 + 22 * k);
    }
  }

  /* ---------- 主迴圈 ---------- */
  let raf = 0, last = 0, acc = 0;
  const DT = 1 / 60;
  function stepGame() {
    const w = W0; if (w.over || w.err) return;
    w.t += DT * 1000;
    if (w.shake > 0) w.shake -= DT * 1000;
    w.scrollOff[0] += w.scroll[0] * DT; w.scrollOff[1] += w.scroll[1] * DT;
    physics(DT);
    events();
    if (w.over || w.err) return;
    for (const fn of w.h.update) call(fn);
    for (const o of w.h.interval) { if (w.t >= o.next) { o.next += o.ms; call(o.fn); } }
    if (w.countdown && !w.countdown.done) {
      w.countdown.left -= DT * 1000;
      if (w.countdown.left <= 0) {
        w.countdown.left = 0; w.countdown.done = true;
        if (w.h.cdEnd.length) w.h.cdEnd.forEach((fn) => call(fn)); else gameOver(false);
      }
    }
    for (const e of w.fx) e.t += DT * 1000;
    w.fx = w.fx.filter((e) => e.t < e.ms);
    if (w.sprites.length > 400 || w.sprites.some((s) => s.dead)) w.sprites = w.sprites.filter((s) => !s.dead).slice(-400);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!W0) return;
    if (!last) last = now;
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused && !manual) while (acc >= DT) { stepGame(); acc -= DT; }
    else acc = 0;
    draw();
  }
  let paused = false, manual = false;

  /* ---------- 按鍵 ---------- */
  const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "A", KeyZ: "A", KeyX: "B", Enter: "B" };
  function press(b, down) {
    if (!b || keys[b] === down) return;
    keys[b] = down;
    if (!W0 || W0.over || W0.err || paused) return;
    for (const o of W0.h.btn) if (o.btn === b && o.ev === (down ? "pressed" : "released")) call(o.fn);
  }
  let keysOn = false;
  function keyHandler(e) {
    if (!W0 || !keysOn) return;
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const b = KEYMAP[e.code] || (e.key === " " ? "A" : null); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    press(b, e.type === "keydown");
  }
  window.addEventListener("keydown", keyHandler, true);
  window.addEventListener("keyup", keyHandler, true);
  window.addEventListener("blur", () => Object.keys(keys).forEach((k) => press(k, false)));

  /* ---------- 對外 ---------- */
  function attach(canvas, scale) {
    const small = document.createElement("canvas"); small.width = W; small.height = H;
    canvas.width = W * scale; canvas.height = H * scale;
    view = { canvas, ctx: canvas.getContext("2d"), small, sctx: small.getContext("2d"), scale };
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function run(code) {
    W0 = newWorld(); paused = false; last = 0; acc = 0;
    Object.keys(keys).forEach((k) => (keys[k] = false));
    let fn;
    try { fn = new Function("api", code); } catch (e) { fail(e); return false; }
    W0.loopBudget = 200000;
    try { fn(api); } catch (e) { fail(e); return false; }
    for (const s of W0.h.start) call(s);
    keysOn = true;
    onStatus({ type: "run" });
    return !W0.err;
  }
  function stop() { W0 = null; keysOn = false; if (view) { view.ctx.fillStyle = "#0b1a26"; view.ctx.fillRect(0, 0, view.canvas.width, view.canvas.height); } }
  return {
    W, H, PAL, KINDS, img, thumb, attach, run, stop, press, sound,
    setStatus: (f) => (onStatus = f), pause: (p) => (paused = p), isPaused: () => paused, world: () => W0, keys,
    manual: (m) => (manual = m),
    stepFrames: (n) => { for (let i = 0; i < n; i++) stepGame(); draw(); },   // 測試用
  };
})();
