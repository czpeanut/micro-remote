"use strict";
/*
 * 潛艇駕駛艙 — 第五堂「潛艇出航」的電腦端（第一人稱）
 *  電腦 → micro:bit：f#　b#　l#　r#（和手機遙控相同）
 *  電腦用同樣的規則算出潛艇位置：起點 (2,2)，邊界 0～4，碰到水雷回到 (0,0)
 */
const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const START = [2, 2], HOME = [0, 0], N = 5, MW = N + 2;
const FACE_ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // 北 東 南 西
const CMD = { f: [0, -1, 0], r: [1, 0, 1], b: [0, 1, 2], l: [-1, 0, 3] };

/* ---------------- 材質（像素畫） ---------------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function makeTex(w, h, draw, emissive) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false; draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data, em = new Uint8Array(w * h);
  if (emissive) for (let i = 0; i < w * h; i++) em[i] = emissive(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]) ? 1 : 0;
  return { w, h, d, em };
}
function px(g, x, y, col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
function stoneBase(g, s, seed) {
  const r = rng(seed);
  g.fillStyle = "#123447"; g.fillRect(0, 0, s, s);
  const cols = ["#2f6378", "#376f86", "#2b5a6e", "#3e7b92", "#326a7f"];
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 8 : 0;
    for (let k = -1; k < 3; k++) {
      const x = k * 16 + off, y = row * 8;
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x + 1, y + 1, 14, 6);
      g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x + 1, y + 1, 14, 1); g.fillRect(x + 1, y + 1, 1, 6);
      g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + 1, y + 6, 14, 1); g.fillRect(x + 14, y + 1, 1, 6);
    }
  }
  for (let i = 0; i < 40; i++) px(g, Math.floor(r() * s), Math.floor(r() * s), r() < 0.5 ? "rgba(0,0,0,.25)" : "rgba(180,230,255,.15)");
  return r;
}
const TEX = {};
function buildTextures() {
  TEX.walls = [
    makeTex(32, 32, (g, s) => { const r = stoneBase(g, s, 11); for (let i = 0; i < 70; i++) { const x = Math.floor(r() * s), y = 22 + Math.floor(r() * 10); px(g, x, y, r() < 0.5 ? "#2f8f5a" : "#45b06c"); } }),
    makeTex(32, 32, (g, s) => {
      const r = stoneBase(g, s, 23);
      for (let i = 0; i < 4; i++) { const x = 4 + Math.floor(r() * 24), y = 14 + Math.floor(r() * 14), c = r() < 0.5 ? "#ff7b9c" : "#ffa65c";
        g.fillStyle = c; g.fillRect(x, y - 6, 2, 8); g.fillRect(x - 3, y - 4, 2, 5); g.fillRect(x + 3, y - 5, 2, 5); g.fillRect(x - 3, y - 4, 8, 2); }
    }),
    makeTex(32, 32, (g, s) => {
      const r = stoneBase(g, s, 37);
      for (let k = 0; k < 3; k++) { const bx = 5 + k * 10 + Math.floor(r() * 4); for (let y = 31; y > 4 + r() * 8; y--) { const x = bx + Math.round(Math.sin(y / 3 + k) * 1.5); px(g, x, y, "#2c9a5c"); px(g, x + 1, y, "#4cc27c"); } }
    }),
    makeTex(32, 32, (g, s) => {
      const r = stoneBase(g, s, 51);
      const cr = (x, y, h) => { g.fillStyle = "#7ff3ff"; g.fillRect(x, y - h, 3, h); g.fillStyle = "#d8ffff"; g.fillRect(x, y - h, 1, h); g.fillStyle = "#3fc8e6"; g.fillRect(x + 2, y - h + 1, 1, h - 1); };
      cr(10, 30, 10); cr(14, 30, 14); cr(18, 30, 8); cr(22, 30, 5);
    }, (r, g, b) => b > 200 && g > 190 && r < 230),
  ];
  TEX.sand = makeTex(32, 32, (g, s) => {
    const r = rng(7); g.fillStyle = "#b08a57"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) px(g, Math.floor(r() * s), Math.floor(r() * s), ["#9c7748", "#c39b66", "#a7804f", "#cfa872"][Math.floor(r() * 4)]);
    for (let y = 6; y < s; y += 9) for (let x = 0; x < s; x++) if (Math.sin(x / 3 + y) > 0.6) px(g, x, y + Math.round(Math.sin(x / 4)), "#8e6a3e");
    g.fillStyle = "#5e4426"; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    g.fillStyle = "#d2ad78"; g.fillRect(1, 1, s - 1, 1); g.fillRect(1, 1, 1, s - 1);
  });
  TEX.ceil = makeTex(32, 32, (g, s) => { const r = stoneBase(g, s, 77); g.fillStyle = "rgba(0,10,20,.45)"; g.fillRect(0, 0, s, s); });
  TEX.mine = makeTex(32, 48, (g) => {
    g.fillStyle = "#6b7680"; for (let y = 27; y < 48; y += 3) g.fillRect(15, y, 2, 2);
    g.fillStyle = "#11161a";
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; for (let k = 9; k < 15; k++) g.fillRect(Math.round(16 + Math.cos(a) * k) - 1, Math.round(16 + Math.sin(a) * k) - 1, 3, 3); }
    g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fillStyle = "#11161a"; g.fill();
    g.beginPath(); g.arc(16, 16, 9, 0, 7); g.fillStyle = "#454f58"; g.fill();
    g.fillStyle = "#6c7884"; g.fillRect(11, 10, 4, 3); g.fillRect(10, 12, 2, 3);
    g.fillStyle = "#ff3b2f"; g.fillRect(15, 4, 3, 3);
  }, (r, g, b) => r > 240 && g < 80);
  TEX.pearl = makeTex(32, 24, (g) => {
    g.fillStyle = "#7d4f86"; g.beginPath(); g.ellipse(16, 18, 14, 5, 0, 0, Math.PI); g.fill();
    g.fillStyle = "#a96aa2"; g.beginPath(); g.ellipse(16, 18, 14, 5, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#c58bbd"; g.beginPath(); g.moveTo(3, 17); g.lineTo(16, 2); g.lineTo(29, 17); g.closePath(); g.fill();
    g.fillStyle = "#e0b3d8"; for (let i = 0; i < 5; i++) g.fillRect(6 + i * 5, 10 + Math.abs(2 - i), 1, 6);
    g.beginPath(); g.arc(16, 15, 4.5, 0, 7); g.fillStyle = "#fffaf0"; g.fill();
    g.fillStyle = "#ffffff"; g.fillRect(14, 13, 2, 2);
  }, (r, g, b) => r > 240 && g > 235 && b > 220);
  TEX.fish = makeTex(16, 10, (g) => {
    g.fillStyle = "#ff8c2e"; g.beginPath(); g.ellipse(9, 5, 6, 4, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(4, 5); g.lineTo(0, 1); g.lineTo(0, 9); g.closePath(); g.fill();
    g.fillStyle = "#fff"; g.fillRect(7, 1, 2, 8); g.fillStyle = "#111"; g.fillRect(12, 4, 1, 1);
  });
}

/* ---------------- 狀態 ---------------- */
const S = {
  mode: null, running: false, score: 0, hits: 0, left: 60, timer: 0, sound: true,
  gx: START[0], gy: START[1], face: 0,
  x: START[0] + 1.5, y: START[1] + 1.5, ang: FACE_ANG[0], bump: 0, bumpDir: [0, 0], shake: 0,
  boom: 0, boomPhase: 0, flash: 0, pendingArrive: null, mines: [[4, 4]], pearls: [], fish: [], cracks: [], fade: 0,
};
let MAP = [];
function buildMap() {
  MAP = [];
  for (let y = 0; y < MW; y++) { const row = []; for (let x = 0; x < MW; x++) row.push(x === 0 || y === 0 || x === MW - 1 || y === MW - 1 ? 1 + ((x * 7 + y * 13) % 4) : 0); MAP.push(row); }
}
const isMine = (x, y) => S.mines.some(([a, b]) => a === x && b === y);
function loadMines() {
  try { const m = JSON.parse(localStorage.getItem("cockpit.mines") || "null"); if (Array.isArray(m)) S.mines = m.filter((p) => Array.isArray(p) && p.length === 2).slice(0, 6); } catch (e) {}
}
function saveMines() { try { localStorage.setItem("cockpit.mines", JSON.stringify(S.mines)); } catch (e) {} }

function placePearl() {
  const free = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (isMine(x, y) || (x === S.gx && y === S.gy) || S.pearls.some((p) => p.gx === x && p.gy === y)) continue;
    free.push([x, y, Math.abs(x - S.gx) + Math.abs(y - S.gy)]);
  }
  if (!free.length) return;
  const far = free.filter((f) => f[2] >= 2), pick = (far.length ? far : free)[Math.floor(Math.random() * (far.length ? far : free).length)];
  S.pearls.push({ gx: pick[0], gy: pick[1], ph: rnd(0, 6), born: performance.now() });
}

/* ---------------- 藍牙 ---------------- */
let device = null, rxChar = null, sending = Promise.resolve();
function setStatus(st, name) {
  $("dot").className = "dot" + (st === "on" ? " on" : st === "wait" ? " wait" : "");
  $("status").textContent = st === "on" ? `已連接 ${name || ""}` : st === "wait" ? "連接中…" : "未連接";
  $("connectBtn").textContent = st === "on" ? "中斷連接" : "連接 micro:bit";
}
async function connect() {
  if (!navigator.bluetooth) { toast("這個瀏覽器不支援藍牙，請用 Chrome 或 Edge"); return; }
  try {
    setStatus("wait");
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }], optionalServices: [NUS] });
    device.addEventListener("gattserverdisconnected", () => { rxChar = null; setStatus("off"); log("已中斷連接", "e"); });
    const svc = await (await device.gatt.connect()).getPrimaryService(NUS);
    rxChar = await svc.getCharacteristic(NUS_RX);
    try { const tx = await svc.getCharacteristic(NUS_TX); await tx.startNotifications(); } catch (e) {}
    setStatus("on", device.name); log(`已連接 ${device.name || "micro:bit"}`);
    toast("連接成功！micro:bit 按重設鈕，潛艇回到 (2, 2)");
  } catch (err) { if (!err || err.name !== "NotFoundError") log(`連接失敗：${(err && err.message) || err}`, "e"); setStatus("off"); }
}
function send(word) {
  if (!rxChar) { log(`（未連接）${word}#`, "s"); return; }
  const data = new TextEncoder().encode(word + "#");
  sending = sending.then(async () => {
    try { if (rxChar.properties && rxChar.properties.writeWithoutResponse) await rxChar.writeValueWithoutResponse(data); else await rxChar.writeValue(data); log(`送出 ${word}#`, "s"); }
    catch (err) { log(`送出失敗 ${err.message || err}`, "e"); }
  });
}
function log(t, cls) { const el = $("log"), d = document.createElement("div"); if (cls) d.className = cls; d.textContent = t; el.appendChild(d); while (el.childNodes.length > 6) el.removeChild(el.firstChild); }

/* ---------------- 音效 ---------------- */
let ac = null;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
function tone(f1, f2, dur, type = "sine", vol = 0.18, delay = 0) {
  const a = audio(); if (!a || !S.sound) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, freq = 700) {
  const a = audio(); if (!a || !S.sound) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol; s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
}
const sfx = {
  move() { noise(0.35, 0.12, 300); tone(140, 110, 0.3, "sine", 0.08); },
  turn() { tone(220, 260, 0.12, "triangle", 0.05); },
  bump() { tone(110, 45, 0.35, "sawtooth", 0.14); noise(0.2, 0.2, 500); },
  pearl() { tone(880, 1320, 0.18, "triangle", 0.16); tone(1320, 1760, 0.22, "triangle", 0.14, 0.09); },
  boom() { noise(1.1, 0.7, 900); tone(90, 30, 0.9, "sine", 0.35); },
  ping() { tone(1300, 1300, 0.08, "sine", 0.06); },
  end() { [784, 659, 523].forEach((f, i) => tone(f, f, 0.35, "triangle", 0.14, i * 0.16)); },
};

/* ---------------- 指令 ---------------- */
function command(c) {
  if (!CMD[c]) return;
  audio();
  if (!$("menu").hidden || !$("endOv").hidden) return;
  if (S.boom) { toast("等一下，潛艇修理中…"); return; }
  send(c);
  const [dx, dy, face] = CMD[c];
  const nx = clamp(S.gx + dx, 0, N - 1), ny = clamp(S.gy + dy, 0, N - 1);
  if (face !== S.face) sfx.turn();
  S.face = face;
  if (nx === S.gx && ny === S.gy) { S.bump = 1; S.bumpDir = [dx, dy]; S.pendingBump = true; }
  else { S.gx = nx; S.gy = ny; S.pendingArrive = performance.now(); sfx.move(); }
  hud();
  const b = document.querySelector(`.pad [data-c="${c}"]`); if (b) { b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 140); }
}
function arrive() {
  S.pendingArrive = null;
  const p = S.pearls.findIndex((q) => q.gx === S.gx && q.gy === S.gy);
  if (p >= 0 && S.running) { S.pearls.splice(p, 1); S.score++; sfx.pearl(); toast("拿到珍珠！"); placePearl(); hud(); }
  if (isMine(S.gx, S.gy)) explode();
}
function explode() {
  S.boom = performance.now(); S.hits++; S.shake = 1; S.flash = 1; sfx.boom(); hud();
  S.cracks = [];
  for (let i = 0; i < 7; i++) { const a = rnd(0, 6.28), pts = [[0.5 + rnd(-0.1, 0.1), 0.45 + rnd(-0.1, 0.1)]]; for (let k = 0; k < 5; k++) { const l = pts[pts.length - 1]; pts.push([l[0] + Math.cos(a + rnd(-0.6, 0.6)) * 0.09, l[1] + Math.sin(a + rnd(-0.6, 0.6)) * 0.09]); } S.cracks.push(pts); }
  toast("轟！撞到水雷了");
}
function finishBoom() {
  S.boom = 0; S.cracks = []; S.gx = HOME[0]; S.gy = HOME[1]; S.x = HOME[0] + 1.5; S.y = HOME[1] + 1.5; S.fade = 1;
  hud(); toast("回到 (0, 0) 重新出發");
  if (S.pearls.some((p) => p.gx === S.gx && p.gy === S.gy)) arrive();
}

/* ---------------- 流程 ---------------- */
function start(mode) {
  audio();
  S.mode = mode; S.running = true; S.score = 0; S.hits = 0; S.left = 60; S.boom = 0; S.cracks = [];
  S.gx = START[0]; S.gy = START[1]; S.face = 0; S.x = START[0] + 1.5; S.y = START[1] + 1.5; S.ang = FACE_ANG[0]; S.fade = 1;
  S.pearls = []; for (let i = 0; i < 3; i++) placePearl();
  S.fish = []; for (let i = 0; i < 6; i++) S.fish.push({ x: rnd(1.3, 5.7), y: rnd(1.3, 5.7), a: rnd(0, 6.28), sp: rnd(0.3, 0.6), z: rnd(-0.25, 0.1) });
  $("menu").hidden = true; $("endOv").hidden = true; $("timeBox").hidden = mode !== "time";
  clearInterval(S.timer);
  if (mode === "time") S.timer = setInterval(() => { if (!S.running) return; S.left--; hud(); if (S.left <= 0) finish(); }, 1000);
  hud(); toast(mode === "time" ? "60 秒尋寶開始！" : "潛艇出航！");
}
function finish() {
  S.running = false; clearInterval(S.timer); sfx.end();
  $("endTitle").textContent = "時間到！"; $("endScore").textContent = `${S.score} 顆珍珠`;
  $("endText").textContent = S.hits ? `被水雷炸到 ${S.hits} 次。下次多看 micro:bit 的海圖！` : "一次都沒有被炸到，太厲害了！";
  $("endOv").hidden = false;
}
function openMenu() { S.running = false; clearInterval(S.timer); $("endOv").hidden = true; $("menu").hidden = false; drawGrid(); }
function hud() {
  $("score").textContent = S.score; $("time").textContent = S.left; $("hits").textContent = S.hits;
  $("timeBox").classList.toggle("warn", S.left <= 10);
  $("coord").textContent = `${S.gx}, ${S.gy}`;
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1500); }
function drawGrid() {
  const g = $("grid5"); g.innerHTML = "";
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const b = document.createElement("button"), st = x === START[0] && y === START[1], hm = x === HOME[0] && y === HOME[1];
    b.className = (isMine(x, y) ? "mine" : "") + (st ? " start" : "") + (hm ? " home" : "");
    b.textContent = `${x},${y}`; b.title = `(${x}, ${y})`; b.disabled = st || hm;
    b.onclick = () => {
      if (isMine(x, y)) S.mines = S.mines.filter(([a, c]) => !(a === x && c === y));
      else if (S.mines.length < 6) S.mines.push([x, y]); else toast("最多 6 顆水雷");
      saveMines(); drawGrid();
    };
    g.appendChild(b);
  }
}

/* ---------------- 第一人稱繪圖（光線投射） ---------------- */
const cv = $("view"), ctx = cv.getContext("2d");
let W = 320, H = 180, img = null, buf = null, zbuf = new Float32Array(800), hl = new Float32Array(800);
function resize() {
  const asp = innerWidth / Math.max(1, innerHeight);
  H = 180; W = clamp(Math.round(H * asp), 200, 420);
  cv.width = W; cv.height = H; img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer);
  for (let x = 0; x < W; x++) { const c = (2 * x) / W - 1; hl[x] = 0.35 * Math.exp(-c * c * 3.5); }
}
const FOG = [6, 30, 52];
function put(i, r, g, b) { buf[i] = 0xff000000 | (clamp(b, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(r, 0, 255); }
function shade(r, g, b, dist, light, emis) {
  const f = 1 - Math.exp(-dist * (emis ? 0.18 : 0.42));
  const L = emis ? 1.15 : light;
  return [r * L * (1 - f) + FOG[0] * f, g * L * (1 - f) + FOG[1] * f, b * L * (1 - f) + FOG[2] * f];
}
function caust(x, y, t) { return (Math.sin(x * 5.1 + t * 1.7) + Math.sin(y * 4.3 - t * 1.3) + Math.sin((x + y) * 3.7 + t)) / 3; }

function render(now) {
  const t = now / 1000;
  const bumpOff = Math.sin(S.bump * Math.PI) * 0.18;
  const sh = S.shake * 0.08;
  const ang = S.ang + (Math.random() - 0.5) * sh;
  const dirX = Math.cos(ang), dirY = Math.sin(ang), plX = -dirY * 0.7, plY = dirX * 0.7;
  const P = { x: S.x + S.bumpDir[0] * bumpOff, y: S.y + S.bumpDir[1] * bumpOff };
  const hor = Math.round(H / 2 + Math.sin(t * 1.4) * 1.5 + (Math.random() - 0.5) * sh * 40);
  const posZ = H / 2;
  // 地板與天花板
  const r0x = dirX - plX, r0y = dirY - plY, r1x = dirX + plX, r1y = dirY + plY;
  const sand = TEX.sand, ceil = TEX.ceil;
  for (let y = 0; y < H; y++) {
    const isFloor = y > hor, p = isFloor ? y - hor : hor - y;
    if (p <= 0) { for (let x = 0; x < W; x++) put(y * W + x, FOG[0], FOG[1], FOG[2]); continue; }
    const rowD = posZ / p;
    const stepX = (rowD * (r1x - r0x)) / W, stepY = (rowD * (r1y - r0y)) / W;
    let fx = P.x + rowD * r0x, fy = P.y + rowD * r0y;
    const tex = isFloor ? sand : ceil;
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy);
      const tx = Math.floor(32 * (fx - cx)) & 31, ty = Math.floor(32 * (fy - cy)) & 31, k = (ty * 32 + tx) * 4;
      let r = tex.d[k], g = tex.d[k + 1], b = tex.d[k + 2];
      let light = 1 + hl[x] * Math.exp(-rowD * 0.35);
      if (isFloor) { light *= 0.86 + 0.22 * caust(fx, fy, t); if ((cx + cy) & 1) light *= 0.9; }
      else light *= 0.55 + 0.35 * Math.max(0, caust(fx * 0.7, fy * 0.7, t * 0.8));
      const c = shade(r, g, b, rowD, light, false);
      put(y * W + x, c[0], c[1], c[2]);
      fx += stepX; fy += stepY;
    }
  }
  // 牆
  for (let x = 0; x < W; x++) {
    const cam = (2 * x) / W - 1, rx = dirX + plX * cam, ry = dirY + plY * cam;
    let mx = Math.floor(P.x), my = Math.floor(P.y);
    const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
    let stx, sty, sdx, sdy, side = 0, hit = 0;
    if (rx < 0) { stx = -1; sdx = (P.x - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - P.x) * ddx; }
    if (ry < 0) { sty = -1; sdy = (P.y - my) * ddy; } else { sty = 1; sdy = (my + 1 - P.y) * ddy; }
    for (let n = 0; n < 40 && !hit; n++) {
      if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
      if (mx < 0 || my < 0 || mx >= MW || my >= MW) break;
      hit = MAP[my][mx];
    }
    const dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy); zbuf[x] = dist;
    const tex = TEX.walls[(hit || 1) - 1];
    let wx = side === 0 ? P.y + dist * ry : P.x + dist * rx; wx -= Math.floor(wx);
    let tx = Math.floor(wx * 32); if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) tx = 31 - tx;
    const lh = H / dist, y0 = Math.floor(hor - lh / 2), y1 = Math.floor(hor + lh / 2);
    const light = (side ? 0.78 : 1) * (1 + hl[x] * Math.exp(-dist * 0.3)) * (0.92 + 0.12 * caust(wx + mx, my, t));
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      const ty = Math.floor(((y - y0) / lh) * 32) & 31, k = ty * 32 + tx, d = tex.d;
      const c = shade(d[k * 4], d[k * 4 + 1], d[k * 4 + 2], dist, light, tex.em[k]);
      put(y * W + x, c[0], c[1], c[2]);
    }
  }
  // 物件（遠的先畫）
  const inv = 1 / (plX * dirY - dirX * plY), sprites = [];
  const mineVis = (gx, gy) => { const d = Math.hypot(gx - S.gx, gy - S.gy); return d <= 1.01 ? 1 : d <= 2.3 ? 0.3 : 0; };
  for (const [gx, gy] of S.mines) {
    const key = gx + "," + gy; const target = mineVis(gx, gy);
    mv[key] = (mv[key] ?? 0) + (target - (mv[key] ?? 0)) * 0.12;
    if (mv[key] > 0.02) sprites.push({ x: gx + 1.5, y: gy + 1.5, tex: TEX.mine, h: 0.62, v: -0.02 + Math.sin(t * 1.2 + gx) * 0.03, a: mv[key], ghost: mv[key] < 0.6, blink: Math.sin(t * 6 + gy) > 0 });
  }
  for (const p of S.pearls) sprites.push({ x: p.gx + 1.5, y: p.gy + 1.5, tex: TEX.pearl, h: 0.26, v: 0.37, a: Math.min(1, (now - p.born) / 400), glow: true });
  for (const f of S.fish) sprites.push({ x: f.x, y: f.y, tex: TEX.fish, h: 0.07, v: f.z, a: 0.95, flip: Math.cos(f.a - ang) < 0 });
  for (const s of sprites) s.dist = (s.x - P.x) ** 2 + (s.y - P.y) ** 2;
  sprites.sort((a, b) => b.dist - a.dist);
  for (const s of sprites) drawSprite(s, P, dirX, dirY, plX, plY, inv, hor, t);
  ctx.putImageData(img, 0, 0);
  // 珍珠的光暈
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const s of sprites) if (s.glow && s.sx !== undefined) {
    const R = Math.max(4, s.sh * 0.9), g = ctx.createRadialGradient(s.sx, s.sy, 0, s.sx, s.sy, R);
    g.addColorStop(0, `rgba(255,245,210,${0.5 * s.a})`); g.addColorStop(1, "rgba(255,245,210,0)"); ctx.fillStyle = g; ctx.fillRect(s.sx - R, s.sy - R, R * 2, R * 2);
  }
  ctx.restore();
  overlay(now, t, hor);
}
const mv = {};
function drawSprite(s, P, dirX, dirY, plX, plY, inv, hor, t) {
  const dx = s.x - P.x, dy = s.y - P.y;
  const tX = inv * (dirY * dx - dirX * dy), tY = inv * (-plY * dx + plX * dy);
  if (tY <= 0.12) return;
  const sx = (W / 2) * (1 + tX / tY), unit = H / tY, sh = unit * s.h, sw = (sh * s.tex.w) / s.tex.h, cy = hor + unit * s.v;
  const x0 = Math.floor(sx - sw / 2), y0 = Math.floor(cy - sh / 2), tex = s.tex;
  s.sx = sx; s.sy = cy; s.sh = sh;
  const dist = Math.sqrt(s.dist);
  for (let x = Math.max(0, x0); x < Math.min(W, x0 + sw); x++) {
    if (tY >= zbuf[x]) continue;
    let tx = Math.floor(((x - x0) / sw) * tex.w); if (s.flip) tx = tex.w - 1 - tx;
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + sh); y++) {
      const ty = Math.floor(((y - y0) / sh) * tex.h), k = ty * tex.w + tx, a = tex.d[k * 4 + 3];
      if (a < 100) continue;
      let r = tex.d[k * 4], g = tex.d[k * 4 + 1], b = tex.d[k * 4 + 2], em = tex.em[k];
      if (em && s.blink === false) { r = 90; g = 20; b = 20; em = 0; }
      let c;
      if (s.ghost) {
        // 模糊的影子：只看到暗暗的輪廓
        const edge = ((tx + ty + Math.floor(t * 8)) & 3) === 0;
        c = [FOG[0] * 0.35 + (edge ? 30 : 0), FOG[1] * 0.35 + (edge ? 45 : 0), FOG[2] * 0.35 + (edge ? 55 : 0)];
      } else c = shade(r, g, b, dist, 1.05, em);
      const i = y * W + x, o = buf[i], A = s.a * (s.ghost ? 0.85 : 1);
      const or = o & 255, og = (o >> 8) & 255, ob = (o >> 16) & 255;
      put(i, or + (c[0] - or) * A, og + (c[1] - og) * A, ob + (c[2] - ob) * A);
    }
  }
}
// 前景：海雪、氣泡、機械手臂、危險警示、裂痕
const snow = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.3, 1) }));
const bubbles = [];
function overlay(now, t, hor) {
  ctx.fillStyle = "rgba(210,235,255,.5)";
  for (const p of snow) {
    p.y += 0.0006 * p.z; if (p.y > 1) { p.y = 0; p.x = Math.random(); }
    const x = (((p.x - S.ang * 0.25 * p.z) % 1) + 1) % 1;
    ctx.globalAlpha = 0.25 + p.z * 0.45; ctx.fillRect(Math.floor(x * W), Math.floor(p.y * H), p.z > 0.8 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  if (Math.random() < 0.25) bubbles.push({ x: Math.random() < 0.5 ? rnd(W * 0.12, W * 0.22) : rnd(W * 0.78, W * 0.88), y: H * 0.9, v: rnd(10, 25), r: Math.random() < 0.3 ? 2 : 1 });
  ctx.strokeStyle = "rgba(220,245,255,.7)";
  for (const b of bubbles) { b.y -= b.v / 60; b.x += Math.sin(b.y / 6) * 0.3; ctx.strokeRect(Math.floor(b.x), Math.floor(b.y), b.r, b.r); }
  while (bubbles.length && bubbles[0].y < 0) bubbles.shift();
  if (bubbles.length > 80) bubbles.splice(0, bubbles.length - 80);
  // 機械手臂（潛艇的夾爪）
  const bob = Math.sin(t * 2.2) * 1.5 + (S.pendingArrive ? Math.sin(t * 14) * 1 : 0) + Math.sin(S.bump * Math.PI) * -8;
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(sgn < 0 ? 0 : W, H); ctx.scale(sgn < 0 ? 1 : -1, 1); ctx.translate(0, bob);
    ctx.fillStyle = "#1c1408"; ctx.fillRect(18, -46, 22, 46); ctx.fillRect(34, -62, 18, 22);
    ctx.fillStyle = "#e2a92b"; ctx.fillRect(20, -44, 18, 44); ctx.fillStyle = "#ffd25a"; ctx.fillRect(20, -44, 4, 44);
    ctx.fillStyle = "#8b6516"; ctx.fillRect(34, -44, 4, 44);
    ctx.fillStyle = "#c9d6df"; ctx.fillRect(36, -60, 14, 18); ctx.fillStyle = "#8a99a3"; ctx.fillRect(46, -60, 4, 18);
    ctx.fillStyle = "#e2a92b"; ctx.fillRect(38, -72, 4, 14); ctx.fillRect(46, -70, 4, 12); ctx.fillStyle = "#1c1408"; ctx.fillRect(38, -74, 4, 2); ctx.fillRect(46, -72, 4, 2);
    ctx.fillStyle = "#555"; for (let i = 0; i < 4; i++) ctx.fillRect(25, -38 + i * 10, 2, 2);
    ctx.restore();
  }
  // 窗框暗角
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,4,10,.75)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // 水雷就在旁邊：紅色警示
  const near = S.mines.some(([a, b]) => Math.abs(a - S.gx) + Math.abs(b - S.gy) === 1);
  if (near && !S.boom) {
    const a = 0.18 + 0.12 * Math.sin(t * 8);
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.6); rg.addColorStop(0, "rgba(255,40,30,0)"); rg.addColorStop(1, `rgba(255,40,30,${a})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    if (now - (overlay.lastPing || 0) > 600) { overlay.lastPing = now; sfx.ping(); }
  }
  // 爆炸：火球、碎片、閃光、裂痕、變暗
  const bt = S.boom ? (now - S.boom) / 1000 : 9;
  if (bt < 1.1) {
    const cx = W / 2, cy = H * 0.5, R = 10 + bt * 150;
    for (const [col, k] of [["#7a1d0c", 1], ["#e2461f", 0.8], ["#ff9d2e", 0.58], ["#ffe27a", 0.35]]) {
      ctx.fillStyle = col; ctx.globalAlpha = clamp(1.3 - bt * 1.2, 0, 1);
      for (let a = 0; a < 6.28; a += 0.26) { const rr = R * k * (0.85 + 0.15 * Math.sin(a * 5 + bt * 20)); ctx.fillRect(Math.floor(cx + Math.cos(a) * rr * 0.5 - rr * 0.35), Math.floor(cy + Math.sin(a) * rr * 0.35 - rr * 0.3), Math.ceil(rr * 0.7), Math.ceil(rr * 0.6)); }
    }
    ctx.globalAlpha = 1; ctx.fillStyle = "#2a2f35";
    for (let i = 0; i < 14; i++) { const a = i * 0.45 + 0.3, d = bt * (90 + (i % 4) * 35); ctx.fillRect(Math.floor(cx + Math.cos(a) * d), Math.floor(cy + Math.sin(a) * d * 0.7), 3, 2); }
  }
  if (S.flash > 0) { ctx.fillStyle = `rgba(255,${180 + 60 * S.flash},120,${S.flash * 0.85})`; ctx.fillRect(0, 0, W, H); }
  if (S.cracks.length) {
    ctx.strokeStyle = "rgba(230,250,255,.85)"; ctx.lineWidth = 1;
    for (const c of S.cracks) { ctx.beginPath(); c.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H))); ctx.stroke(); }
  }
  if (S.boom) { const k = clamp((now - S.boom - 700) / 900, 0, 1); ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
  if (S.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${S.fade})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- 主迴圈 ---------------- */
let last = performance.now();
function update(dt, now) {
  const tx = S.gx + 1.5, ty = S.gy + 1.5, ta = FACE_ANG[S.face];
  let da = ta - S.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  S.ang += da * (1 - Math.exp(-dt * 9));
  if (Math.abs(da) < 0.35 && !S.boom) {
    const k = 1 - Math.exp(-dt * 6.5); S.x += (tx - S.x) * k; S.y += (ty - S.y) * k;
  }
  if (S.pendingArrive && Math.hypot(tx - S.x, ty - S.y) < 0.12) arrive();
  if (S.pendingBump && Math.abs(da) < 0.2) { S.pendingBump = false; S.bump = 0.999; S.shake = Math.max(S.shake, 0.4); sfx.bump(); }
  if (S.bump > 0 && !S.pendingBump) S.bump = Math.max(0, S.bump - dt * 3);
  S.shake *= Math.exp(-dt * 4); S.flash = Math.max(0, S.flash - dt * 2.2); S.fade = Math.max(0, S.fade - dt * 1.5);
  if (S.boom && now - S.boom > 1600) finishBoom();
  for (const f of S.fish) {
    f.a += Math.sin(now / 900 + f.sp * 10) * dt * 0.8;
    f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt;
    if (f.x < 1.2 || f.x > 5.8 || f.y < 1.2 || f.y > 5.8) { f.a += Math.PI; f.x = clamp(f.x, 1.2, 5.8); f.y = clamp(f.y, 1.2, 5.8); }
    if (Math.hypot(f.x - S.x, f.y - S.y) < 0.6) { f.a = Math.atan2(f.y - S.y, f.x - S.x); }
  }
  // 羅盤
  const deg = ((S.ang * 180) / Math.PI + 90 + 360) % 360;
  $("tape").style.transform = `translateX(${130 - 32.5 - (deg / 90) * 65 - 65 * 4}px)`;
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt, now); render(now); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function init() {
  buildTextures(); buildMap(); loadMines(); resize(); addEventListener("resize", resize);
  const names = ["北", "東", "南", "西"], tape = $("tape");
  for (let i = 0; i < 16; i++) { const s = document.createElement("span"); s.textContent = names[i % 4]; if (i % 4 === 0) s.className = "n"; tape.appendChild(s); }
  setStatus("off"); drawGrid();
  $("connectBtn").onclick = () => (device && device.gatt.connected ? device.gatt.disconnect() : connect());
  $("soundBtn").onclick = () => { S.sound = !S.sound; $("soundBtn").textContent = S.sound ? "音效 開" : "音效 關"; };
  $("menuBtn").onclick = openMenu; $("backBtn").onclick = openMenu; $("againBtn").onclick = () => start(S.mode);
  $("modeFree").onclick = () => start("free"); $("modeTime").onclick = () => start("time");
  document.querySelectorAll(".pad button").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); command(b.dataset.c); }));
  const KEY = { ArrowUp: "f", ArrowDown: "b", ArrowLeft: "l", ArrowRight: "r", w: "f", s: "b", a: "l", d: "r" };
  addEventListener("keydown", (e) => {
    const c = KEY[e.key] || KEY[e.key.toLowerCase && e.key.toLowerCase()];
    if (c) { e.preventDefault(); if (!e.repeat) command(c); }
    if (e.key === "Escape") openMenu();
  });
  hud(); requestAnimationFrame(frame);
}
window.COCKPIT = { S, command, start };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
