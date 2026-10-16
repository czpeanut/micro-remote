"use strict";
/*
 * 聲納尋寶 — 主題1 第七堂「聲納雷達」的連動遊戲（俯視角）
 *  micro:bit → 電腦：x:數字、y:數字、d:數字（藍牙串口 寫入值），找到寶藏時 found#
 *  電腦只負責「看」：潛艇跟著 micro:bit 的座標移動，雷達照 d 叫，海裡還有慢慢游的鯊魚
 *  沒有 micro:bit 時：方向鍵開潛艇，電腦自己藏寶藏
 */
const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const N = 10, MW = N + 2, START = [5, 5], RANGE = 10; // 10×10 海底，雷達範圍 10 格
const LO = 1.3, HI = MW - 1.3;
const FACE_ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // 北 東 南 西
const KEYMOVE = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
const beepGap = (d) => 0.12 + d * 0.16; // 距離越近，嗶聲間隔越短（秒）

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
  mode: null, running: false, score: 0, lives: 3, left: 90, timer: 0, sound: true,
  gx: START[0], gy: START[1], face: 0, x: START[0] + 1.5, y: START[1] + 1.5, ang: FACE_ANG[0],
  bump: 0, bumpDir: [0, 0], shake: 0, flash: 0, bite: 0, fade: 0,
  d: null, lastRx: 0, sim: { x: 0, y: 0 }, nextBeep: 0, rings: [], chests: [], sharks: [], fish: [],
};
const live = () => S.lastRx > 0 && performance.now() - S.lastRx < 3000;
let MAP = [];
function buildMap() {
  MAP = [];
  for (let y = 0; y < MW; y++) { const row = []; for (let x = 0; x < MW; x++) row.push(x === 0 || y === 0 || x === MW - 1 || y === MW - 1 ? 1 + ((x * 7 + y * 13) % 4) : 0); MAP.push(row); }
}
function hideSim() {
  for (let k = 0; k < 30; k++) { S.sim.x = Math.floor(Math.random() * N); S.sim.y = Math.floor(Math.random() * N); if (Math.abs(S.sim.x - S.gx) + Math.abs(S.sim.y - S.gy) >= 5) break; }
}
function spawnSharks(n) {
  S.sharks = [];
  for (let i = 0; i < n; i++) {
    let x, y; do { x = rnd(LO, HI); y = rnd(LO, HI); } while (Math.hypot(x - S.x, y - S.y) < 3);
    S.sharks.push({ x, y, a: rnd(0, 6.28), sp: rnd(0.22, 0.32), turn: 0, cool: 0, ph: rnd(0, 6) });
  }
}

/* ---------------- 藍牙 ---------------- */
let inbox = "";
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
    device.addEventListener("gattserverdisconnected", () => { rxChar = null; setStatus("off"); log("已中斷連接", "e"); });
    const svc = await (await device.gatt.connect()).getPrimaryService(NUS);
    const ch = await nusChars(svc); rxChar = ch.rx; const tx = ch.tx; await tx.startNotifications();
    tx.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value)));
    setStatus("on", device.name); log(`已連接 ${device.name || "micro:bit"}`);
    toast("連接成功！傾斜 micro:bit 開潛艇");
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
function receive(chunk) {
  inbox += chunk;
  const parts = inbox.split(/[#\r\n]+/); inbox = parts.pop(); if (inbox.length > 120) inbox = "";
  for (const raw of parts) {
    const msg = raw.trim(); if (!msg) continue;
    const m = msg.match(/^([a-zA-Z]+)\s*:\s*(-?[\d.]+)$/);
    S.lastRx = performance.now();
    if (m) {
      const k = m[1].toLowerCase(), v = Math.round(parseFloat(m[2]));
      if (k === "x") moveTo(clamp(v, 0, N - 1), S.gy);
      else if (k === "y") moveTo(S.gx, clamp(v, 0, N - 1));
    } else if (msg.toLowerCase() === "found") { log("收到 found#", "r"); found(); }
    else log(`收到 ${msg}#`, "r");
  }
}

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
  move() { noise(0.25, 0.08, 300); },
  bump() { tone(110, 45, 0.35, "sawtooth", 0.14); noise(0.2, 0.2, 500); },
  found() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f * 1.01, 0.28, "triangle", 0.16, i * 0.09)); },
  bite() { noise(0.5, 0.5, 600); tone(160, 60, 0.4, "sawtooth", 0.2); },
  end() { [784, 659, 523].forEach((f, i) => tone(f, f, 0.35, "triangle", 0.14, i * 0.16)); },
};

/* ---------------- 移動與事件 ---------------- */
function moveTo(nx, ny) {
  if (nx === S.gx && ny === S.gy) return;
  const dx = nx - S.gx, dy = ny - S.gy;
  S.face = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  S.gx = nx; S.gy = ny; hud();
  if (S.running && Math.random() < 0.5) sfx.move();
}
function keyMove(dx, dy) {
  audio();
  if (!$("menu").hidden || !$("endOv").hidden || !S.running) return;
  if (live()) { toast("micro:bit 已連線：傾斜 micro:bit 開潛艇"); return; }
  const nx = clamp(S.gx + dx, 0, N - 1), ny = clamp(S.gy + dy, 0, N - 1);
  if (nx === S.gx && ny === S.gy) { S.face = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0; S.bump = 1; S.bumpDir = [dx, dy]; S.pendingBump = true; return; }
  moveTo(nx, ny);
  S.d = Math.abs(S.gx - S.sim.x) + Math.abs(S.gy - S.sim.y);
  if (S.d === 0) { found(); hideSim(); S.d = Math.abs(S.gx - S.sim.x) + Math.abs(S.gy - S.sim.y); }
}
function found() {
  if (!S.running) return;
  S.score++; S.chests.push({ gx: S.gx, gy: S.gy, t: performance.now() }); if (S.chests.length > 6) S.chests.shift();
  S.flash = 0.6; sfx.found(); toast("找到寶藏！"); hud();
  for (let i = 0; i < 36; i++) { const a = rnd(0, 6.28), v = rnd(0.6, 2.4); debris.push({ x: S.gx + 1.5, y: S.gy + 1.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.6, 1.3), s: Math.random() < 0.4 ? 2 : 1, c: ["#ffd84a", "#fff3c4", "#ffb347"][i % 3] }); }
}
function bite(k) {
  S.lives--; S.bite = 1; S.shake = 1; S.safeUntil = performance.now() + 2500; sfx.bite(); hud();
  k.cool = performance.now() + 2500; k.a = Math.atan2(k.y - S.y, k.x - S.x); k.sp = 0.9;
  for (let i = 0; i < 14; i++) debris.push({ x: S.x, y: S.y, vx: rnd(-1.5, 1.5), vy: rnd(-1.5, 1.5), life: rnd(0.4, 0.9), s: 1, c: "#ff6f6f" });
  if (S.lives <= 0) finish("潛艇被鯊魚咬壞了！"); else toast("被鯊魚咬到了！");
}

/* ---------------- 流程 ---------------- */
function start(mode) {
  audio();
  S.mode = mode; S.running = true; S.score = 0; S.lives = 3; S.safeUntil = 0; S.left = 90; S.chests = []; S.rings = [];
  S.gx = START[0]; S.gy = START[1]; S.face = 0; S.x = START[0] + 1.5; S.y = START[1] + 1.5; S.ang = FACE_ANG[0]; S.fade = 1;
  hideSim(); if (!live()) S.d = Math.abs(S.gx - S.sim.x) + Math.abs(S.gy - S.sim.y);
  spawnSharks(mode === "time" ? 4 : 3);
  S.fish = []; for (let i = 0; i < 6; i++) S.fish.push({ x: rnd(LO, HI), y: rnd(LO, HI), a: rnd(0, 6.28), sp: rnd(0.3, 0.6) });
  $("menu").hidden = true; $("endOv").hidden = true; $("timeBox").hidden = mode !== "time";
  clearInterval(S.timer);
  if (mode === "time") S.timer = setInterval(() => { if (!S.running) return; S.left--; hud(); if (S.left <= 0) finish("時間到！"); }, 1000);
  hud(); toast(live() ? "傾斜 micro:bit，看 micro:bit 的雷達找寶藏！" : "方向鍵試玩：沒有雷達，只能碰運氣");
}
function finish(title) {
  if (!S.running) return;
  S.running = false; clearInterval(S.timer); sfx.end();
  $("endTitle").textContent = title; $("endScore").textContent = `${S.score} 個寶藏`;
  $("endText").textContent = S.lives > 0 ? `還剩 ${S.lives} 顆心。micro:bit 嗶得越快、長條越滿，寶藏就越近。` : "鯊魚游得很慢，看到附近有紅眼睛就先繞開。";
  $("endOv").hidden = false;
}
function openMenu() { S.running = false; clearInterval(S.timer); $("endOv").hidden = true; $("menu").hidden = false; }
function hud() {
  $("score").textContent = S.score; $("time").textContent = S.left;
  $("timeBox").classList.toggle("warn", S.left <= 10);
  $("lives").textContent = "♥".repeat(Math.max(0, S.lives)) + "♡".repeat(Math.max(0, 3 - S.lives));
  $("coord").textContent = `${S.gx}, ${S.gy}`;
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1500); }

const cv = $("view"), ctx = cv.getContext("2d");
const T = 32, MAPPX = MW * T;
let W = 420, H = 256, OX = 0, OY = 24;
const dark = document.createElement("canvas"), dctx = dark.getContext("2d");
const caustC = document.createElement("canvas"), cctx = caustC.getContext("2d");
let caustImg = null, frameNo = 0;
function resize() {
  const asp = innerWidth / Math.max(1, innerHeight);
  H = MAPPX + 62; W = clamp(Math.round(H * asp), 300, 900);
  cv.width = W; cv.height = H; dark.width = W; dark.height = H;
  OX = Math.round((W - MAPPX) / 2); OY = H - MAPPX - 6;
  ctx.imageSmoothingEnabled = false;
  caustC.width = N * T; caustC.height = N * T; caustImg = cctx.createImageData(N * T, N * T);
}
const wx2s = (x) => OX + x * T, wy2s = (y) => OY + y * T;
function caust(x, y, t) { return (Math.sin(x * 5.1 + t * 1.7) + Math.sin(y * 4.3 - t * 1.3) + Math.sin((x + y) * 3.7 + t)) / 3; }
const mv = {};
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
function drawMine(cx, cy, a, ghost, t, blink) {
  ctx.save(); ctx.globalAlpha = a;
  if (ghost) {
    // 隱約的輪廓：暗暗的影子加上斷續的邊和刺
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.arc(Math.round(cx), Math.round(cy), 9, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(150,195,220,.75)";
    for (let i = 0; i < 20; i++) { const an = (i / 20) * 6.28; if ((i + Math.floor(t * 5)) % 4 === 0) continue; ctx.fillRect(Math.round(cx + Math.cos(an) * 10), Math.round(cy + Math.sin(an) * 10), 1, 1); }
    for (let i = 0; i < 8; i++) { const an = (i / 8) * 6.28 + 0.2; ctx.fillRect(Math.round(cx + Math.cos(an) * 13), Math.round(cy + Math.sin(an) * 13), 2, 2); }
  } else {
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 5, 11, 7, 0, 0, 7); ctx.fill();
    ctx.drawImage(TEX.mine.c, 0, 0, 32, 32, Math.round(cx - 16), Math.round(cy - 16), 32, 32);
    if (!blink) { ctx.fillStyle = "#5a1410"; ctx.fillRect(Math.round(cx - 1), Math.round(cy - 12), 3, 3); }
    else { ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(cx, cy - 11, 0, cx, cy - 11, 9); g.addColorStop(0, "rgba(255,60,40,.9)"); g.addColorStop(1, "rgba(255,60,40,0)"); ctx.fillStyle = g; ctx.fillRect(cx - 9, cy - 20, 18, 18); }
  }
  ctx.restore();
}

function drawShark(k, t) {
  const cx = Math.round(wx2s(k.x)), cy = Math.round(wy2s(k.y)), sw = Math.sin(t * 3 + k.ph) * 0.25;
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(3, 5, 15, 7, k.a, 0, 7); ctx.fill();
  ctx.rotate(k.a);
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  ctx.save(); ctx.translate(-12, 0); ctx.rotate(sw); R(-8, -6, 4, 4, "#5d7482"); R(-8, 2, 4, 4, "#5d7482"); R(-6, -2, 6, 4, "#5d7482"); ctx.restore();
  R(-13, -4, 26, 8, "#1d2b33"); R(-10, -5, 20, 10, "#1d2b33"); R(14, -2, 3, 4, "#1d2b33");
  R(-12, -3, 25, 6, "#6f8796"); R(-9, -4, 18, 8, "#6f8796"); R(13, -1, 3, 2, "#6f8796");
  R(-9, -4, 18, 2, "#8ea6b3"); R(-3, -1, 6, 2, "#3e505b");
  R(-1, -9, 6, 5, "#5d7482"); R(-1, 4, 6, 5, "#5d7482");
  R(9, -3, 1, 1, "#111"); R(9, 2, 1, 1, "#111");
  ctx.restore();
}
function drawChest(cx, cy, age) {
  const x = Math.round(cx), y = Math.round(cy), open = Math.min(1, age * 3);
  const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  R(-11, -4, 22, 12, "#2b1606"); R(-10, -3, 20, 10, "#8a4f22"); R(-11, 0, 22, 2, "#ffd84a"); R(-2, -2, 4, 5, "#ffd84a");
  const lid = Math.round(-4 - open * 6); R(-11, lid - 5, 22, 6, "#2b1606"); R(-10, lid - 4, 20, 4, "#a0622d");
  if (open > 0.5) { R(-6, -6, 3, 3, "#fff3c4"); R(1, -7, 3, 3, "#ffd84a"); R(5, -5, 2, 2, "#fff3c4"); }
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
  ctx.fillStyle = "#ffc94a"; ctx.fillText("x", wx2s(MW - 0.5), wy2s(0.5)); ctx.fillText("y", wx2s(0.5), wy2s(MW - 0.5));
  // 海草（從岩壁長出來）
  for (let i = 0; i < 40; i++) {
    const side = i % 4, k = Math.floor(i / 4) + 0.3 + (i % 3) * 0.35, len = 6 + (i * 7) % 9;
    let bx, by, dx, dy;
    if (side === 0) { bx = 1 + k; by = 1; dx = 0; dy = 1; } else if (side === 1) { bx = MW - 1; by = 1 + k; dx = -1; dy = 0; } else if (side === 2) { bx = 1 + k; by = MW - 1; dx = 0; dy = -1; } else { bx = 1; by = 1 + k; dx = 1; dy = 0; }
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
  if (Math.random() < 0.5) bubbles.push({ x: S.x - Math.cos(S.ang) * 0.55, y: S.y - Math.sin(S.ang) * 0.55, vx: rnd(-0.1, 0.1), vy: rnd(-0.1, 0.1), life: 1, r: Math.random() < 0.3 ? 2 : 1 });
  ctx.strokeStyle = "rgba(220,245,255,.75)"; ctx.lineWidth = 1;
  for (const b of bubbles) { ctx.globalAlpha = clamp(b.life, 0, 1); ctx.strokeRect(Math.round(wx2s(b.x)) + 0.5, Math.round(wy2s(b.y)) + 0.5, b.r, b.r); }
  ctx.globalAlpha = 1;
  for (const k of S.sharks) drawShark(k, t);
  drawSub(sx, sy, S.ang, t);
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
  ctx.fillStyle = "#ffc94a"; ctx.fillText("x", wx2s(MW - 0.5), wy2s(0.5)); ctx.fillText("y", wx2s(0.5), wy2s(MW - 0.5));
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g4 = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * 1.8); g4.addColorStop(0, "rgba(255,240,180,.08)"); g4.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = g4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, T * 1.8, S.ang - 0.3, S.ang + 0.3); ctx.closePath(); ctx.fill(); ctx.restore();
  // 找到寶藏時，寶箱在潛艇的位置打開
  for (const c of S.chests) {
    const age = (now - c.t) / 1000; if (age > 2.2) continue;
    const cx = wx2s(c.gx + 1.5), cy = wy2s(c.gy + 1.5) - Math.min(age, 0.4) * 10, a = clamp(2.2 - age, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34); g.addColorStop(0, "rgba(255,215,90,.75)"); g.addColorStop(1, "rgba(255,215,90,0)"); ctx.fillStyle = g; ctx.fillRect(cx - 34, cy - 34, 68, 68);
    ctx.globalCompositeOperation = "source-over"; drawChest(cx, cy, age); ctx.restore();
  }
  // 鯊魚的眼睛：黑暗中也看得到兩個小紅點
  for (const k of S.sharks) {
    const ex = wx2s(k.x + Math.cos(k.a) * 0.32), ey = wy2s(k.y + Math.sin(k.a) * 0.32), px2 = -Math.sin(k.a) * 3, py2 = Math.cos(k.a) * 3;
    ctx.fillStyle = Math.sin(t * 3 + k.ph) > -0.7 ? "#ff5a3c" : "#7a1d0c";
    ctx.fillRect(Math.round(ex + px2), Math.round(ey + py2), 1, 1); ctx.fillRect(Math.round(ex - px2), Math.round(ey - py2), 1, 1);
  }
  // 海雪
  ctx.fillStyle = "rgba(210,235,255,.55)";
  for (const p of snow) { p.y += 0.0004 * p.z; p.x += 0.0002 * p.z; if (p.y > 1) p.y = 0; if (p.x > 1) p.x = 0; ctx.globalAlpha = 0.2 + p.z * 0.4; ctx.fillRect(Math.floor(p.x * W), Math.floor(p.y * H), 1, 1); }
  ctx.globalAlpha = 1;
  // 火花和碎片
  for (const d of debris) { ctx.globalAlpha = clamp(d.life, 0, 1); ctx.fillStyle = d.c; ctx.fillRect(Math.round(wx2s(d.x)), Math.round(wy2s(d.y)), d.s, d.s); }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 被鯊魚咬：紅色閃一下
  if (S.bite > 0) { ctx.fillStyle = `rgba(200,20,20,${S.bite * 0.45})`; ctx.fillRect(0, 0, W, H); }
  if (S.flash > 0) { ctx.fillStyle = `rgba(255,${180 + 60 * S.flash},120,${S.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
  if (S.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${S.fade})`; ctx.fillRect(0, 0, W, H); }
}


/* ---------------- 主迴圈 ---------------- */
let last = performance.now();
function update(dt, now) {
  const tx = S.gx + 1.5, ty = S.gy + 1.5, ta = FACE_ANG[S.face];
  let da = ta - S.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  S.ang += da * (1 - Math.exp(-dt * 9));
  const k = 1 - Math.exp(-dt * 6.5); S.x += (tx - S.x) * k; S.y += (ty - S.y) * k;
  if (S.pendingBump && Math.abs(da) < 0.2) {
    S.pendingBump = false; S.bump = 0.999; S.shake = Math.max(S.shake, 0.4); sfx.bump();
    for (let i = 0; i < 12; i++) debris.push({ x: S.gx + 1.5 + S.bumpDir[0] * 0.45, y: S.gy + 1.5 + S.bumpDir[1] * 0.45, vx: rnd(-0.8, 0.8) - S.bumpDir[0] * 0.6, vy: rnd(-0.8, 0.8) - S.bumpDir[1] * 0.6, life: rnd(0.4, 0.8), s: 1, c: "#c39b66" });
  }
  if (S.bump > 0 && !S.pendingBump) S.bump = Math.max(0, S.bump - dt * 3);
  S.shake *= Math.exp(-dt * 4); S.flash = Math.max(0, S.flash - dt * 2.2); S.fade = Math.max(0, S.fade - dt * 1.5); S.bite = Math.max(0, S.bite - dt * 1.6);
  // 鯊魚：慢慢游，偶爾轉彎，靠近潛艇時會慢慢跟過來
  for (const s of S.sharks) {
    const dist = Math.hypot(S.x - s.x, S.y - s.y);
    if (now > s.cool && dist < 1.6 && S.running) { const want = Math.atan2(S.y - s.y, S.x - s.x); let dd = want - s.a; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI; s.a += clamp(dd, -1, 1) * dt * 0.9; }
    else { s.turn += rnd(-1, 1) * dt; s.turn = clamp(s.turn, -0.6, 0.6); s.a += s.turn * dt; }
    s.sp += ((now < s.cool ? 0.6 : 0.27) - s.sp) * dt;
    s.x += Math.cos(s.a) * s.sp * dt; s.y += Math.sin(s.a) * s.sp * dt;
    if (s.x < LO || s.x > HI) { s.a = Math.PI - s.a; s.x = clamp(s.x, LO, HI); }
    if (s.y < LO || s.y > HI) { s.a = -s.a; s.y = clamp(s.y, LO, HI); }
    if (S.running && now > s.cool && now > (S.safeUntil || 0) && dist < 0.5) bite(s);
  }
  for (const f of S.fish) {
    f.a += Math.sin(now / 900 + f.sp * 10) * dt * 0.8;
    f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt;
    if (f.x < LO || f.x > HI || f.y < LO || f.y > HI) { f.a += Math.PI; f.x = clamp(f.x, LO, HI); f.y = clamp(f.y, LO, HI); }
    if (Math.hypot(f.x - S.x, f.y - S.y) < 0.6) f.a = Math.atan2(f.y - S.y, f.x - S.x);
  }
  for (const b of bubbles) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt * 1.2; }
  while (bubbles.length && bubbles[0].life <= 0) bubbles.shift();
  for (const d of debris) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.vy *= 0.96; d.life -= dt * 1.1; }
  for (let i = debris.length - 1; i >= 0; i--) if (debris[i].life <= 0) debris.splice(i, 1);
  if (now - (update.lastHud || 0) > 250) { update.lastHud = now; hud(); $("link").textContent = live() ? "micro:bit 傳送中" : rxChar ? "等待 micro:bit 資料…" : "方向鍵試玩"; }
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
  $("menuBtn").onclick = openMenu; $("backBtn").onclick = openMenu; $("againBtn").onclick = () => start(S.mode);
  $("modeFree").onclick = () => start("free"); $("modeTime").onclick = () => start("time");
  addEventListener("keydown", (e) => {
    const m = KEYMOVE[e.key] || KEYMOVE[e.key.toLowerCase && e.key.toLowerCase()];
    if (m) { e.preventDefault(); if (!e.repeat) keyMove(m[0], m[1]); }
    if (e.key === "Escape") openMenu();
  });
  hud(); requestAnimationFrame(frame);
}
window.SONAR = { S, start, receive, keyMove };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

// micro:bit 的 UART 和 Nordic 標準相反：6e400002 是 micro:bit 送出（indicate），6e400003 才是寫入。
// 依特性的屬性判斷哪個能寫，兩種韌體都能連。
async function nusChars(svc) {
  const a = await svc.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
  const b = await svc.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
  const canWrite = (c) => c.properties.write || c.properties.writeWithoutResponse;
  return canWrite(a) ? { rx: a, tx: b } : { rx: b, tx: a };
}
