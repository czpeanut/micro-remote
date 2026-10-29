"use strict";
/*
 * 旋鈕賽車 — 主題2 第七堂
 *  micro:bit → 平板：k:旋鈕（0～1023）、b:按鍵（0 沒按、1 A 油門、2 B 煞車、3 C 氮氣、4 D、5 E）
 *  平板 → micro:bit：go#（開始）、lap#（跑完一圈）、end#（完賽）
 */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const cv = $("view"), g = cv.getContext("2d");
let W = 0, H = 0;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); layout(); }
addEventListener("resize", () => resize());

/* ---------- 賽道（世界座標 2400×1600），每條賽道一種風格 ---------- */
const WW = 2400, WH = 1600;
const TRACKS = [
  // 0 小島環道：草地小島、海邊
  [[300, 800], [350, 450], [600, 250], [1000, 220], [1300, 380], [1600, 250], [2000, 300], [2150, 600], [1950, 850], [2100, 1150], [1900, 1400], [1500, 1350], [1200, 1150], [900, 1350], [550, 1380], [350, 1150]],
  // 1 沙漠峽谷：長直線＋髮夾彎
  [[250, 300], [900, 250], [1500, 280], [2150, 250], [2220, 520], [1750, 620], [1250, 600], [1080, 800], [1400, 960], [2100, 950], [2200, 1300], [1800, 1420], [1100, 1380], [600, 1420], [250, 1250], [420, 900], [250, 600]],
  // 2 雪山連續彎：一路左右扭
  [[300, 1300], [300, 900], [550, 700], [400, 450], [600, 250], [900, 350], [1000, 650], [1250, 800], [1450, 550], [1350, 300], [1650, 200], [1950, 350], [2150, 650], [1900, 900], [2150, 1150], [1950, 1400], [1500, 1300], [1200, 1450], [800, 1300], [550, 1450]],
  // 3 夜光城市：街區直角彎
  [[300, 300], [700, 290], [1100, 300], [1110, 500], [1100, 700], [1300, 710], [1500, 700], [1510, 500], [1500, 300], [1800, 290], [2100, 300], [2110, 800], [2100, 1300], [1850, 1310], [1600, 1300], [1610, 1150], [1600, 1000], [1300, 990], [1000, 1000], [1010, 1150], [1000, 1300], [650, 1310], [300, 1300], [290, 800]],
];
const THEMES = [
  { name: "小島環道", sky: ["#3b8fe0", "#a6dcff"], fog: [0x9c, 0xd2, 0xf2], clouds: "#ffffffcc", hills: [["#7aa6c9", 0.5, 0.6, "round"], ["#3f8f4a", 0.28, 1, "round"]],
    ground: ["#4fa83e", "#58b546"], out: [0xff_c0_8e_3a, 0xff_c8_96_40], shoulder: "#e8d49a", kerb: ["#f4f4f4", "#d8352a"], road: ["#6c6c74", "#76767e"], line: "#ffffffaa", lineDash: [18, 22],
    scenery: [["palm", 0.45], ["tree", 0.4], ["flag", 0.15]], island: true },
  { name: "沙漠峽谷", sky: ["#e98a4a", "#ffe0a3"], fog: [0xf6, 0xd6, 0xa0], sun: "#fff3c4", hills: [["#c9784a", 0.42, 0.6, "mesa"], ["#a85a35", 0.22, 1, "mesa"]],
    ground: ["#dfb06c", "#e6b874"], out: [0xff_5a_9a_d0, 0xff_60_a2_d6], shoulder: "#c99a5b", kerb: ["#ffffff", "#e8762c"], road: ["#7d6b5c", "#86735f"], line: "#fff3c4aa", lineDash: [26, 26],
    scenery: [["cactus", 0.5], ["rock", 0.35], ["sign", 0.15]] },
  { name: "雪山連續彎", sky: ["#8db4e0", "#eef5fc"], fog: [0xe6, 0xef, 0xf8], snow: true, hills: [["#b8c9dc", 0.55, 0.6, "peak"], ["#f4f8fc", 0.3, 1, "peak"]],
    ground: ["#eef3f8", "#e4ecf4"], out: [0xff_f4_ec_e2, 0xff_fa_f2_ea], shoulder: "#cfdbe6", kerb: ["#ffffff", "#2f6fd6"], road: ["#69727e", "#737d8a"], line: "#ffffffcc", lineDash: [18, 22],
    scenery: [["pine", 0.75], ["snowman", 0.12], ["rock", 0.13]] },
  { name: "夜光城市", sky: ["#070a1e", "#2a2350"], fog: [0x26, 0x22, 0x46], stars: true, hills: [["#1a1838", 0.5, 0.6, "city"], ["#100f26", 0.3, 1, "city"]],
    ground: ["#1f2332", "#232838"], out: [0xff_2a_1e_18, 0xff_30_22_1c], shoulder: "#2b3044", kerb: ["#5fe1ff", "#ff4fd8"], road: ["#2f3446", "#353a4e"], line: "#ffd84acc", lineDash: [20, 24], neon: true,
    scenery: [["building", 0.55], ["lamp", 0.35], ["neon", 0.1]] },
];
let TH_ = THEMES[0];
const ROAD = 64;
let PTS = [], CUM = [], TOTAL = 0, view = { s: 1, ox: 0, oy: 0 };
function catmull(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0, 1].map((i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)); }
function buildTrack(i) {
  const c = TRACKS[i]; PTS = []; TH_ = THEMES[i] || THEMES[0];
  for (let k = 0; k < c.length; k++) { const p0 = c[(k - 1 + c.length) % c.length], p1 = c[k], p2 = c[(k + 1) % c.length], p3 = c[(k + 2) % c.length];
    for (let t = 0; t < 1; t += 1 / 24) PTS.push(catmull(p0, p1, p2, p3, t)); }
  CUM = [0]; for (let k = 1; k <= PTS.length; k++) { const a = PTS[k - 1], b = PTS[k % PTS.length]; CUM.push(CUM[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  TOTAL = CUM[PTS.length];
}
function layout() { if (typeof sizeBuf === "function") sizeBuf(); }
function nearest(x, y) { let bi = 0, bd = 1e9; for (let k = 0; k < PTS.length; k++) { const d = (PTS[k][0] - x) ** 2 + (PTS[k][1] - y) ** 2; if (d < bd) { bd = d; bi = k; } } return { i: bi, d: Math.sqrt(bd) }; }

/* ---------- 狀態 ---------- */
const S = { mode: null, running: false, knob: 512, btn: 0, car: null, lap: 0, laps: 3, lapT: 0, best: null, times: [], nitro: 3, boost: 0, count: 0, prog: 0, half: false,
  trail: [], rec: [], ghost: null, ghostT: 0, skid: [], t: 0, track: 0,
  lab: false, vmax: 1, steerK: 1, spin: 0, items: [], wasOff: false, lastLap: 0, labGhost: false };
const labFire = (ev, arg, it) => { if (S.lab && typeof LAB !== "undefined") LAB.fire(ev, arg, it); };
function bestKey() { return "race2-best-" + S.track; }
function loadBest() { try { const v = JSON.parse(localStorage.getItem(bestKey())); return v; } catch (e) { return null; } }
function saveBest(time, rec) { try { localStorage.setItem(bestKey(), JSON.stringify({ time, rec })); } catch (e) {} }

/* ---------- 輸入 ---------- */
MB.on((ev) => { if (ev.key === "k") setKnob(ev.value); if (ev.key === "b") setBtn(Math.round(ev.value)); });
function setKnob(v) { S.knob = clamp(v, 0, 1023); $("knob").textContent = Math.round(S.knob); $("wheel").style.transform = `rotate(${(S.knob - 512) / 512 * 135}deg)`; }
function setBtn(b) {
  if (b === 3 && S.btn !== 3) useNitro();
  if ((b === 4 || b === 5) && S.btn !== b && S.running && S.count <= 0) labFire("key", b === 4 ? "d" : "e");
  S.btn = b; for (let i = 1; i <= 5; i++) $("k" + i).classList.toggle("on", b === i);
}
const keys = {};
addEventListener("keydown", (e) => { if (!e.repeat && (e.key === "d" || e.key === "e") && !MB.live() && S.running && S.count <= 0) labFire("key", e.key); keys[e.key] = true; if (e.key === " ") { e.preventDefault(); if (!MB.live()) useNitro(); } });
addEventListener("keyup", (e) => { keys[e.key] = false; });
function useNitro() { if (!S.running || S.count > 0 || S.nitro <= 0 || S.boost > 0) return; S.nitro--; S.boost = 1.6; SFX.noise(0.9, 0.25, 900); hudNitro(); }
function hudNitro() { $("nitro").textContent = "●".repeat(Math.min(9, S.nitro)) + "○".repeat(Math.max(0, 3 - S.nitro)); }

/* ---------- 流程 ---------- */
function start(mode) {
  S.track = +document.querySelector("input[name=track]:checked").value; buildTrack(S.track); buildTexture(); camInit = false;
  const p = PTS[0], q = PTS[3];
  S.car = { x: p[0], y: p[1], a: Math.atan2(q[1] - p[1], q[0] - p[0]), v: 0 };
  Object.assign(S, { mode, running: true, lap: 0, lapT: 0, times: [], nitro: 3, boost: 0, count: 3, prog: 0, half: false, rec: [], skid: [], t: 0 });
  S.laps = mode === "free" || mode === "lab" ? Infinity : 3;
  const b = loadBest(); S.best = b ? b.time : null; S.ghost = (mode === "ghost" || (mode === "lab" && S.labGhost)) && b ? b.rec : null; S.ghostT = 0;
  if (mode === "ghost" && !b) toast("還沒有紀錄，先跑一圈當幽靈車！");
  $("menu").hidden = true; $("endOv").hidden = true; hudNitro(); hud(); SFX.audio();
}
function hud() {
  $("lap").textContent = S.laps === Infinity ? `${S.lap}` : `${Math.min(S.lap + 1, S.laps)}/${S.laps}`;
  $("cur").textContent = S.lapT.toFixed(1); $("best").textContent = S.best ? S.best.toFixed(2) : "--";
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1500); }
function lapDone() {
  const t = S.lapT; S.times.push(t); if (!S.lab) MB.send("lap"); S.lastLap = Math.round(t * 100) / 100;
  const nb = !S.best || t < S.best;
  if (nb) { S.best = t; saveBest(t, S.rec); toast(`新紀錄！${t.toFixed(2)} 秒`); [523, 659, 784, 1046].forEach((f, i) => SFX.tone(f, f, 0.2, "triangle", 0.14, i * 0.08)); }
  else { toast(`第 ${S.lap + 1} 圈 ${t.toFixed(2)} 秒`); SFX.tone(880, 880, 0.15, "triangle", 0.12); }
  S.lap++; S.lapT = 0; S.rec = []; S.ghostT = 0;
  labFire("lap");
  if (S.lap >= S.laps) {
    S.running = false; MB.send("end");
    $("endTitle").textContent = "完賽！"; $("endText").textContent = S.times.map((x, i) => `第 ${i + 1} 圈 ${x.toFixed(2)} 秒`).join("　");
    $("endScore").textContent = `最快 ${Math.min(...S.times).toFixed(2)} 秒`; setTimeout(() => { $("endOv").hidden = false; }, 700);
  }
  hud();
}

/* ---------- 物理 ---------- */
let engine = null;
function engineSound(v) {
  const a = SFX.audio(); if (!a) return;
  if (!engine) { const o = a.createOscillator(), gn = a.createGain(), f = a.createBiquadFilter(); o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 600; gn.gain.value = 0; o.connect(f).connect(gn).connect(a.destination); o.start(); engine = { o, gn }; }
  engine.o.frequency.value = 50 + v * 0.55; engine.gn.gain.value = SFX.on && S.running ? 0.03 + Math.min(0.05, v / 6000) : 0;
}
function update(dt) {
  S.t += dt;
  if (!MB.live()) {
    let k = S.knob; if (keys.ArrowLeft) k -= dt * 900; else if (keys.ArrowRight) k += dt * 900; else k += (512 - k) * Math.min(1, dt * 4); setKnob(k);
    const b = keys.ArrowUp ? 1 : keys.ArrowDown ? 2 : 0; if (b !== S.btn) setBtn(b);
  }
  const c = S.car; if (!c) return;
  engineSound(Math.abs(c.v));
  if (!S.running) { c.v *= 0.95; return; }
  if (S.count > 0) { const before = Math.ceil(S.count); S.count -= dt; const after = Math.ceil(S.count);
    if (after !== before) { if (after > 0) SFX.tone(600, 600, 0.15, "square", 0.1); else { SFX.tone(1200, 1200, 0.3, "square", 0.12); if (S.lab) labFire("go"); else MB.send("go"); } } return; }
  S.lapT += dt; S.boost = Math.max(0, S.boost - dt);
  const n = nearest(c.x, c.y), off = n.d > ROAD / 2;
  const top = 300 * S.vmax * (S.boost > 0 ? 1.45 : 1), maxV = off ? Math.min(top, 110) : top;
  if (off && !S.wasOff) labFire("off"); S.wasOff = off;
  // 平滑的速度曲線：越接近極速加得越慢；放開油門慢慢滑行減速；不會倒退
  if (S.btn === 1 || S.boost > 0) { const room = Math.max(0, 1 - c.v / maxV); c.v += (S.boost > 0 ? 420 : 230) * Math.pow(room, 0.6) * dt; }
  else if (S.btn === 2) c.v -= (240 + c.v * 0.5) * dt;
  else c.v -= (14 + c.v * 0.22) * dt;
  if (c.v > maxV) c.v -= (c.v - maxV) * 2.2 * dt;   // 開出跑道或氮氣結束：慢慢降回去，不會突然停
  c.v = Math.max(0, c.v);
  const steerRaw = (S.knob - 512) / 512; S.steerS = (S.steerS || 0) + (steerRaw - (S.steerS || 0)) * Math.min(1, dt * 8);
  const steer = S.steerS;
  c.a += steer * 2.4 * S.steerK * dt * clamp(c.v / 150, 0, 1) * (1 - 0.25 * clamp((c.v - 200) / 200, 0, 1));
  if (S.spin > 0) { S.spin -= dt; c.a += 9 * dt; c.v *= Math.pow(0.3, dt); }
  if (S.lab) for (const it of S.items) { if (it.dead) continue; it.cool = Math.max(0, (it.cool || 0) - dt); if (it.cool <= 0 && Math.hypot(it.x - c.x, it.y - c.y) < 18) { it.cool = 1; labFire("item", it.kind, it); } }
  if (S.lab) S.items = S.items.filter((it) => !it.dead);
  c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
  c.x = clamp(c.x, 10, WW - 10); c.y = clamp(c.y, 10, WH - 10);
  if (Math.abs(steer) > 0.6 && c.v > 220) S.skid.push({ x: c.x, y: c.y, life: 3 });
  S.skid = S.skid.filter((s) => (s.life -= dt) > 0).slice(-200);
  S.rec.push([c.x, c.y, c.a]);
  // 圈數：沿著賽道前進才算
  const prog = CUM[n.i] / TOTAL;
  if (prog > 0.45 && prog < 0.55) S.half = true;
  if (S.half && S.prog > 0.9 && prog < 0.1) { S.half = false; lapDone(); }
  S.prog = prog;
  if (S.ghost) S.ghostT += 1;
  $("spd").textContent = Math.round(c.v / 3); $("cur").textContent = S.lapT.toFixed(1);
}

/* ---------- 畫面：2D 仿 3D（Mode 7）第三人稱 ---------- */
const TS = 1, TW = WW * TS, TH = WH * TS;
let TEX = null, SCN = [];
function buildTexture() {
  const T = TH_, c = document.createElement("canvas"); c.width = TW; c.height = TH; const t = c.getContext("2d"); t.scale(TS, TS);
  let seed = 11; const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const path = () => { t.beginPath(); PTS.forEach((p, i) => (i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.closePath(); };
  t.lineJoin = t.lineCap = "round";
  // 地面
  if (T.island) {
    t.fillStyle = "#3a8ec0"; t.fillRect(0, 0, WW, WH);
    for (let k = 0; k < 900; k++) { t.fillStyle = r() < 0.5 ? "#4a9ed0" : "#3283b4"; t.fillRect(r() * WW, r() * WH, 30 + r() * 60, 3); }
    path(); t.strokeStyle = "#e8d49a"; t.lineWidth = ROAD + 700; t.stroke(); path(); t.fillStyle = "#e8d49a"; t.fill();
    t.save(); path(); t.clip(); t.restore();
    path(); t.strokeStyle = "#58b546"; t.lineWidth = ROAD + 620; t.stroke(); path(); t.fillStyle = "#58b546"; t.fill();
    for (let k = 0; k < 2500; k++) { t.fillStyle = r() < 0.5 ? "#4fa83e" : "#62bf50"; const x = r() * WW, y = r() * WH; t.fillRect(x, y, 18, 18); }
  } else {
    t.fillStyle = T.ground[0]; t.fillRect(0, 0, WW, WH);
    for (let k = 0; k < 3000; k++) { t.fillStyle = r() < 0.5 ? T.ground[1] : T.ground[0]; const x = r() * WW, y = r() * WH, w = 10 + r() * 40; t.fillRect(x, y, w, w * (T.name === "沙漠峽谷" ? 0.3 : 1)); }
    if (T.name === "沙漠峽谷") for (let k = 0; k < 160; k++) { t.strokeStyle = "#c99654"; t.lineWidth = 3; const x = r() * WW, y = r() * WH; t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + 40, y - 14, x + 90, y); t.stroke(); }
    if (T.name === "雪山連續彎") for (let k = 0; k < 400; k++) { t.fillStyle = "#cfdcea"; t.beginPath(); t.ellipse(r() * WW, r() * WH, 20 + r() * 30, 6 + r() * 6, 0, 0, 7); t.fill(); }
    if (T.neon) { t.strokeStyle = "#2c3350"; t.lineWidth = 4; for (let x = 0; x < WW; x += 120) { t.beginPath(); t.moveTo(x, 0); t.lineTo(x, WH); t.stroke(); } for (let y = 0; y < WH; y += 120) { t.beginPath(); t.moveTo(0, y); t.lineTo(WW, y); t.stroke(); }
      for (let k = 0; k < 500; k++) { t.fillStyle = r() < 0.3 ? "#ffd84a55" : "#5fe1ff22"; t.fillRect(r() * WW, r() * WH, 6, 6); } }
  }
  // 跑道
  path(); t.strokeStyle = T.shoulder; t.lineWidth = ROAD + 44; t.stroke();
  path(); t.strokeStyle = T.kerb[0]; t.lineWidth = ROAD + 14; t.stroke();
  path(); t.strokeStyle = T.kerb[1]; t.setLineDash([14, 14]); t.lineWidth = ROAD + 14; t.stroke(); t.setLineDash([]);
  path(); t.strokeStyle = T.road[0]; t.lineWidth = ROAD; t.stroke();
  path(); t.strokeStyle = T.road[1]; t.lineWidth = ROAD - 20; t.stroke();
  if (T.neon) { path(); t.strokeStyle = "#5fe1ff"; t.lineWidth = ROAD + 2; t.globalAlpha = 0.5; t.stroke(); t.globalAlpha = 1; path(); t.strokeStyle = T.road[0]; t.lineWidth = ROAD - 4; t.stroke(); path(); t.strokeStyle = T.road[1]; t.lineWidth = ROAD - 20; t.stroke(); }
  path(); t.strokeStyle = T.line; t.setLineDash(T.lineDash); t.lineWidth = 2.5; t.stroke(); t.setLineDash([]);
  const p0 = PTS[0], p1 = PTS[1], ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  t.save(); t.translate(p0[0], p0[1]); t.rotate(ang + Math.PI / 2);
  for (let i = -4; i < 4; i++) for (let j = 0; j < 2; j++) { t.fillStyle = (i + j) % 2 ? "#fff" : "#111"; t.fillRect(i * 8, j * 8 - 8, 8, 8); }
  t.restore();
  TEX = new Uint32Array(t.getImageData(0, 0, TW, TH).data.buffer);
  // 路邊的看板（依賽道風格）
  SCN = []; seed = 7;
  const pick = () => { let x = r(), acc = 0; for (const [k, w] of T.scenery) { acc += w; if (x < acc) return k; } return T.scenery[0][0]; };
  for (let k = 0; k < PTS.length; k += 4) for (const side of [-1, 1]) {
    if (r() < 0.35) continue;
    const kind = pick(), far = kind === "building" ? 90 + r() * 140 : 30 + r() * 60;
    const a = PTS[k], b = PTS[(k + 1) % PTS.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const off = ROAD / 2 + far, x = a[0] - dy / L * off * side, y = a[1] + dx / L * off * side;
    if (x < 15 || y < 15 || x > WW - 15 || y > WH - 15 || nearest(x, y).d < ROAD / 2 + (kind === "building" ? 70 : 22)) continue;
    SCN.push({ x, y, kind, c: r(), h: 0.7 + r() * 0.8 });
  }
  for (const side of [-1, 1]) { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy); SCN.push({ x: p0[0] - dy / L * (ROAD / 2 + 14) * side, y: p0[1] + dx / L * (ROAD / 2 + 14) * side, kind: "post" }); }
}
const buf = document.createElement("canvas"), bg2 = buf.getContext("2d"); let RW = 320, RH = 200, IMG = null, PIX = null;
const CAM = { x: 0, y: 0, a: 0, h: 30, d: 80, f: 260 };
function sizeBuf() { RW = 320; RH = Math.max(150, Math.round(RW * H / Math.max(1, W))); buf.width = RW; buf.height = RH; IMG = bg2.createImageData(RW, RH); PIX = new Uint32Array(IMG.data.buffer); CAM.f = RW * 0.8; }
function horizon() { return Math.round(RH * 0.36); }
function renderFloor() {
  const hz = horizon(), ca = Math.cos(CAM.a), sa = Math.sin(CAM.a), f = CAM.f;
  for (let y = hz + 1; y < RH; y++) {
    const z = CAM.h * f / (y - hz), fog = clamp((z - 260) / 520, 0, 1), inv = 1 - fog;
    const FOG = TH_.fog, fr = FOG[0] * fog, fg = FOG[1] * fog, fb = FOG[2] * fog, O = TH_.out;
    const cx = CAM.x + ca * z, cy = CAM.y + sa * z, k = z / f; // 右方向 (-sin, cos)
    let wx = cx - (-sa) * k * RW / 2, wy = cy - ca * k * RW / 2; const sx = -sa * k, sy = ca * k;
    let o = y * RW;
    for (let x = 0; x < RW; x++, wx += sx, wy += sy) {
      let col;
      if (wx >= 0 && wy >= 0 && wx < WW && wy < WH) col = TEX[((wy * TS) | 0) * TW + ((wx * TS) | 0)];
      else col = (((Math.floor(wx / 60) + Math.floor(wy / 60)) & 1) ? O[0] : O[1]);
      if (fog > 0) { const rr = (col & 255) * inv + fr, gg = ((col >> 8) & 255) * inv + fg, bb = ((col >> 16) & 255) * inv + fb; col = 0xff000000 | (bb << 16) | (gg << 8) | rr; }
      PIX[o++] = col;
    }
  }
  bg2.putImageData(IMG, 0, 0, 0, hz, RW, RH - hz);
}
function project(wx, wy) { const dx = wx - CAM.x, dy = wy - CAM.y, ca = Math.cos(CAM.a), sa = Math.sin(CAM.a); const z = dx * ca + dy * sa, xr = -dx * sa + dy * ca; if (z < 8) return null;
  return { z, x: RW / 2 + xr * CAM.f / z, y: horizon() + CAM.h * CAM.f / z, s: CAM.f / z }; }
function ridge(kind, u) {
  if (kind === "mesa") { const v = Math.sin(u * 3) * 0.5 + Math.sin(u * 7 + 1) * 0.3 + Math.sin(u * 2.3) * 0.2; return v > 0.15 ? 0.9 : v > -0.2 ? 0.55 : 0.25; }
  if (kind === "peak") { const v = 1 - Math.abs(Math.sin(u * 4)) ; return 0.25 + 0.75 * Math.pow(Math.abs(Math.sin(u * 4 + 0.5) * 0.6 + Math.sin(u * 9) * 0.4), 0.8) * (0.6 + 0.4 * v); }
  if (kind === "city") { const k = Math.floor(u * 40); const h = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1; return 0.25 + h * 0.75; }
  return (Math.sin(u * 3) * 0.5 + Math.sin(u * 7 + 1) * 0.3 + Math.sin(u * 13) * 0.2 + 1) * 0.5;
}
function drawSky(SC) {
  const T = TH_, hy = horizon() * SC, gr = g.createLinearGradient(0, 0, 0, hy); gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
  const per = W * 2, off = ((-CAM.a / (2 * Math.PI)) * per % per + per) % per;
  if (T.stars) { g.fillStyle = "#ffffffcc"; for (let i = 0; i < 70; i++) { const x = ((i * 137.5 + off * 0.3) % (W + 40)) - 20, y = (i * 61.3) % (hy * 0.8); g.fillRect(x, y, i % 7 ? 1.5 : 2.5, i % 7 ? 1.5 : 2.5); } }
  if (T.sun) { const x = ((W * 0.7 + off * 0.4) % per) - W * 0.3; g.fillStyle = T.sun; g.beginPath(); g.arc(x, hy * 0.35, hy * 0.16, 0, 7); g.fill(); }
  if (T.clouds) { g.fillStyle = T.clouds; for (let i = 0; i < 6; i++) { const x = ((i * per / 6 + off * 0.5) % per) - W * 0.2, y = hy * (0.25 + (i % 3) * 0.15); if (x > W + 100) continue; g.beginPath(); g.ellipse(x, y, 60, 16, 0, 0, 7); g.ellipse(x + 40, y - 8, 40, 14, 0, 0, 7); g.fill(); } }
  for (const [col, amp, sp, kind] of T.hills) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, hy + 1);
    for (let x = 0; x <= W; x += kind === "city" ? 4 : 8) { const u = (x + off * sp) / per * Math.PI * 2; g.lineTo(x, hy - ridge(kind, u) * hy * amp); }
    g.lineTo(W, hy + 1); g.closePath(); g.fill();
    if (kind === "peak") { g.save(); g.clip(); g.fillStyle = "#ffffffcc"; g.fillRect(0, 0, W, hy * (1 - amp * 0.75)); g.restore(); }
    if (kind === "city" && sp === 1) { for (let x = 0; x <= W; x += 6) { const u = (x + off * sp) / per * Math.PI * 2, h = ridge(kind, u) * hy * amp; for (let y = hy - h + 6; y < hy - 4; y += 9) if (((x * 7 + y * 3) | 0) % 5 === 0) { g.fillStyle = (x + y) % 3 ? "#ffd84a" : "#5fe1ff"; g.fillRect(x, y, 2, 3); } } }
  }
}
const kartImg = new Image(); kartImg.src = "assets/fox-kart.webp";
function drawKart(x, y, sc, steer, alpha, ghost) {
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(sc, sc);
  g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(0, -2, 48, 9, 0, 0, 7); g.fill();
  g.transform(1, 0, -steer * 0.12, 1, 0, 0); g.rotate(steer * 0.06);
  if (kartImg.complete && kartImg.naturalWidth) {
    const w = 100, h = w * kartImg.naturalHeight / kartImg.naturalWidth;
    if (ghost) g.filter = "hue-rotate(160deg) saturate(1.4) brightness(1.2)";
    g.drawImage(kartImg, -w / 2, -h, w, h); g.filter = "none";
  } else { g.fillStyle = ghost ? "#5fe1ff" : "#d8352a"; g.fillRect(-40, -40, 80, 34); }
  g.restore();
}
function drawBill(o, sc, SC) {
  const p = o.p, x = p.x * SC, y = p.y * SC, s = p.s * SC, hh = o.h || 1;
  const box = (cx, by, w, h, col) => { g.fillStyle = col; g.fillRect(cx - w / 2, by - h, w, h); };
  switch (o.kind) {
    case "tree": g.fillStyle = "#6b4426"; g.fillRect(x - 2.5 * s, y - 12 * s, 5 * s, 12 * s); g.fillStyle = o.c < 0.5 ? "#2f7d32" : "#3b9440"; g.beginPath(); g.arc(x, y - 22 * s, 11 * s, 0, 7); g.fill(); g.fillStyle = "#ffffff22"; g.beginPath(); g.arc(x - 3 * s, y - 25 * s, 5 * s, 0, 7); g.fill(); break;
    case "palm": { g.strokeStyle = "#8a5a2b"; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6 * s, y - 20 * s, x + 2 * s, y - 36 * s * hh); g.stroke(); g.fillStyle = "#2f8f3a"; const tx = x + 2 * s, ty = y - 36 * s * hh;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.ellipse(tx + Math.cos(a) * 9 * s, ty + Math.sin(a) * 4 * s + 3 * s, 11 * s, 3 * s, a, 0, 7); g.fill(); } break; }
    case "flag": g.fillStyle = "#ddd"; g.fillRect(x - 1 * s, y - 34 * s, 2 * s, 34 * s); g.fillStyle = o.c < 0.5 ? "#f5c547" : "#d8352a"; g.fillRect(x, y - 34 * s, 14 * s, 9 * s); break;
    case "cactus": g.fillStyle = "#3f8a4a"; box(x, y, 6 * s, 30 * s * hh, "#3f8a4a"); g.fillRect(x - 10 * s, y - 20 * s * hh, 4 * s, 10 * s); g.fillRect(x - 10 * s, y - 20 * s * hh, 8 * s, 3 * s); g.fillRect(x + 6 * s, y - 24 * s * hh, 4 * s, 12 * s); g.fillRect(x + 2 * s, y - 14 * s * hh, 8 * s, 3 * s); break;
    case "rock": g.fillStyle = TH_.name === "雪山連續彎" ? "#8d97a3" : "#a8653c"; g.beginPath(); g.moveTo(x - 14 * s * hh, y); g.lineTo(x - 10 * s, y - 12 * s * hh); g.lineTo(x + 2 * s, y - 16 * s * hh); g.lineTo(x + 13 * s * hh, y - 6 * s); g.lineTo(x + 14 * s * hh, y); g.closePath(); g.fill();
      if (TH_.name === "雪山連續彎") { g.fillStyle = "#fff"; g.fillRect(x - 6 * s, y - 15 * s * hh, 10 * s, 3 * s); } break;
    case "sign": g.fillStyle = "#6b4426"; g.fillRect(x - 1.5 * s, y - 22 * s, 3 * s, 22 * s); g.fillStyle = "#f5c547"; g.fillRect(x - 12 * s, y - 30 * s, 24 * s, 10 * s); g.fillStyle = "#2b1d14"; g.fillRect(x - 8 * s, y - 26 * s, 16 * s, 2 * s); break;
    case "pine": g.fillStyle = "#5a3d22"; g.fillRect(x - 2 * s, y - 8 * s, 4 * s, 8 * s); for (let k = 0; k < 3; k++) { const w = (14 - k * 3.5) * s, ty = y - (8 + k * 10) * s * hh; g.fillStyle = "#2d6a4a"; g.beginPath(); g.moveTo(x - w, ty); g.lineTo(x, ty - 14 * s * hh); g.lineTo(x + w, ty); g.closePath(); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x - w * 0.45, ty - 7 * s * hh); g.lineTo(x, ty - 14 * s * hh); g.lineTo(x + w * 0.45, ty - 7 * s * hh); g.closePath(); g.fill(); } break;
    case "snowman": g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y - 8 * s, 8 * s, 0, 7); g.arc(x, y - 21 * s, 6 * s, 0, 7); g.fill(); g.fillStyle = "#e8762c"; g.fillRect(x, y - 22 * s, 5 * s, 1.5 * s); g.fillStyle = "#d8352a"; g.fillRect(x - 6 * s, y - 16 * s, 12 * s, 2 * s); break;
    case "building": { const bw = 34 * s * (0.8 + o.c * 0.6), bh = 70 * s * hh; g.fillStyle = o.c < 0.5 ? "#2a2f52" : "#352a52"; g.fillRect(x - bw / 2, y - bh, bw, bh);
      for (let yy = y - bh + 5 * s; yy < y - 6 * s; yy += 8 * s) for (let xx = x - bw / 2 + 4 * s; xx < x + bw / 2 - 4 * s; xx += 7 * s) if (((xx + yy * 3) | 0) % 3) { g.fillStyle = ((xx * yy) | 0) % 5 ? "#ffd84a" : "#5fe1ff"; g.fillRect(xx, yy, 3 * s, 4 * s); } break; }
    case "lamp": g.fillStyle = "#444a60"; g.fillRect(x - 1.2 * s, y - 34 * s, 2.4 * s, 34 * s); g.fillRect(x - 1.2 * s, y - 34 * s, 8 * s, 2 * s); g.fillStyle = "#fff6c4"; g.beginPath(); g.arc(x + 7 * s, y - 31 * s, 3 * s, 0, 7); g.fill();
      g.fillStyle = "rgba(255,240,170,.18)"; g.beginPath(); g.moveTo(x + 7 * s, y - 31 * s); g.lineTo(x - 2 * s, y); g.lineTo(x + 16 * s, y); g.closePath(); g.fill(); break;
    case "neon": g.fillStyle = "#1a1830"; g.fillRect(x - 16 * s, y - 40 * s, 32 * s, 16 * s); g.strokeStyle = o.c < 0.5 ? "#ff4fd8" : "#5fe1ff"; g.lineWidth = 2 * s; g.strokeRect(x - 14 * s, y - 38 * s, 28 * s, 12 * s); g.fillStyle = "#444a60"; g.fillRect(x - 1.5 * s, y - 24 * s, 3 * s, 24 * s); break;
    case "post": g.fillStyle = "#fff"; g.fillRect(x - 2 * s, y - 40 * s, 4 * s, 40 * s); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#111" : "#fff"; g.fillRect(x - 2 * s, y - 40 * s + i * 4 * s, 4 * s, 4 * s); } break;
    case "ghost": drawKart(x, y, s * 0.13, 0, 0.55, true); break;
    default: if (typeof labDrawItem === "function") labDrawItem(o, x, y, s);
  }
}
function drawMini() {
  const mw = 180, mh = mw * WH / WW, mx = W - mw - 16, my = 86, s = mw / WW;
  g.fillStyle = "rgba(10,20,10,.6)"; g.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
  g.strokeStyle = "#ddd"; g.lineWidth = 4; g.lineJoin = "round"; g.beginPath(); PTS.forEach((p, i) => (i ? g.lineTo(mx + p[0] * s, my + p[1] * s) : g.moveTo(mx + p[0] * s, my + p[1] * s))); g.closePath(); g.stroke();
  if (S.ghost && S.running && S.count <= 0) { const r = S.ghost[Math.min(S.ghost.length - 1, Math.floor(S.ghostT))]; if (r) { g.fillStyle = "#5fe1ff"; g.beginPath(); g.arc(mx + r[0] * s, my + r[1] * s, 4, 0, 7); g.fill(); } }
  const c = S.car; if (c) { g.fillStyle = "#d8352a"; g.beginPath(); g.arc(mx + c.x * s, my + c.y * s, 5, 0, 7); g.fill(); }
}
let camInit = false;
function draw() {
  if (!PTS.length || !TEX) return;
  const c = S.car || { x: PTS[0][0], y: PTS[0][1], a: Math.atan2(PTS[3][1] - PTS[0][1], PTS[3][0] - PTS[0][0]), v: 0 };
  let da = c.a - CAM.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  CAM.a = camInit ? CAM.a + da * 0.12 : c.a; camInit = true;
  CAM.x = c.x - Math.cos(CAM.a) * CAM.d; CAM.y = c.y - Math.sin(CAM.a) * CAM.d;
  const SC = W / RW;
  drawSky(SC); renderFloor();
  g.imageSmoothingEnabled = false; const hz = horizon(); g.drawImage(buf, 0, hz, RW, RH - hz, 0, hz * SC, W, (RH - hz) * SC); g.imageSmoothingEnabled = true;
  const list = [];
  if (S.lab) for (const o of S.items) { const p = project(o.x, o.y); if (p && p.z > 35 && p.z < 700 && p.x > -40 && p.x < RW + 40) list.push({ ...o, p }); }
  for (const o of SCN) { const p = project(o.x, o.y); if (p && p.z > 45 && p.z < (o.kind === "building" ? 900 : 760) && p.x > -60 && p.x < RW + 40) list.push({ ...o, p }); }
  if (S.ghost && S.running && S.count <= 0) { const r = S.ghost[Math.min(S.ghost.length - 1, Math.floor(S.ghostT))]; if (r) { const p = project(r[0], r[1]); if (p) list.push({ kind: "ghost", p }); } }
  list.sort((a, b) => b.p.z - a.p.z); for (const o of list) drawBill(o, 1, SC);
  const pc = project(c.x, c.y), steer = (S.knob - 512) / 512, bounce = Math.abs(c.v) > 20 ? Math.sin(S.t * 30) * 1.5 : 0;
  if (pc) {
    if (S.boost > 0) { g.fillStyle = "rgba(95,225,255,.8)"; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(pc.x * SC + (i ? 30 : -30) * pc.s * SC * 0.13, pc.y * SC + 2, 8 + Math.random() * 10, 0, 7); g.fill(); } }
    drawKart(pc.x * SC, pc.y * SC + bounce, pc.s * SC * 0.13, steer, 1, false);
  }
  if (S.boost > 0) { g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = rnd(0, Math.PI * 2), r1 = rnd(0.35, 0.5) * W; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r1, H * 0.55 + Math.sin(a) * r1 * 0.6); g.lineTo(W / 2 + Math.cos(a) * (r1 + 60), H * 0.55 + Math.sin(a) * (r1 + 60) * 0.6); g.stroke(); } }
  drawMini();
  if (S.running && S.count > 0) { g.fillStyle = "#ffc94a"; g.strokeStyle = "#2b1d14"; g.lineWidth = 8; g.font = "900 120px Space Mono, monospace"; g.textAlign = "center";
    const t = String(Math.ceil(S.count)); g.strokeText(t, W / 2, H * 0.4); g.fillText(t, W / 2, H * 0.4); }
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
buildTrack(0); buildTexture(); resize(); requestAnimationFrame(loop);

document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", MB.gate(() => start(b.dataset.mode))));
$("againBtn").onclick = MB.gate(() => start(S.mode));
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.lab) LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
