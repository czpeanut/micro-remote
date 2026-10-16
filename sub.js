"use strict";
/*
 * 深海探險 — micro:bit 藍牙體感潛艇遊戲
 *  micro:bit → 電腦／平板：x:數字、y:數字（藍牙串口 寫入值），p#（聲納）；也接受 l# r# u# d#
 *  電腦／平板 → micro:bit：0#～4#（雷達強度，4 最近）、g#（找到）、e#（結束）
 */
const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const WW = 4200, VIEW_H = 900, SURFACE = 60;
const $ = (id) => document.getElementById(id);
const cv = $("sea"), ctx = cv.getContext("2d");
const light = document.createElement("canvas"), lctx = light.getContext("2d");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------- 世界 ----------------
function floorY(x) { return 1240 + 70 * Math.sin(x / 310) + 45 * Math.sin(x / 127 + 1.3) + 22 * Math.sin(x / 53 + 0.4); }
const rocks = [], weeds = [], farRocks = [], fish = [], snow = [], bubbles = [], sparks = [];
function buildWorld() {
  rocks.length = weeds.length = farRocks.length = fish.length = 0;
  for (let x = 380; x < WW - 200; x += rnd(260, 520)) rocks.push({ x, y: floorY(x) - rnd(10, 40), r: rnd(55, 110), seed: Math.random() });
  for (let i = 0; i < 5; i++) { const x = 700 + i * 720 + rnd(-120, 120); rocks.push({ x, y: rnd(520, 860), r: rnd(60, 95), seed: Math.random(), floating: true }); }
  for (let x = 40; x < WW; x += rnd(28, 70)) weeds.push({ x, h: rnd(60, 190), ph: rnd(0, 6), hue: rnd(0, 1) });
  for (let x = -200; x < WW + 400; x += rnd(160, 320)) farRocks.push({ x, h: rnd(160, 420), w: rnd(180, 360) });
  for (let s = 0; s < 6; s++) {
    const cx = rnd(300, WW - 300), cy = rnd(250, 1000), dir = Math.random() < 0.5 ? -1 : 1, col = ["#ffd166", "#7fe7ff", "#ff9f80", "#b9f27c"][s % 4];
    for (let i = 0; i < 9; i++) fish.push({ x: cx + rnd(-90, 90), y: cy + rnd(-50, 50), dir, sp: rnd(40, 70), ph: rnd(0, 6), col, size: rnd(10, 16) });
  }
  snow.length = 0; for (let i = 0; i < 140; i++) snow.push({ x: Math.random(), y: Math.random(), z: rnd(0.3, 1), v: rnd(4, 12) });
}

// ---------------- 遊戲狀態 ----------------
const S = {
  mode: null, running: false, score: 0, left: 0, pings: 3, lastSent: -1, timer: 0,
  sub: { x: 260, y: 300, vx: 0, vy: 0, face: 1, faceS: 1, prop: 0, hit: 0 },
  input: { rx: 0, ry: 0, sx: 0, sy: 0, last: 0, key: { x: 0, y: 0 }, pulse: 0 },
  cam: { x: 0, y: 0, shake: 0 }, pearls: [], treasure: null, reveal: 0, ripple: -9, invertY: false, sound: true,
};

function placePearls() {
  S.pearls = [];
  for (let i = 0; i < 16; i++) {
    const x = 500 + i * ((WW - 800) / 16) + rnd(-80, 80);
    const onFloor = Math.random() < 0.55;
    const y = onFloor ? floorY(x) - 34 : rnd(260, floorY(x) - 220);
    if (rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.r + 40)) { i--; continue; }
    S.pearls.push({ x, y, clam: onFloor, ph: rnd(0, 6), got: 0 });
  }
}
function placeTreasure() {
  let x, ok = false;
  for (let k = 0; k < 50 && !ok; k++) {
    x = rnd(500, WW - 300);
    ok = Math.abs(x - S.sub.x) > 900 && !rocks.some((r) => Math.abs(r.x - x) < r.r + 60);
  }
  S.treasure = { x, y: floorY(x) - 30, ph: 0 };
}

// ---------------- 藍牙 ----------------
let device = null, rxChar = null, inbox = "", sending = Promise.resolve();
function setStatus(st, name) {
  $("dot").className = "dot" + (st === "on" ? " on" : st === "wait" ? " wait" : "");
  $("status").textContent = st === "on" ? `已連接 ${name || ""}` : st === "wait" ? "連接中…" : "未連接";
  $("connectBtn").textContent = st === "on" ? "中斷連接" : "連接 micro:bit";
}
async function connect() {
  if (!navigator.bluetooth) return;
  try {
    setStatus("wait");
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }, { namePrefix: "BBC micro:bit" }], optionalServices: [NUS] });
    device.addEventListener("gattserverdisconnected", () => { rxChar = null; setStatus("off"); log("已中斷連接", "e"); });
    const svc = await nusService(device);
    const ch = await nusChars(svc); rxChar = ch.rx; const tx = ch.tx;
    await tx.startNotifications();
    tx.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value)));
    setStatus("on", device.name); log(`已連接 ${device.name || "micro:bit"}`);
    S.lastSent = -1;
  } catch (err) {
    if (!err || err.name !== "NotFoundError") log(`連接失敗：${err.message || err}`, "e");
    setStatus("off");
  }
}
function send(word) {
  if (!rxChar) return;
  const data = new TextEncoder().encode(word + "#");
  sending = sending.then(async () => {
    try {
      if (rxChar.properties && rxChar.properties.writeWithoutResponse) await rxChar.writeValueWithoutResponse(data);
      else await rxChar.writeValue(data);
      log(`送出 ${word}#`, "s");
    } catch (err) { log(`送出失敗 ${err.message || err}`, "e"); }
  });
}
let lastLogIn = 0;
function receive(chunk) {
  inbox += chunk;
  const parts = inbox.split(/[#\r\n]+/);
  inbox = parts.pop();
  for (const raw of parts) {
    const msg = raw.trim(); if (!msg) continue;
    const m = msg.match(/^([a-zA-Z]+)\s*:\s*(-?[\d.]+)$/);
    const now = performance.now();
    if (m) {
      const k = m[1].toLowerCase(), v = parseFloat(m[2]);
      if (k === "x") { S.input.rx = v; S.input.last = now; }
      else if (k === "y") { S.input.ry = v; S.input.last = now; }
      else if (k === "p") ping();
      if (now - lastLogIn > 600) { lastLogIn = now; log(`收到 x:${Math.round(S.input.rx)} y:${Math.round(S.input.ry)}`, "r"); }
    } else {
      const c = msg.toLowerCase(); log(`收到 ${c}#`, "r");
      if (c === "p") ping();
      else if ("lrud".includes(c) && c.length === 1) {
        S.input.rx = c === "l" ? -700 : c === "r" ? 700 : 0; S.input.ry = c === "u" ? 700 : c === "d" ? -700 : 0;
        S.input.last = now; S.input.pulse = now + 400;
      }
    }
  }
}
function log(t, cls) {
  const el = $("log"), d = document.createElement("div");
  if (cls) d.className = cls; d.textContent = t; el.appendChild(d);
  while (el.childNodes.length > 6) el.removeChild(el.firstChild);
}

// ---------------- 音效 ----------------
let ac = null;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
function tone(f1, f2, dur, type = "sine", vol = 0.18, delay = 0) {
  const a = audio(); if (!a || !S.sound) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  ping() { tone(1400, 380, 0.9, "sine", 0.22); tone(1400, 380, 0.9, "sine", 0.07, 0.35); },
  pearl() { tone(880, 1320, 0.18, "triangle", 0.16); tone(1320, 1760, 0.22, "triangle", 0.14, 0.09); },
  found() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, 0.3, "triangle", 0.16, i * 0.11)); },
  bump() { tone(120, 50, 0.35, "sawtooth", 0.12); },
  end() { [784, 659, 523].forEach((f, i) => tone(f, f, 0.35, "triangle", 0.14, i * 0.16)); },
};

// ---------------- 遊戲流程 ----------------
function start(mode) {
  audio();
  S.mode = mode; S.running = true; S.score = 0; S.pings = 3; S.lastSent = -1; S.reveal = 0; S.ripple = -9;
  S.left = mode === "drive" ? 90 : 120;
  Object.assign(S.sub, { x: 260, y: 300, vx: 0, vy: 0, face: 1, faceS: 1, hit: 0 });
  S.cam.x = 0; S.cam.y = 0;
  $("scoreLabel").textContent = mode === "drive" ? "珍珠" : "寶藏";
  $("pingBox").style.display = mode === "hunt" ? "" : "none";
  if (mode === "drive") { placePearls(); S.treasure = null; } else { S.pearls = []; placeTreasure(); }
  $("overlay").hidden = true; hud();
  clearInterval(S.timer);
  S.timer = setInterval(() => { if (!S.running) return; S.left -= 1; hud(); if (S.left <= 0) finish(); }, 1000);
  toast(mode === "drive" ? "駕駛訓練開始！" : "尋寶開始！看 micro:bit 的雷達");
}
function finish() {
  S.running = false; clearInterval(S.timer); send("e"); sfx.end();
  $("ovTitle").textContent = S.mode === "drive" ? `收集到 ${S.score} 顆珍珠！` : `找到 ${S.score} 個寶藏！`;
  $("ovSub").textContent = "再挑戰一次，或換另一個模式。";
  $("ovNote").textContent = "記得：傾斜要慢慢來，潛艇在水裡轉向很慢。";
  $("overlay").hidden = false;
}
function hud() {
  $("score").textContent = S.score; $("time").textContent = S.running ? S.left : "--"; $("pings").textContent = S.pings;
  $("timeBox").classList.toggle("warn", S.running && S.left <= 10);
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1400); }
function ping() {
  if (!S.running || S.mode !== "hunt" || S.pings <= 0) return;
  S.pings -= 1; S.ripple = performance.now(); S.reveal = performance.now() + 1600; sfx.ping(); hud();
}
function signal() {
  if (!S.treasure) return 0;
  const d = Math.hypot(S.sub.x - S.treasure.x, S.sub.y - S.treasure.y);
  return d < 200 ? 4 : d < 450 ? 3 : d < 780 ? 2 : d < 1180 ? 1 : 0;
}

// ---------------- 物理 ----------------
function update(dt, now) {
  const I = S.input, s = S.sub;
  // 輸入：micro:bit 超過 1.5 秒沒資料就當作放平；鍵盤可以試玩
  let tx = 0, ty = 0;
  if (now - I.last < 1500 && (now < I.pulse || I.pulse === 0 || now - I.last < 1500)) { tx = I.rx; ty = I.ry; }
  if (I.pulse && now > I.pulse && now - I.last > 300) { tx = 0; ty = 0; }
  if (I.key.x || I.key.y) { tx = I.key.x * 750; ty = I.key.y * 750; }
  const nx = clamp(tx / 750, -1, 1), ny = clamp(ty / 750, -1, 1);
  const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
  // 水的「不靈活」：輸入慢慢跟上
  const k = 1 - Math.exp(-dt * 2.4);
  I.sx += (dz(nx) - I.sx) * k; I.sy += (dz(ny) - I.sy) * k;
  if (!S.running) { I.sx *= 0.9; I.sy *= 0.9; }
  const dive = (S.invertY ? 1 : -1) * I.sy; // 往前傾（y 負）＝下潛
  s.vx += I.sx * 260 * dt; s.vy += dive * 190 * dt;
  s.vx -= s.vx * 0.85 * dt; s.vy -= s.vy * 1.25 * dt;
  s.vy += Math.sin(now / 900) * 6 * dt; // 微微浮沉
  const sp = Math.hypot(s.vx, s.vy); if (sp > 300) { s.vx *= 300 / sp; s.vy *= 300 / sp; }
  s.x += s.vx * dt; s.y += s.vy * dt;
  if (s.vx > 18) s.face = 1; else if (s.vx < -18) s.face = -1;
  s.faceS += (s.face - s.faceS) * (1 - Math.exp(-dt * 4));
  s.prop += (Math.abs(I.sx) * 18 + 2) * dt;
  // 邊界：水面、左右
  if (s.y < SURFACE + 30) { s.y = SURFACE + 30; s.vy = Math.abs(s.vy) * 0.3; }
  if (s.x < 80) { s.x = 80; s.vx = Math.abs(s.vx) * 0.4; }
  if (s.x > WW - 80) { s.x = WW - 80; s.vx = -Math.abs(s.vx) * 0.4; }
  // 海底與岩石碰撞
  let bumped = false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, px = s.x + Math.cos(a) * 66, py = s.y + Math.sin(a) * 30, fy = floorY(px);
    if (py > fy) { s.y -= py - fy; if (s.vy > 0) { if (s.vy > 60) bumped = true; s.vy = -s.vy * 0.35; } }
  }
  for (const r of rocks) {
    const dx = s.x - r.x, dy = (s.y - r.y) * 1.8, d = Math.hypot(dx, dy), min = r.r + 40;
    if (d < min && d > 0.01) {
      const nx2 = dx / d, ny2 = dy / d; s.x += nx2 * (min - d); s.y += (ny2 * (min - d)) / 1.8;
      const vn = s.vx * nx2 + s.vy * ny2;
      if (vn < 0) { if (vn < -60) bumped = true; s.vx -= 1.4 * vn * nx2; s.vy -= 1.4 * vn * ny2; }
    }
  }
  if (bumped && now - s.hit > 600) { s.hit = now; S.cam.shake = 14; sfx.bump(); if (S.running) toast("叩！撞到岩石了"); }
  // 收集
  if (S.running && S.mode === "drive") {
    for (const p of S.pearls) {
      if (!p.got && Math.hypot(p.x - s.x, p.y - s.y) < 85) {
        p.got = now; S.score += 1; hud(); sfx.pearl(); send("g"); burst(p.x, p.y, "#fff3c4");
        if (S.pearls.every((q) => q.got)) { toast("全部收集完成！"); placePearls(); }
      }
    }
  }
  if (S.running && S.mode === "hunt" && S.treasure) {
    const v = signal();
    if (v !== S.lastSent) { S.lastSent = v; send(String(v)); }
    if (Math.hypot(S.treasure.x - s.x, S.treasure.y - s.y) < 95) {
      S.score += 1; hud(); sfx.found(); send("g"); burst(S.treasure.x, S.treasure.y, "#ffd84a"); toast("找到寶藏！"); placeTreasure(); S.lastSent = -1;
    }
  }
  // 鏡頭
  const vw = cv.width / scale(), vh = VIEW_H;
  S.cam.x += (clamp(s.x - vw * 0.42 + s.vx * 0.6, 0, WW - vw) - S.cam.x) * (1 - Math.exp(-dt * 2.5));
  S.cam.y += (clamp(s.y - vh * 0.45, 0, 1400 - vh) - S.cam.y) * (1 - Math.exp(-dt * 2.5));
  S.cam.shake *= Math.exp(-dt * 6);
  // 氣泡
  if (Math.random() < Math.abs(I.sx) * 0.9 + 0.05) {
    const bx = s.x - s.faceS * 78, by = s.y + rnd(-6, 6);
    bubbles.push({ x: bx, y: by, vx: -s.faceS * rnd(20, 60), vy: rnd(-30, -10), r: rnd(2, 6), life: 1 });
  }
  for (const b of bubbles) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 40 * dt; b.vx *= 0.97; b.life -= dt * 0.5; }
  for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].life <= 0 || bubbles[i].y < SURFACE) bubbles.splice(i, 1);
  for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt * 1.4; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  for (const f of fish) {
    f.x += f.dir * f.sp * dt; f.ph += dt * 6;
    const d = Math.hypot(f.x - s.x, f.y - s.y); if (d < 220) { f.y += Math.sign(f.y - s.y) * 60 * dt; f.x += Math.sign(f.x - s.x) * 50 * dt; }
    if (f.x < -100) f.x = WW + 100; if (f.x > WW + 100) f.x = -100;
  }
}
function burst(x, y, col) { for (let i = 0; i < 26; i++) { const a = rnd(0, 6.28), v = rnd(60, 220); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col }); } }

// ---------------- 繪圖 ----------------
let dpr = 1;
function scale() { return cv.height / VIEW_H; }
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  light.width = cv.width; light.height = cv.height;
}
function W2S(x, y) { const k = scale(); return [(x - S.cam.x) * k, (y - S.cam.y) * k]; }

function drawSub(now) {
  const s = S.sub, k = scale(), [sx, sy] = W2S(s.x, s.y + Math.sin(now / 700) * 3);
  const pitch = clamp(s.vy / 320, -0.32, 0.32) * Math.sign(s.faceS || 1);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(pitch); ctx.scale(k * s.faceS, k);
  const lw = 3.5;
  // 尾翼
  ctx.fillStyle = "#e8932c"; ctx.strokeStyle = "#2b2420"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(-58, -4); ctx.lineTo(-86, -30); ctx.lineTo(-80, 0); ctx.lineTo(-86, 28); ctx.lineTo(-58, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 螺旋槳
  const pr = Math.sin(s.prop * 6);
  ctx.fillStyle = "#c9d6df"; ctx.beginPath(); ctx.ellipse(-92, 0, 5, 22 * Math.abs(pr) + 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 船身
  const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, "#ffe27a"); g.addColorStop(0.55, "#ffc433"); g.addColorStop(1, "#d7951c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 70, 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 塔
  ctx.beginPath(); ctx.roundRect(-14, -54, 34, 26, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#2b2420"; ctx.beginPath(); ctx.moveTo(10, -54); ctx.lineTo(10, -70); ctx.lineTo(22, -70); ctx.stroke();
  // 條紋與鉚釘
  ctx.strokeStyle = "rgba(120,70,10,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-46, -20); ctx.quadraticCurveTo(0, -30, 46, -20); ctx.stroke();
  ctx.fillStyle = "rgba(120,70,10,.5)"; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 14, 18, 2, 0, 6.3); ctx.fill(); }
  // 舷窗與庫丁狐
  for (const [px, pr2, fox] of [[-26, 11, false], [4, 11, false], [36, 15, true]]) {
    ctx.fillStyle = "#11364f"; ctx.strokeStyle = "#2b2420"; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(px, -2, pr2, 0, 6.3); ctx.fill(); ctx.stroke();
    if (fox) {
      ctx.fillStyle = "#e9792e"; ctx.beginPath(); ctx.moveTo(px - 9, 6); ctx.lineTo(px - 10, -12); ctx.lineTo(px - 3, -5); ctx.lineTo(px + 3, -5); ctx.lineTo(px + 10, -12); ctx.lineTo(px + 9, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff4e6"; ctx.beginPath(); ctx.moveTo(px - 6, 4); ctx.lineTo(px, 10); ctx.lineTo(px + 6, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(px - 4, -1, 1.6, 0, 6.3); ctx.arc(px + 4, -1, 1.6, 0, 6.3); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(px - pr2 * 0.35, -2 - pr2 * 0.35, pr2 * 0.3, 0, 6.3); ctx.fill();
  }
  // 探照燈
  ctx.fillStyle = "#fffbe0"; ctx.beginPath(); ctx.arc(68, 8, 6, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawRock(r, k) {
  const [x, y] = W2S(r.x, r.y), R = r.r * k;
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.1);
  g.addColorStop(0, "#3d5566"); g.addColorStop(1, "#16232d");
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = R * (0.82 + 0.18 * Math.sin(a * 3 + r.seed * 9)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(140,200,230,.18)"; ctx.lineWidth = 3 * k; ctx.stroke();
  ctx.restore();
}

function draw(now) {
  const k = scale(), w = cv.width, h = cv.height, cam = S.cam;
  const shx = (Math.random() - 0.5) * cam.shake * k, shy = (Math.random() - 0.5) * cam.shake * k;
  ctx.save(); ctx.translate(shx, shy);
  // 海水漸層（依鏡頭深度）
  const top = cam.y, bot = cam.y + VIEW_H;
  const col = (d) => { const t = clamp(d / 1400, 0, 1); return `rgb(${Math.round(lerp(22, 2, t))},${Math.round(lerp(120, 18, t))},${Math.round(lerp(170, 38, t))})`; };
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, col(top)); bg.addColorStop(1, col(bot));
  ctx.fillStyle = bg; ctx.fillRect(-20, -20, w + 40, h + 40);
  // 水面
  if (top < SURFACE + 40) {
    const [, sy] = W2S(0, SURFACE);
    ctx.fillStyle = "rgba(170,230,255,.25)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sy);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, sy + Math.sin(x / 60 + now / 500) * 5 * k);
    ctx.lineTo(w, 0); ctx.fill();
  }
  // 光束
  const rayA = clamp(1 - top / 700, 0, 1) * 0.12;
  if (rayA > 0.005) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const bx = ((i * 337 - cam.x * 0.3) % (w / k + 400) + (w / k + 400)) % (w / k + 400) - 200, sw = 40 + (i % 3) * 30, sway = Math.sin(now / 2500 + i) * 60;
      const gx = ctx.createLinearGradient(0, 0, 0, h); gx.addColorStop(0, `rgba(200,240,255,${rayA})`); gx.addColorStop(1, "rgba(200,240,255,0)");
      ctx.fillStyle = gx; ctx.beginPath(); ctx.moveTo(bx * k, 0); ctx.lineTo((bx + sw) * k, 0); ctx.lineTo((bx + sw + 220 + sway) * k, h); ctx.lineTo((bx + 160 + sway) * k, h); ctx.fill();
    }
    ctx.restore();
  }
  // 遠景岩壁（視差）
  ctx.fillStyle = "rgba(4,30,50,.55)";
  for (const r of farRocks) {
    const x = (r.x - cam.x * 0.45) * k, y = (1300 - cam.y * 0.7) * k;
    ctx.beginPath(); ctx.moveTo(x - r.w * k / 2, y); ctx.quadraticCurveTo(x - r.w * k / 4, y - r.h * k, x, y - r.h * k * 0.9); ctx.quadraticCurveTo(x + r.w * k / 4, y - r.h * k * 1.1, x + r.w * k / 2, y); ctx.fill();
  }
  // 魚群
  for (const f of fish) {
    const [x, y] = W2S(f.x, f.y + Math.sin(f.ph) * 6); if (x < -40 || x > w + 40) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(f.dir * k, k);
    ctx.fillStyle = f.col; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-f.size * 0.8, 0); ctx.lineTo(-f.size * 1.5, -f.size * 0.45 * (1 + 0.3 * Math.sin(f.ph * 2))); ctx.lineTo(-f.size * 1.5, f.size * 0.45); ctx.fill();
    ctx.restore();
  }
  // 海底
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let sx = 0; sx <= w + 10; sx += 10) { const wx = cam.x + sx / k; ctx.lineTo(sx, (floorY(wx) - cam.y) * k); }
  ctx.lineTo(w, h); ctx.closePath();
  const fg = ctx.createLinearGradient(0, (1150 - cam.y) * k, 0, h); fg.addColorStop(0, "#4a3f2c"); fg.addColorStop(1, "#1d170f");
  ctx.fillStyle = fg; ctx.fill();
  // 海草
  for (const wd of weeds) {
    const [x, y] = W2S(wd.x, floorY(wd.x)); if (x < -30 || x > w + 30) continue;
    const sway = Math.sin(now / 1100 + wd.ph) * 18 * k;
    ctx.strokeStyle = wd.hue > 0.5 ? "#2fa66a" : "#4cc28a"; ctx.lineWidth = 6 * k; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway, y - wd.h * k * 0.5, x + sway * 1.6, y - wd.h * k); ctx.stroke();
  }
  for (const r of rocks) drawRock(r, k);
  // 寶藏（要在黑暗之前畫：探照燈照到才看得見）
  if (S.mode === "hunt" && S.treasure) drawChest(S.treasure, k, 1);
  // 珍珠蚌（本體）
  for (const p of S.pearls) {
    if (!p.clam) continue; const [x, y] = W2S(p.x, p.y + 26);
    ctx.fillStyle = "#c58bbd"; ctx.beginPath(); ctx.ellipse(x, y, 30 * k, 12 * k, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#a96aa2"; ctx.beginPath(); ctx.ellipse(x, y - 4 * k, 30 * k, 10 * k, 0, Math.PI, 0); ctx.fill();
  }
  // 潛艇氣泡
  ctx.strokeStyle = "rgba(220,245,255,.6)"; ctx.lineWidth = 1.5 * k;
  for (const b of bubbles) { const [x, y] = W2S(b.x, b.y); ctx.globalAlpha = clamp(b.life, 0, 1); ctx.beginPath(); ctx.arc(x, y, b.r * k, 0, 6.3); ctx.stroke(); }
  ctx.globalAlpha = 1;
  drawSub(now);
  // ---- 黑暗與探照燈 ----
  const s = S.sub, [sx, sy] = W2S(s.x, s.y), dark = clamp((s.y - 250) / 900, 0, 1) * 0.86;
  if (dark > 0.02) {
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = "source-over"; lctx.clearRect(0, 0, w, h);
    lctx.fillStyle = `rgba(0,6,14,${dark})`; lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = "destination-out";
    const dir = Math.sign(s.faceS) || 1, cx = sx + dir * 60 * k, len = 520 * k;
    const g1 = lctx.createRadialGradient(cx, sy, 10 * k, cx, sy, len);
    g1.addColorStop(0, "rgba(0,0,0,1)"); g1.addColorStop(0.6, "rgba(0,0,0,.75)"); g1.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g1; lctx.beginPath(); lctx.moveTo(cx, sy);
    const pitch = clamp(s.vy / 320, -0.32, 0.32), a0 = (dir > 0 ? 0 : Math.PI) + pitch * dir;
    lctx.arc(cx, sy, len, a0 - 0.42, a0 + 0.42); lctx.closePath(); lctx.fill();
    const g2 = lctx.createRadialGradient(sx, sy, 0, sx, sy, 170 * k); g2.addColorStop(0, "rgba(0,0,0,.95)"); g2.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g2; lctx.beginPath(); lctx.arc(sx, sy, 170 * k, 0, 6.3); lctx.fill();
    // 聲納波掃過時，暫時照亮
    const pr = (now - S.ripple) / 1400;
    if (pr >= 0 && pr < 1) {
      const R = pr * 1400 * k, g3 = lctx.createRadialGradient(sx, sy, Math.max(0, R - 90 * k), sx, sy, R + 10);
      g3.addColorStop(0, "rgba(0,0,0,0)"); g3.addColorStop(0.7, `rgba(0,0,0,${0.7 * (1 - pr)})`); g3.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g3; lctx.beginPath(); lctx.arc(sx, sy, R + 10, 0, 6.3); lctx.fill();
    }
    ctx.drawImage(light, 0, 0);
    // 光錐的顏色
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g4 = ctx.createRadialGradient(cx, sy, 0, cx, sy, len * 0.8); g4.addColorStop(0, "rgba(255,240,180,.10)"); g4.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = g4; ctx.beginPath(); ctx.moveTo(cx, sy); ctx.arc(cx, sy, len * 0.8, a0 - 0.38, a0 + 0.38); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // 海雪（前景粒子）
  ctx.fillStyle = "rgba(220,240,255,.45)";
  for (const p of snow) {
    p.y += (p.v / VIEW_H) * 0.016; p.x += Math.sin(now / 2000 + p.z * 10) * 0.00005; if (p.y > 1) { p.y = 0; p.x = Math.random(); }
    const x = ((p.x * w - cam.x * k * p.z * 0.6) % w + w) % w, y = ((p.y * h - cam.y * k * p.z * 0.6) % h + h) % h;
    ctx.globalAlpha = 0.25 + p.z * 0.4; ctx.beginPath(); ctx.arc(x, y, p.z * 1.8 * dpr, 0, 6.3); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 發光珍珠（在黑暗之上）
  for (const p of S.pearls) {
    if (p.got && now - p.got > 400) continue;
    const [x, y] = W2S(p.x, p.y + Math.sin(now / 600 + p.ph) * (p.clam ? 0 : 8)), a = p.got ? 1 - (now - p.got) / 400 : 1;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 46 * k); g.addColorStop(0, "rgba(255,250,220,.9)"); g.addColorStop(0.3, "rgba(255,230,160,.35)"); g.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 46 * k, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, 6.3); ctx.fill();
  }
  // 聲納現形的寶藏
  if (S.mode === "hunt" && S.treasure && now < S.reveal) drawChest(S.treasure, k, clamp((S.reveal - now) / 500, 0, 1), true);
  // 聲納波紋
  const pr = (now - S.ripple) / 1400;
  if (pr >= 0 && pr < 1) {
    ctx.strokeStyle = `rgba(110,240,255,${0.8 * (1 - pr)})`; ctx.lineWidth = 4 * k;
    for (const off of [0, 0.12]) { const R = Math.max(0, pr - off) * 1400 * k; ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.3); ctx.stroke(); }
  }
  // 火花
  for (const p of sparks) { const [x, y] = W2S(p.x, p.y); ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, 4 * k, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawInstruments(k, w, h);
}

function drawChest(t, k, alpha, glow) {
  const [x, y] = W2S(t.x, t.y);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(k, k);
  if (glow) { ctx.save(); ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(0, -10, 0, 0, -10, 120); g.addColorStop(0, "rgba(255,210,80,.5)"); g.addColorStop(1, "rgba(255,210,80,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -10, 120, 0, 6.3); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = "#8a4f22"; ctx.strokeStyle = "#2b1606"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(-44, -22, 88, 46, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a0622d"; ctx.beginPath(); ctx.moveTo(-44, -22); ctx.quadraticCurveTo(0, -62, 44, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffd84a"; ctx.fillRect(-46, -6, 92, 7); ctx.fillRect(-8, -16, 16, 22);
  ctx.restore();
}

function drawInstruments(k, w, h) {
  const r = 58 * dpr, cx = w - r - 22 * dpr, cy = h - r - 22 * dpr, I = S.input;
  ctx.save();
  ctx.fillStyle = "rgba(6,28,46,.62)"; ctx.strokeStyle = "rgba(160,210,255,.25)"; ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(160,210,255,.15)"; ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  const tx = clamp((I.key.x ? I.key.x * 750 : I.rx) / 750, -1, 1), ty = clamp((I.key.y ? I.key.y * 750 : I.ry) / 750, -1, 1);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(cx + tx * r * 0.8, cy - ty * r * 0.8 * (S.invertY ? -1 : 1), 6 * dpr, 0, 6.3); ctx.fill();
  ctx.fillStyle = "#ffc94a"; ctx.beginPath(); ctx.arc(cx + I.sx * r * 0.8, cy - I.sy * r * 0.8 * (S.invertY ? -1 : 1), 9 * dpr, 0, 6.3); ctx.fill();
  ctx.fillStyle = "rgba(233,244,255,.8)"; ctx.font = `${12 * dpr}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("傾斜", cx, cy - r - 8 * dpr);
  // 尋寶模式：顯示和 micro:bit 一樣的雷達長條
  if (S.mode === "hunt") {
    const v = S.running ? signal() : 0, bx = cx - r * 2.9, by = cy + r * 0.6;
    ctx.fillText("雷達", bx + 50 * dpr, cy - r - 8 * dpr);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i < v + (v ? 1 : 0) ? "#ff5a5a" : "rgba(255,90,90,.18)"; ctx.fillRect(bx + i * 22 * dpr, by - (i + 1) * 18 * dpr, 16 * dpr, (i + 1) * 18 * dpr); }
  }
  ctx.restore();
  $("depth").textContent = Math.max(0, Math.round((S.sub.y - SURFACE) / 10));
}

// ---------------- 主迴圈 ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt, now); draw(now);
  requestAnimationFrame(frame);
}

function init() {
  buildWorld(); resize(); addEventListener("resize", resize);
  if (!navigator.bluetooth) { $("unsupported").hidden = false; $("connectBtn").disabled = true; }
  setStatus("off");
  $("connectBtn").onclick = () => (device && device.gatt.connected ? device.gatt.disconnect() : connect());
  $("modeDrive").onclick = () => start("drive");
  $("modeHunt").onclick = () => start("hunt");
  $("soundBtn").onclick = () => { S.sound = !S.sound; $("soundBtn").textContent = S.sound ? "音效 開" : "音效 關"; };
  $("invertY").onchange = (e) => { S.invertY = e.target.checked; };
  const keys = {};
  const upd = () => { S.input.key.x = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); S.input.key.y = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0); };
  addEventListener("keydown", (e) => {
    if (e.key === " ") { e.preventDefault(); ping(); return; }
    if (e.key.startsWith("Arrow")) { e.preventDefault(); keys[e.key] = true; upd(); }
  });
  addEventListener("keyup", (e) => { if (e.key.startsWith("Arrow")) { keys[e.key] = false; upd(); } });
  hud(); requestAnimationFrame(frame);
}
document.addEventListener("DOMContentLoaded", init);

// micro:bit 的 UART 和 Nordic 標準相反：6e400002 是 micro:bit 送出（indicate），6e400003 才是寫入。
// 依特性的屬性判斷哪個能寫，兩種韌體都能連。
async function nusChars(svc) {
  const a = await svc.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
  const b = await svc.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
  const canWrite = (c) => c.properties.write || c.properties.writeWithoutResponse;
  return canWrite(a) ? { rx: a, tx: b } : { rx: b, tx: a };
}

// 連上後再取服務；有些電腦會在剛連上時斷一下，所以重試三次。
async function nusService(device) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
      await new Promise((r) => setTimeout(r, 300 + i * 400));
      if (!device.gatt.connected) throw new Error("disconnected");
      return await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  const msg = String((last && last.message) || last);
  if (/disconnected|GATT Server/i.test(msg))
    throw new Error("micro:bit 一連上就斷線。請確認：① MakeCode 專案設定選「不需配對」後重新下載；② 到電腦或平板的藍牙設定，把這台 micro:bit 移除（忘記裝置）；③ 平板 App 已中斷連線。");
  if (/No Services matching|not found/i.test(msg))
    throw new Error("這台 micro:bit 沒有藍牙串口：程式要加「藍牙串口服務」，並用 bluetooth 擴展下載。");
  throw last;
}
