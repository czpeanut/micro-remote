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

/* ---------- 賽道（世界座標 1000×640） ---------- */
const TRACKS = [
  [[180, 320], [220, 150], [420, 110], [640, 150], [820, 120], [880, 300], [800, 470], [600, 520], [430, 450], [260, 520], [170, 450]],
  [[150, 150], [400, 110], [520, 260], [420, 380], [560, 520], [800, 520], [880, 360], [760, 220], [860, 100], [620, 70], [300, 60], [120, 300], [130, 520], [300, 540], [260, 330]],
  [[500, 560], [260, 380], [180, 220], [260, 110], [400, 100], [500, 200], [600, 100], [740, 110], [820, 220], [740, 380]],
];
const ROAD = 64;
let PTS = [], CUM = [], TOTAL = 0, view = { s: 1, ox: 0, oy: 0 };
function catmull(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0, 1].map((i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)); }
function buildTrack(i) {
  const c = TRACKS[i]; PTS = [];
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
function bestKey() { return "race-best-" + S.track; }
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
  const maxV = (off ? 100 : 280) * S.vmax * (S.boost > 0 ? 1.45 : 1);
  if (off && !S.wasOff) labFire("off"); S.wasOff = off;
  if (S.btn === 1 || S.boost > 0) c.v += (S.boost > 0 ? 420 : 240) * dt;
  else if (S.btn === 2) c.v -= 420 * dt;
  else c.v -= 90 * dt;
  c.v = clamp(c.v, -60, maxV); if (c.v > maxV) c.v = maxV;
  if (off && c.v > 110) c.v -= 400 * dt;
  const steer = (S.knob - 512) / 512;
  c.a += steer * 2.6 * S.steerK * dt * clamp(Math.abs(c.v) / 160, 0, 1.2) * Math.sign(c.v || 1);
  if (S.spin > 0) { S.spin -= dt; c.a += 9 * dt; c.v *= Math.pow(0.3, dt); }
  if (S.lab) for (const it of S.items) { if (it.dead) continue; it.cool = Math.max(0, (it.cool || 0) - dt); if (it.cool <= 0 && Math.hypot(it.x - c.x, it.y - c.y) < 18) { it.cool = 1; labFire("item", it.kind, it); } }
  if (S.lab) S.items = S.items.filter((it) => !it.dead);
  c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
  c.x = clamp(c.x, 10, 990); c.y = clamp(c.y, 10, 630);
  if (Math.abs(steer) > 0.6 && c.v > 220) S.skid.push({ x: c.x, y: c.y, life: 3 });
  S.skid = S.skid.filter((s) => (s.life -= dt) > 0).slice(-200);
  S.rec.push([c.x, c.y, c.a]);
  // 圈數：沿著賽道前進才算
  const prog = CUM[n.i] / TOTAL;
  if (prog > 0.45 && prog < 0.55) S.half = true;
  if (S.half && S.prog > 0.9 && prog < 0.1) { S.half = false; lapDone(); }
  S.prog = prog;
  if (S.ghost) S.ghostT += 1;
  $("spd").textContent = Math.round(Math.max(0, c.v) / 3); $("cur").textContent = S.lapT.toFixed(1);
}

/* ---------- 畫面：2D 仿 3D（Mode 7）第三人稱 ---------- */
const TS = 2, TW = 1000 * TS, TH = 640 * TS;
let TEX = null, SCN = [];
function buildTexture() {
  const c = document.createElement("canvas"); c.width = TW; c.height = TH; const t = c.getContext("2d"); t.scale(TS, TS);
  for (let y = 0; y < 640; y += 40) for (let x = 0; x < 1000; x += 40) { t.fillStyle = ((x + y) / 40) % 2 ? "#4fa83e" : "#58b546"; t.fillRect(x, y, 40, 40); }
  const path = () => { t.beginPath(); PTS.forEach((p, i) => (i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.closePath(); };
  t.lineJoin = t.lineCap = "round";
  path(); t.strokeStyle = "#d9c38a"; t.lineWidth = ROAD + 44; t.stroke();
  path(); t.strokeStyle = "#f4f4f4"; t.lineWidth = ROAD + 14; t.stroke();
  path(); t.strokeStyle = "#d8352a"; t.setLineDash([12, 12]); t.lineWidth = ROAD + 14; t.stroke(); t.setLineDash([]);
  path(); t.strokeStyle = "#6c6c74"; t.lineWidth = ROAD; t.stroke();
  path(); t.strokeStyle = "#76767e"; t.lineWidth = ROAD - 20; t.stroke();
  path(); t.strokeStyle = "#ffffffaa"; t.setLineDash([18, 22]); t.lineWidth = 2.5; t.stroke(); t.setLineDash([]);
  const p0 = PTS[0], p1 = PTS[1], ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  t.save(); t.translate(p0[0], p0[1]); t.rotate(ang + Math.PI / 2);
  for (let i = -4; i < 4; i++) for (let j = 0; j < 2; j++) { t.fillStyle = (i + j) % 2 ? "#fff" : "#111"; t.fillRect(i * 8, j * 8 - 8, 8, 8); }
  t.restore();
  // 道具方塊地板（裝飾）
  for (let k = 40; k < PTS.length; k += 90) { const [x, y] = PTS[k]; t.fillStyle = "#f5c547"; t.fillRect(x - 6, y - 6, 12, 12); t.fillStyle = "#c4521a"; t.font = "bold 11px sans-serif"; t.textAlign = "center"; t.fillText("?", x, y + 4); }
  TEX = new Uint32Array(t.getImageData(0, 0, TW, TH).data.buffer);
  // 路邊的樹和旗子（看板）
  SCN = []; let seed = 7; const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < PTS.length; k += 6) for (const side of [-1, 1]) {
    const a = PTS[k], b = PTS[(k + 1) % PTS.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const off = ROAD / 2 + 30 + r() * 40, x = a[0] - dy / L * off * side, y = a[1] + dx / L * off * side;
    if (x < 15 || y < 15 || x > 985 || y > 625 || nearest(x, y).d < ROAD / 2 + 22 || r() < 0.35) continue;
    SCN.push({ x, y, kind: r() < 0.82 ? "tree" : "flag", c: r() });
  }
  for (const side of [-1, 1]) { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy); SCN.push({ x: p0[0] - dy / L * (ROAD / 2 + 14) * side, y: p0[1] + dx / L * (ROAD / 2 + 14) * side, kind: "post" }); }
}
const buf = document.createElement("canvas"), bg2 = buf.getContext("2d"); let RW = 320, RH = 200, IMG = null, PIX = null;
const CAM = { x: 0, y: 0, a: 0, h: 30, d: 80, f: 260 };
function sizeBuf() { RW = 320; RH = Math.max(150, Math.round(RW * H / Math.max(1, W))); buf.width = RW; buf.height = RH; IMG = bg2.createImageData(RW, RH); PIX = new Uint32Array(IMG.data.buffer); CAM.f = RW * 0.8; }
function horizon() { return Math.round(RH * 0.36); }
const FOG = [0x8a, 0xc8, 0xf0];
function renderFloor() {
  const hz = horizon(), ca = Math.cos(CAM.a), sa = Math.sin(CAM.a), f = CAM.f;
  for (let y = hz + 1; y < RH; y++) {
    const z = CAM.h * f / (y - hz), fog = clamp((z - 260) / 520, 0, 1), inv = 1 - fog;
    const fr = FOG[0] * fog, fg = FOG[1] * fog, fb = FOG[2] * fog;
    const cx = CAM.x + ca * z, cy = CAM.y + sa * z, k = z / f; // 右方向 (-sin, cos)
    let wx = cx - (-sa) * k * RW / 2, wy = cy - ca * k * RW / 2; const sx = -sa * k, sy = ca * k;
    let o = y * RW;
    for (let x = 0; x < RW; x++, wx += sx, wy += sy) {
      let col;
      if (wx >= 0 && wy >= 0 && wx < 1000 && wy < 640) col = TEX[((wy * TS) | 0) * TW + ((wx * TS) | 0)];
      else col = (((Math.floor(wx / 40) + Math.floor(wy / 40)) & 1) ? 0xff2f7a2a : 0xff35852f);
      if (fog > 0) { const rr = (col & 255) * inv + fr, gg = ((col >> 8) & 255) * inv + fg, bb = ((col >> 16) & 255) * inv + fb; col = 0xff000000 | (bb << 16) | (gg << 8) | rr; }
      PIX[o++] = col;
    }
  }
  bg2.putImageData(IMG, 0, 0, 0, hz, RW, RH - hz);
}
function project(wx, wy) { const dx = wx - CAM.x, dy = wy - CAM.y, ca = Math.cos(CAM.a), sa = Math.sin(CAM.a); const z = dx * ca + dy * sa, xr = -dx * sa + dy * ca; if (z < 8) return null;
  return { z, x: RW / 2 + xr * CAM.f / z, y: horizon() + CAM.h * CAM.f / z, s: CAM.f / z }; }
function drawSky(SC) {
  const hy = horizon() * SC, gr = g.createLinearGradient(0, 0, 0, hy); gr.addColorStop(0, "#3b8fe0"); gr.addColorStop(1, "#a6dcff"); g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
  const per = W * 2, off = ((-CAM.a / (2 * Math.PI)) * per % per + per) % per;
  g.fillStyle = "#ffffffcc"; for (let i = 0; i < 6; i++) { const x = ((i * per / 6 + off * 0.5) % per) - W * 0.2, y = hy * (0.25 + (i % 3) * 0.15); if (x > W + 100) continue; g.beginPath(); g.ellipse(x, y, 60, 16, 0, 0, 7); g.ellipse(x + 40, y - 8, 40, 14, 0, 0, 7); g.fill(); }
  for (const [col, amp, base, sp] of [["#7aa6c9", 0.5, 0.0, 0.6], ["#3f8f4a", 0.28, 0.0, 1]]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, hy + 1);
    for (let x = 0; x <= W; x += 8) { const u = (x + off * sp) / per * Math.PI * 2; const h = (Math.sin(u * 3) * 0.5 + Math.sin(u * 7 + 1) * 0.3 + Math.sin(u * 13) * 0.2 + 1) * 0.5; g.lineTo(x, hy - h * hy * amp - base); }
    g.lineTo(W, hy + 1); g.closePath(); g.fill();
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
  const p = o.p, x = p.x * SC, y = p.y * SC, s = p.s * SC;
  if (o.kind === "tree") { g.fillStyle = "#6b4426"; g.fillRect(x - 2.5 * s, y - 12 * s, 5 * s, 12 * s); g.fillStyle = o.c < 0.5 ? "#2f7d32" : "#3b9440"; g.beginPath(); g.arc(x, y - 22 * s, 11 * s, 0, 7); g.fill(); g.fillStyle = "#ffffff22"; g.beginPath(); g.arc(x - 3 * s, y - 25 * s, 5 * s, 0, 7); g.fill(); }
  else if (o.kind === "flag") { g.fillStyle = "#ddd"; g.fillRect(x - 1 * s, y - 34 * s, 2 * s, 34 * s); g.fillStyle = o.c < 0.9 ? "#f5c547" : "#d8352a"; g.fillRect(x, y - 34 * s, 14 * s, 9 * s); }
  else if (o.kind === "post") { g.fillStyle = "#fff"; g.fillRect(x - 2 * s, y - 40 * s, 4 * s, 40 * s); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#111" : "#fff"; g.fillRect(x - 2 * s, y - 40 * s + i * 4 * s, 4 * s, 4 * s); } }
  else if (o.kind === "ghost") drawKart(x, y, s * 0.13, 0, 0.55, true);
  else if (typeof labDrawItem === "function") labDrawItem(o, x, y, s);
}
function drawMini() {
  const mw = 170, mh = 109, mx = W - mw - 16, my = 86, s = mw / 1000;
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
  for (const o of SCN) { const p = project(o.x, o.y); if (p && p.z > 45 && p.z < 700 && p.x > -40 && p.x < RW + 40) list.push({ ...o, p }); }
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

document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", () => start(b.dataset.mode)));
$("againBtn").onclick = () => start(S.mode);
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.lab) LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
