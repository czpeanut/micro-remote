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
const START = [0, 0], HOME = [0, 0], N = 5, MW = N + 2;
const FACE_ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // 北 東 南 西
const CMD = { f: [0, -1, 0], r: [1, 0, 1], b: [0, 1, 2], l: [-1, 0, 3] };

/* ---------------- 材質（像素畫） ---------------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function makeTex(w, h, draw, emissive) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false; draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data, em = new Uint8Array(w * h);
  if (emissive) for (let i = 0; i < w * h; i++) em[i] = emissive(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]) ? 1 : 0;
  return { w, h, d, em, c };
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
  boom: 0, boomPhase: 0, flash: 0, pendingArrive: null, pearls: [], fish: [], cracks: [], fade: 0,
};
let MAP = [];
function buildMap() {
  MAP = [];
  for (let y = 0; y < MW; y++) { const row = []; for (let x = 0; x < MW; x++) row.push(x === 0 || y === 0 || x === MW - 1 || y === MW - 1 ? 1 + ((x * 7 + y * 13) % 4) : 0); MAP.push(row); }
}

function placePearl() {
  const free = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x === S.gx && y === S.gy) || S.pearls.some((p) => p.gx === x && p.gy === y)) continue;
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
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }, { namePrefix: "BBC micro:bit" }], optionalServices: [NUS] });
    device.addEventListener("gattserverdisconnected", () => {
      rxChar = null; setStatus("off"); log("已中斷連接", "e");
      if (S.running && !S.demo) { openMenu(); toast("micro:bit 斷線了，重新連接後再開始"); }
      updateModes();
    });
    const svc = await nusService(device);
    const ch = await nusChars(svc); rxChar = ch.rx;
    try { await ch.tx.startNotifications(); ch.tx.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value))); } catch (e) {}
    setStatus("on", device.name); log(`已連接 ${device.name || "micro:bit"}`); updateModes();
    toast("連接成功！micro:bit 按重設鈕，潛艇回到 (0, 0)");
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
}
// micro:bit 撞到水雷時會送 boom#，網頁跟著爆炸（水雷只在 micro:bit 上）
let rxBuf = "";
function receive(text) {
  rxBuf += text;
  let i;
  while ((i = rxBuf.search(/[#\n]/)) >= 0) {
    const w = rxBuf.slice(0, i).trim(); rxBuf = rxBuf.slice(i + 1);
    if (!w) continue;
    log(`收到 ${w}#`);
    if (w.toLowerCase() === "boom") onBoom();
  }
  if (rxBuf.length > 64) rxBuf = "";
}
// micro:bit 每送一次 boom# 就延後「修理完成」；連續一直送，代表程式在水雷上卡住了
function onBoom() {
  const now = performance.now();
  if (!S.running) return;
  if (S.boom) {
    S.boomRepeat = (S.boomRepeat || 0) + 1; S.lastBoomRx = now;
    if (S.boomRepeat >= 2) showStuck(true);
    return;
  }
  S.boomRepeat = 0; S.lastBoomRx = now; explode();
}
function showStuck(on) {
  const el = $("stuck"); if (!el) return;
  el.hidden = !on;
}
function explode() {
  S.boom = performance.now(); S.hits++; S.shake = 1; S.flash = 1; sfx.boom(); hud();
  for (let i = 0; i < 40; i++) { const a = rnd(0, 6.28), v = rnd(0.8, 3); debris.push({ x: S.gx + 1.5, y: S.gy + 1.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.6, 1.3), s: Math.random() < 0.3 ? 2 : 1, c: ["#ffd25a", "#ff9d2e", "#e2461f", "#3b434b"][i % 4] }); }
  S.cracks = [];
  for (let i = 0; i < 0; i++) { const a = rnd(0, 6.28), pts = [[0.5 + rnd(-0.1, 0.1), 0.45 + rnd(-0.1, 0.1)]]; for (let k = 0; k < 5; k++) { const l = pts[pts.length - 1]; pts.push([l[0] + Math.cos(a + rnd(-0.6, 0.6)) * 0.09, l[1] + Math.sin(a + rnd(-0.6, 0.6)) * 0.09]); } S.cracks.push(pts); }
  toast("轟！撞到水雷了");
}
function finishBoom() {
  showStuck(false); S.boomRepeat = 0;
  S.boom = 0; S.cracks = []; S.gx = HOME[0]; S.gy = HOME[1]; S.x = HOME[0] + 1.5; S.y = HOME[1] + 1.5; S.fade = 1;
  hud(); toast("回到 (0, 0) 重新出發");
  if (S.pearls.some((p) => p.gx === S.gx && p.gy === S.gy)) arrive();
}

/* ---------------- 流程 ---------------- */
function updateModes() {
  const ok = !!rxChar;
  ["modeFree", "modeTime"].forEach((id) => $(id).classList.toggle("locked", !ok));
  const n = $("needConnect"); if (n) n.hidden = ok;
}
function start(mode, demo) {
  audio();
  if (!demo && !rxChar) {
    toast("先按右上角「連接 micro:bit」，連上之後才能出航");
    const b = $("connectBtn"); b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
    return;
  }
  S.demo = !!demo; showStuck(false); S.boomRepeat = 0; S.lastBoomRx = 0;
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
function openMenu() { S.running = false; clearInterval(S.timer); $("endOv").hidden = true; $("menu").hidden = false; }
function hud() {
  $("score").textContent = S.score; $("time").textContent = S.left; $("hits").textContent = S.hits;
  $("timeBox").classList.toggle("warn", S.left <= 10);
  $("coord").textContent = `${S.gx}, ${S.gy}`;
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1500); }
/* ---------------- 俯視角繪圖（像素風） ---------------- */
const cv = $("view"), ctx = cv.getContext("2d");
const T = 32, MAPPX = MW * T;
let W = 420, H = 256, OX = 0, OY = 24;
const dark = document.createElement("canvas"), dctx = dark.getContext("2d");
const caustC = document.createElement("canvas"), cctx = caustC.getContext("2d");
let caustImg = null, frameNo = 0;
function resize() {
  const asp = innerWidth / Math.max(1, innerHeight);
  H = 256; W = clamp(Math.round(H * asp), 260, 560);
  cv.width = W; cv.height = H; dark.width = W; dark.height = H;
  OX = Math.round((W - MAPPX) / 2); OY = Math.max(22, Math.round((H - MAPPX) / 2) + 8);
  ctx.imageSmoothingEnabled = false;
  caustC.width = N * T; caustC.height = N * T; caustImg = cctx.createImageData(N * T, N * T);
}
const wx2s = (x) => OX + x * T, wy2s = (y) => OY + y * T;
function caust(x, y, t) { return (Math.sin(x * 5.1 + t * 1.7) + Math.sin(y * 4.3 - t * 1.3) + Math.sin((x + y) * 3.7 + t)) / 3; }
const snow = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.3, 1) }));
const bubbles = [], debris = [];

function drawSub(cx, cy, ang, t) {
  ctx.save(); ctx.translate(Math.round(cx), Math.round(cy));
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(3, 5, 14, 8, ang, 0, 7); ctx.fill();
  ctx.rotate(ang);
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  R(-16, -9, 4, 4, "#e8932c"); R(-16, 5, 4, 4, "#e8932c"); R(-15, -2, 3, 4, "#e8932c");
  const pr = Math.sin(t * 30) > 0; R(-19, pr ? -5 : -1, 2, pr ? 4 : 6, "#c9d6df"); R(-19, pr ? 1 : -1, 2, pr ? 4 : 2, "#c9d6df");
  R(-13, -5, 26, 10, "#2b2420"); R(-11, -7, 22, 14, "#2b2420"); R(-14, -3, 28, 6, "#2b2420");
  R(-12, -4, 24, 8, "#ffc433"); R(-10, -6, 20, 12, "#ffc433"); R(-13, -2, 26, 4, "#ffc433");
  R(-10, -6, 20, 3, "#ffe27a"); R(-12, -4, 4, 2, "#ffe27a");
  R(-10, 4, 20, 2, "#d7951c"); R(-12, 2, 2, 2, "#d7951c");
  R(-1, -4, 9, 8, "#2b2420"); R(0, -3, 7, 6, "#e0a520"); R(1, -2, 5, 4, "#11364f");
  R(1, -3, 2, 2, "#e9792e"); R(4, -3, 2, 2, "#e9792e"); R(2, -1, 3, 2, "#e9792e"); R(3, 0, 1, 1, "#fff4e6");
  R(12, -1, 3, 2, "#fffbe0");
  for (let i = -8; i <= 8; i += 4) R(i - 2, 5, 1, 1, "#9b6a14");
  ctx.restore();
}
function render(now) {
  const t = now / 1000; frameNo++;
  const sh = S.shake * 6, shx = Math.round((Math.random() - 0.5) * sh), shy = Math.round((Math.random() - 0.5) * sh);
  ctx.setTransform(1, 0, 0, 1, shx, shy); ctx.imageSmoothingEnabled = false;
  // 外圍岩壁
  const wall0 = TEX.walls[0].c;
  for (let y = -1; y * T < H + T; y++) for (let x = -1; x * T < W + T; x++) {
    const mx = Math.floor((x * T - OX) / T), my = Math.floor((y * T - OY) / T);
    const px = OX + mx * T, py = OY + my * T;
    const inside = mx >= 0 && my >= 0 && mx < MW && my < MW;
    const v = inside ? MAP[my][mx] : 1 + (((mx * 7 + my * 13) % 4) + 4) % 4;
    if (inside && v === 0) continue;
    ctx.drawImage(TEX.walls[v - 1].c, px, py);
  }
  ctx.fillStyle = "rgba(0,10,20,.55)"; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = "rgba(0,0,0,0)";
  for (let my = 0; my < MW; my++) for (let mx = 0; mx < MW; mx++) if (MAP[my][mx]) ctx.drawImage(TEX.walls[MAP[my][mx] - 1].c, wx2s(mx), wy2s(my));
  ctx.fillStyle = "rgba(0,10,20,.25)"; ctx.fillRect(wx2s(0), wy2s(0), MAPPX, MAPPX);
  // 沙地 5×5
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    ctx.drawImage(TEX.sand.c, wx2s(gx + 1), wy2s(gy + 1));
    if ((gx + gy) & 1) { ctx.fillStyle = "rgba(0,0,0,.07)"; ctx.fillRect(wx2s(gx + 1), wy2s(gy + 1), T, T); }
  }
  // 岩壁陰影（內側）
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(wx2s(1), wy2s(1), N * T, 4); ctx.fillRect(wx2s(1), wy2s(1), 4, N * T);
  // 水光（焦散）
  if (frameNo % 2 === 0) {
    const d = caustImg.data, n = N * T;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = caust(x / T, y / T, t), v = c > 0.25 ? (c - 0.25) * 150 : 0, i = (y * n + x) * 4;
      d[i] = 190; d[i + 1] = 240; d[i + 2] = 255; d[i + 3] = v;
    }
    cctx.putImageData(caustImg, 0, 0);
  }
  ctx.globalAlpha = 0.55; ctx.drawImage(caustC, wx2s(1), wy2s(1)); ctx.globalAlpha = 1;
  // 座標（刻在岩壁上）
  ctx.font = "bold 10px ui-monospace, Menlo, Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillText(String(i), wx2s(i + 1.5) + 1, wy2s(0.5) + 1); ctx.fillText(String(i), wx2s(0.5) + 1, wy2s(i + 1.5) + 1);
    ctx.fillStyle = "#cfe9f5"; ctx.fillText(String(i), wx2s(i + 1.5), wy2s(0.5)); ctx.fillText(String(i), wx2s(0.5), wy2s(i + 1.5));
  }
  ctx.fillStyle = "#ffc94a"; ctx.fillText("x", wx2s(6.5), wy2s(0.5)); ctx.fillText("y", wx2s(0.5), wy2s(6.5));
  // 海草（從岩壁長出來）
  for (let i = 0; i < 18; i++) {
    const side = i % 4, k = Math.floor(i / 4) + 0.3 + (i % 3) * 0.35, len = 6 + (i * 7) % 9;
    let bx, by, dx, dy;
    if (side === 0) { bx = 1 + k; by = 1; dx = 0; dy = 1; } else if (side === 1) { bx = 6; by = 1 + k; dx = -1; dy = 0; } else if (side === 2) { bx = 1 + k; by = 6; dx = 0; dy = -1; } else { bx = 1; by = 1 + k; dx = 1; dy = 0; }
    for (let s = 0; s < len; s++) {
      const sway = Math.sin(t * 1.6 + i + s * 0.35) * s * 0.18;
      ctx.fillStyle = s % 3 ? "#2f9a5c" : "#4cc27c";
      ctx.fillRect(Math.round(wx2s(bx) + dx * s + (dy ? sway : 0)), Math.round(wy2s(by) + dy * s + (dx ? sway : 0)), 2, 1);
    }
  }
  // 小魚（在黑暗下面）
  for (const f of S.fish) {
    ctx.save(); ctx.translate(Math.round(wx2s(f.x)), Math.round(wy2s(f.y))); ctx.rotate(f.a);
    ctx.drawImage(TEX.fish.c, -8, -5); ctx.restore();
  }
  // 潛艇
  const bumpOff = Math.sin(S.bump * Math.PI) * 0.22;
  const sx = wx2s(S.x + S.bumpDir[0] * bumpOff), sy = wy2s(S.y + S.bumpDir[1] * bumpOff) + Math.sin(t * 2) * 0.8;
  if (Math.random() < 0.5 && !S.boom) bubbles.push({ x: S.x - Math.cos(S.ang) * 0.55, y: S.y - Math.sin(S.ang) * 0.55, vx: rnd(-0.1, 0.1), vy: rnd(-0.1, 0.1), life: 1, r: Math.random() < 0.3 ? 2 : 1 });
  ctx.strokeStyle = "rgba(220,245,255,.75)"; ctx.lineWidth = 1;
  for (const b of bubbles) { ctx.globalAlpha = clamp(b.life, 0, 1); ctx.strokeRect(Math.round(wx2s(b.x)) + 0.5, Math.round(wy2s(b.y)) + 0.5, b.r, b.r); }
  ctx.globalAlpha = 1;
  if (!S.boom || now - S.boom < 120) drawSub(sx, sy, S.ang, t);
  // 黑暗：只有潛艇周圍和探照燈照得到
  dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = "source-over"; dctx.clearRect(0, 0, W, H);
  dctx.fillStyle = "rgba(0,4,10,.965)"; dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = "destination-out";
  const g1 = dctx.createRadialGradient(sx, sy, T * 0.35, sx, sy, T * 1.2); g1.addColorStop(0, "rgba(0,0,0,1)"); g1.addColorStop(1, "rgba(0,0,0,0)");
  dctx.fillStyle = g1; dctx.beginPath(); dctx.arc(sx, sy, T * 1.2, 0, 7); dctx.fill();
  const g2 = dctx.createRadialGradient(sx, sy, T * 0.4, sx, sy, T * 1.8); g2.addColorStop(0, "rgba(0,0,0,.55)"); g2.addColorStop(1, "rgba(0,0,0,0)");
  dctx.fillStyle = g2; dctx.beginPath(); dctx.moveTo(sx, sy); dctx.arc(sx, sy, T * 1.8, S.ang - 0.35, S.ang + 0.35); dctx.closePath(); dctx.fill();
  ctx.drawImage(dark, 0, 0);
  ctx.save(); ctx.globalAlpha = 0.6;
  // 座標（刻在岩壁上）
  ctx.font = "bold 10px ui-monospace, Menlo, Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < N; i++) {
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillText(String(i), wx2s(i + 1.5) + 1, wy2s(0.5) + 1); ctx.fillText(String(i), wx2s(0.5) + 1, wy2s(i + 1.5) + 1);
    ctx.fillStyle = "#cfe9f5"; ctx.fillText(String(i), wx2s(i + 1.5), wy2s(0.5)); ctx.fillText(String(i), wx2s(0.5), wy2s(i + 1.5));
  }
  ctx.fillStyle = "#ffc94a"; ctx.fillText("x", wx2s(6.5), wy2s(0.5)); ctx.fillText("y", wx2s(0.5), wy2s(6.5));
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g4 = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * 1.8); g4.addColorStop(0, "rgba(255,240,180,.08)"); g4.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = g4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, T * 1.8, S.ang - 0.3, S.ang + 0.3); ctx.closePath(); ctx.fill(); ctx.restore();
  // 珍珠（自己發光，在黑暗上面）
  for (const p of S.pearls) {
    const cx = wx2s(p.gx + 1.5), cy = wy2s(p.gy + 1.5), a = Math.min(1, (now - p.born) / 400);
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
    const R = 18 + Math.sin(t * 3 + p.ph) * 3, g = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy - 2, R);
    g.addColorStop(0, "rgba(255,245,210,.6)"); g.addColorStop(1, "rgba(255,245,210,0)"); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R - 2, R * 2, R * 2);
    ctx.globalCompositeOperation = "source-over"; ctx.drawImage(TEX.pearl.c, Math.round(cx - 16), Math.round(cy - 14)); ctx.restore();
  }
  // 海雪
  ctx.fillStyle = "rgba(210,235,255,.55)";
  for (const p of snow) { p.y += 0.0004 * p.z; p.x += 0.0002 * p.z; if (p.y > 1) p.y = 0; if (p.x > 1) p.x = 0; ctx.globalAlpha = 0.2 + p.z * 0.4; ctx.fillRect(Math.floor(p.x * W), Math.floor(p.y * H), 1, 1); }
  ctx.globalAlpha = 1;
  // 火花和碎片
  for (const d of debris) { ctx.globalAlpha = clamp(d.life, 0, 1); ctx.fillStyle = d.c; ctx.fillRect(Math.round(wx2s(d.x)), Math.round(wy2s(d.y)), d.s, d.s); }
  ctx.globalAlpha = 1;
  // 爆炸
  const bt = S.boom ? (now - S.boom) / 1000 : 9;
  if (bt < 1.2) {
    const R0 = 6 + bt * 70;
    ctx.strokeStyle = `rgba(200,240,255,${clamp(0.8 - bt, 0, 1)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, R0 * 1.4, 0, 7); ctx.stroke();
    for (const [col, k] of [["#7a1d0c", 1], ["#e2461f", 0.78], ["#ff9d2e", 0.55], ["#ffe27a", 0.32]]) {
      ctx.fillStyle = col; ctx.globalAlpha = clamp(1.25 - bt * 1.1, 0, 1);
      for (let a = 0; a < 6.28; a += 0.4) { const rr = Math.min(R0, 34) * k * (0.8 + 0.2 * Math.sin(a * 5 + bt * 20)); ctx.fillRect(Math.round(sx + Math.cos(a) * rr * 0.5 - rr * 0.4), Math.round(sy + Math.sin(a) * rr * 0.5 - rr * 0.4), Math.ceil(rr * 0.8), Math.ceil(rr * 0.8)); }
    }
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.flash > 0) { ctx.fillStyle = `rgba(255,${180 + 60 * S.flash},120,${S.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
  if (S.boom) { const k = clamp((now - S.boom - 800) / 800, 0, 1); ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
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
  if (S.pendingBump && Math.abs(da) < 0.2) {
    S.pendingBump = false; S.bump = 0.999; S.shake = Math.max(S.shake, 0.4); sfx.bump();
    for (let i = 0; i < 12; i++) debris.push({ x: S.gx + 1.5 + S.bumpDir[0] * 0.45, y: S.gy + 1.5 + S.bumpDir[1] * 0.45, vx: rnd(-0.8, 0.8) - S.bumpDir[0] * 0.6, vy: rnd(-0.8, 0.8) - S.bumpDir[1] * 0.6, life: rnd(0.4, 0.8), s: 1, c: "#c39b66" });
  }
  if (S.bump > 0 && !S.pendingBump) S.bump = Math.max(0, S.bump - dt * 3);
  S.shake *= Math.exp(-dt * 4); S.flash = Math.max(0, S.flash - dt * 2.2); S.fade = Math.max(0, S.fade - dt * 1.5);
  if (S.boom && now - S.boom > 1600 && now - (S.lastBoomRx || 0) > 1800) finishBoom();
  for (const f of S.fish) {
    f.a += Math.sin(now / 900 + f.sp * 10) * dt * 0.8;
    f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt;
    if (f.x < 1.2 || f.x > 5.8 || f.y < 1.2 || f.y > 5.8) { f.a += Math.PI; f.x = clamp(f.x, 1.2, 5.8); f.y = clamp(f.y, 1.2, 5.8); }
    if (Math.hypot(f.x - S.x, f.y - S.y) < 0.6) { f.a = Math.atan2(f.y - S.y, f.x - S.x); }
  }
  for (const b of bubbles) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt * 1.2; }
  while (bubbles.length && bubbles[0].life <= 0) bubbles.shift();
  for (const d of debris) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.vy *= 0.96; d.life -= dt * 1.1; }
  for (let i = debris.length - 1; i >= 0; i--) if (debris[i].life <= 0) debris.splice(i, 1);
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt, now); render(now); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function init() {
  buildTextures(); buildMap(); resize(); addEventListener("resize", resize);
  setStatus("off");
  $("connectBtn").onclick = () => (device && device.gatt.connected ? device.gatt.disconnect() : connect());
  $("soundBtn").onclick = () => { S.sound = !S.sound; $("soundBtn").textContent = S.sound ? "音效 開" : "音效 關"; };
  $("menuBtn").onclick = openMenu; $("backBtn").onclick = openMenu; $("againBtn").onclick = () => start(S.mode, S.demo);
  $("modeFree").onclick = () => start("free"); $("modeTime").onclick = () => start("time");
  $("modeDemo").onclick = () => start("free", true);
  updateModes();
  document.querySelectorAll(".pad button").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); command(b.dataset.c); }));
  const KEY = { ArrowUp: "f", ArrowDown: "b", ArrowLeft: "l", ArrowRight: "r", w: "f", s: "b", a: "l", d: "r" };
  addEventListener("keydown", (e) => {
    const c = KEY[e.key] || KEY[e.key.toLowerCase && e.key.toLowerCase()];
    if (c) { e.preventDefault(); if (!e.repeat) command(c); }
    if (e.key === "Escape") openMenu();
    if ((e.key === "x" || e.key === "X") && S.demo && $("menu").hidden && !S.boom) explode();
  });
  hud(); requestAnimationFrame(frame);
}
window.COCKPIT = { S, command, start, receive };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

// micro:bit 的 UART 和 Nordic 標準相反：6e400002 是 micro:bit 送出（indicate），6e400003 才是寫入。
// 依特性的屬性判斷哪個能寫，兩種韌體都能連。
async function nusChars(svc) {
  const a = await svc.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
  const b = await svc.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
  const canWrite = (c) => c.properties.write || c.properties.writeWithoutResponse;
  return canWrite(a) ? { rx: a, tx: b } : { rx: b, tx: a };
}

// 連上後再取服務；有些電腦會在剛連上時斷一下，所以重試。
// 找不到串口時，常見原因是平板還記著「上一個程式」的藍牙資料（快取），
// 所以先斷開、等一下再重連，讓平板重新讀一次。
async function nusService(device) {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
      await new Promise((r) => setTimeout(r, 300 + i * 400));
      if (!device.gatt.connected) throw new Error("disconnected");
      return await server.getPrimaryService(NUS);
    } catch (e) {
      last = e;
      if (/No Services matching|not found/i.test(String(e && e.message))) {
        try { device.gatt.disconnect(); } catch (_) {}
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        await new Promise((r) => setTimeout(r, 700));
      }
    }
  }
  const msg = String((last && last.message) || last);
  if (/disconnected|GATT Server/i.test(msg))
    throw new Error("micro:bit 一連上就斷線。請確認：① MakeCode 專案設定選「不需配對」後重新下載；② 到電腦或平板的藍牙設定，把這台 micro:bit 移除（忘記裝置）；③ 平板 App 已中斷連線。");
  if (/No Services matching|not found/i.test(msg))
    throw new Error("找不到藍牙串口。請依序試：① 關掉 micro:bit App（它可能還連著 micro:bit）；② 平板藍牙關掉再打開；③ 按 micro:bit 背面重設鈕，再按「連接」。都不行再確認程式有「藍牙串口服務」積木。");
  throw last;
}
