"use strict";

// 深海潛艇尋寶：平板是「上螢幕」，micro:bit 5×5 是「下螢幕」。
// micro:bit → 平板：l# r# u# d#（移動）、p#（聲納）
// 平板 → micro:bit：0#～4#（訊號強度，4 最近）、g#（找到寶藏）、e#（遊戲結束）
const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const COLS = 10, ROWS = 6, GAME_SECONDS = 120, PINGS = 3, MOVE_GAP = 180;
const $ = (id) => document.getElementById(id);
const canvas = $("sea"), ctx = canvas.getContext("2d");

let device = null, rxChar = null, txChar = null, inbox = "";
let sending = Promise.resolve();
const game = { running: false, sub: { x: 0, y: 0, face: 1 }, treasure: { x: 5, y: 3 }, score: 0, left: GAME_SECONDS,
  pings: PINGS, reveal: 0, ripple: 0, sparkle: 0, lastMove: 0, lastSignal: -1, timer: null };
const bubbles = Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 5, v: 0.0006 + Math.random() * 0.0012 }));
const weeds = Array.from({ length: 9 }, (_, i) => ({ x: (i + 0.5) / 9 + (Math.random() - 0.5) * 0.05, h: 0.12 + Math.random() * 0.12 }));

function log(text, cls) {
  const el = $("log"), line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = `[${new Date().toLocaleTimeString("zh-TW", { hour12: false })}] ${text}`;
  el.appendChild(line); el.scrollTop = el.scrollHeight;
  while (el.childNodes.length > 200) el.removeChild(el.firstChild);
}

function setStatus(state, name) {
  $("statusDot").className = "dot" + (state === "connected" ? " connected" : state === "connecting" ? " connecting" : "");
  $("statusText").textContent = state === "connected" ? `已連接 ${name || ""}` : state === "connecting" ? "連接中…" : "未連接";
  $("connectBtn").textContent = state === "connected" ? "中斷" : "連接 micro:bit";
  $("connectBtn").classList.toggle("disconnect", state === "connected");
  $("connectBtn").disabled = state === "connecting";
}

async function connect() {
  if (!navigator.bluetooth) return;
  try {
    setStatus("connecting");
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS_SERVICE_UUID] }], optionalServices: [NUS_SERVICE_UUID] });
    device.addEventListener("gattserverdisconnected", onDisconnected);
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(NUS_SERVICE_UUID);
    rxChar = await service.getCharacteristic(NUS_RX_CHAR_UUID);
    txChar = await service.getCharacteristic(NUS_TX_CHAR_UUID);
    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value)));
    setStatus("connected", device.name);
    log(`已連接 ${device.name || "micro:bit"}`);
    game.lastSignal = -1; sendSignal();
  } catch (err) {
    if (!err || err.name !== "NotFoundError") log(`連接失敗：${err.message || err}`, "err");
    setStatus("disconnected");
  }
}

function onDisconnected() { rxChar = null; txChar = null; setStatus("disconnected"); log("已中斷連接"); }

function send(word) {
  if (!rxChar) return;
  const data = new TextEncoder().encode(word + "#");
  sending = sending.then(async () => {
    try {
      if (rxChar.properties && rxChar.properties.writeWithoutResponse) await rxChar.writeValueWithoutResponse(data);
      else await rxChar.writeValue(data);
      log(`送出：${word}#`, "sent");
    } catch (err) { log(`送出失敗：${err.message || err}`, "err"); }
  });
}

// 收到的資料可能被切成好幾段，也可能一次好幾個指令：先累積再用 # 切開
function receive(chunk) {
  inbox += chunk;
  const parts = inbox.split(/[#\n]/);
  inbox = parts.pop();
  parts.map((s) => s.trim()).filter(Boolean).forEach((cmd) => { log(`收到：${cmd}#`, "recv"); command(cmd); });
}

function command(cmd) {
  if (!game.running) return;
  const c = cmd.toLowerCase();
  if ("lrud".includes(c) && c.length === 1) move(c);
  else if (c === "p") ping();
}

function move(c) {
  const now = performance.now();
  if (now - game.lastMove < MOVE_GAP) return;
  game.lastMove = now;
  const s = game.sub;
  if (c === "l") { s.x = Math.max(0, s.x - 1); s.face = -1; }
  if (c === "r") { s.x = Math.min(COLS - 1, s.x + 1); s.face = 1; }
  if (c === "u") s.y = Math.max(0, s.y - 1);
  if (c === "d") s.y = Math.min(ROWS - 1, s.y + 1);
  if (s.x === game.treasure.x && s.y === game.treasure.y) found();
  else sendSignal();
}

function ping() {
  if (game.pings <= 0) return;
  game.pings -= 1; game.reveal = performance.now() + 1000; game.ripple = performance.now();
  updateHud();
}

function signal() {
  const d = Math.abs(game.sub.x - game.treasure.x) + Math.abs(game.sub.y - game.treasure.y);
  return d <= 0 ? 4 : Math.max(0, 4 - Math.floor((d - 1) / 2));
}

function sendSignal() {
  const v = signal();
  $("signal").textContent = v;
  if (v !== game.lastSignal) { game.lastSignal = v; send(String(v)); }
}

function found() {
  game.score += 1; game.sparkle = performance.now();
  send("g");
  placeTreasure();
  game.lastSignal = -1;
  setTimeout(sendSignal, 600);
  updateHud();
}

function placeTreasure() {
  let x, y;
  do { x = Math.floor(Math.random() * COLS); y = Math.floor(Math.random() * ROWS); }
  while (Math.abs(x - game.sub.x) + Math.abs(y - game.sub.y) < 4);
  game.treasure = { x, y };
}

function updateHud() {
  $("score").textContent = game.score; $("time").textContent = game.left; $("pings").textContent = game.pings;
}

function start() {
  Object.assign(game, { running: true, sub: { x: 0, y: 0, face: 1 }, score: 0, left: GAME_SECONDS, pings: PINGS, reveal: 0, lastSignal: -1 });
  placeTreasure(); updateHud(); sendSignal();
  $("overlay").hidden = true;
  clearInterval(game.timer);
  game.timer = setInterval(() => {
    game.left -= 1; updateHud();
    if (game.left <= 0) stop();
  }, 1000);
}

function stop() {
  clearInterval(game.timer); game.running = false; send("e");
  $("ovTitle").textContent = `時間到！找到 ${game.score} 個寶藏`;
  $("ovText").innerHTML = "再玩一次，挑戰更高分！";
  $("startBtn").textContent = "再玩一次";
  $("overlay").hidden = false;
}

// ---------- 畫面 ----------
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
}

function cell() {
  const w = canvas.width, h = canvas.height;
  const size = Math.min(w / COLS, (h * 0.86) / ROWS);
  return { size, ox: (w - size * COLS) / 2, oy: h * 0.04 };
}

function drawSub(cx, cy, s, face) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(face, 1);
  ctx.fillStyle = "#ffcf3a"; ctx.strokeStyle = "#3a332e"; ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.38, s * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillRect(-s * 0.08, -s * 0.36, s * 0.16, s * 0.16); ctx.strokeRect(-s * 0.08, -s * 0.36, s * 0.16, s * 0.16);
  ctx.fillStyle = "#7fd3ff"; ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.02, s * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e98b2a"; ctx.beginPath(); ctx.moveTo(-s * 0.38, 0); ctx.lineTo(-s * 0.5, -s * 0.12); ctx.lineTo(-s * 0.5, s * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawChest(cx, cy, s, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy);
  ctx.fillStyle = "#a0622d"; ctx.strokeStyle = "#3a2410"; ctx.lineWidth = s * 0.04;
  ctx.fillRect(-s * 0.3, -s * 0.12, s * 0.6, s * 0.32); ctx.strokeRect(-s * 0.3, -s * 0.12, s * 0.6, s * 0.32);
  ctx.beginPath(); ctx.ellipse(0, -s * 0.12, s * 0.3, s * 0.14, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffd84a"; ctx.fillRect(-s * 0.05, -s * 0.08, s * 0.1, s * 0.14);
  ctx.restore();
}

function draw(t) {
  const w = canvas.width, h = canvas.height, { size, ox, oy } = cell();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#0b4a73"); g.addColorStop(1, "#03182b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // 海底與海草
  ctx.fillStyle = "#3c3222"; ctx.fillRect(0, h * 0.93, w, h * 0.07);
  weeds.forEach((wd, i) => {
    const x = wd.x * w, sway = Math.sin(t / 900 + i) * w * 0.006;
    ctx.strokeStyle = "#2f9e6a"; ctx.lineWidth = w * 0.006; ctx.beginPath();
    ctx.moveTo(x, h * 0.95); ctx.quadraticCurveTo(x + sway * 2, h * (0.95 - wd.h / 2), x + sway, h * (0.95 - wd.h)); ctx.stroke();
  });
  // 格線
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(ox + i * size, oy); ctx.lineTo(ox + i * size, oy + ROWS * size); ctx.stroke(); }
  for (let j = 0; j <= ROWS; j++) { ctx.beginPath(); ctx.moveTo(ox, oy + j * size); ctx.lineTo(ox + COLS * size, oy + j * size); ctx.stroke(); }
  // 泡泡
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  bubbles.forEach((b) => { b.y -= b.v; if (b.y < 0) { b.y = 1; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.r * (w / 900), 0, Math.PI * 2); ctx.fill(); });
  const C = (p) => ({ x: ox + (p.x + 0.5) * size, y: oy + (p.y + 0.5) * size });
  // 寶藏（只有聲納現身時看得到）
  const now = performance.now();
  if (game.running && now < game.reveal) drawChest(C(game.treasure).x, C(game.treasure).y, size, Math.min(1, (game.reveal - now) / 300));
  // 聲納波紋
  if (now - game.ripple < 1000) {
    const k = (now - game.ripple) / 1000, p = C(game.sub);
    ctx.strokeStyle = `rgba(120,230,255,${1 - k})`; ctx.lineWidth = size * 0.05;
    ctx.beginPath(); ctx.arc(p.x, p.y, k * size * 6, 0, Math.PI * 2); ctx.stroke();
  }
  // 找到寶藏的閃光
  if (now - game.sparkle < 900) {
    const k = (now - game.sparkle) / 900, p = C(game.sub);
    ctx.fillStyle = `rgba(255,216,74,${1 - k})`;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * k * size * 1.4, p.y + Math.sin(a) * k * size * 1.4, size * 0.07, 0, Math.PI * 2); ctx.fill(); }
  }
  const p = C(game.sub); drawSub(p.x, p.y + Math.sin(t / 400) * size * 0.03, size, game.sub.face);
  requestAnimationFrame(draw);
}

function init() {
  if (!navigator.bluetooth) { $("unsupportedBanner").hidden = false; $("connectBtn").disabled = true; }
  setStatus("disconnected");
  $("connectBtn").addEventListener("click", () => (device && device.gatt.connected ? device.gatt.disconnect() : connect()));
  $("startBtn").addEventListener("click", start);
  $("clearLogBtn").addEventListener("click", () => { $("log").innerHTML = ""; });
  // 沒有 micro:bit 時用鍵盤試玩
  window.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", " ": "p" }[e.key];
    if (k) { e.preventDefault(); command(k); }
  });
  window.addEventListener("resize", resize); resize(); updateHud();
  requestAnimationFrame(draw);
}

document.addEventListener("DOMContentLoaded", init);
