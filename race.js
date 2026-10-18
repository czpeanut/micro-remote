"use strict";
/*
 * 旋鈕賽車 — 主題B 第七堂
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
function layout() { const s = Math.min(W / 1000, (H - 150) / 640); view = { s, ox: (W - 1000 * s) / 2, oy: 80 + (H - 150 - 640 * s) / 2 }; }
function nearest(x, y) { let bi = 0, bd = 1e9; for (let k = 0; k < PTS.length; k++) { const d = (PTS[k][0] - x) ** 2 + (PTS[k][1] - y) ** 2; if (d < bd) { bd = d; bi = k; } } return { i: bi, d: Math.sqrt(bd) }; }

/* ---------- 狀態 ---------- */
const S = { mode: null, running: false, knob: 512, btn: 0, car: null, lap: 0, laps: 3, lapT: 0, best: null, times: [], nitro: 3, boost: 0, count: 0, prog: 0, half: false,
  trail: [], rec: [], ghost: null, ghostT: 0, skid: [], t: 0, track: 0 };
function bestKey() { return "race-best-" + S.track; }
function loadBest() { try { const v = JSON.parse(localStorage.getItem(bestKey())); return v; } catch (e) { return null; } }
function saveBest(time, rec) { try { localStorage.setItem(bestKey(), JSON.stringify({ time, rec })); } catch (e) {} }

/* ---------- 輸入 ---------- */
MB.on((ev) => { if (ev.key === "k") setKnob(ev.value); if (ev.key === "b") setBtn(Math.round(ev.value)); });
function setKnob(v) { S.knob = clamp(v, 0, 1023); $("knob").textContent = Math.round(S.knob); $("wheel").style.transform = `rotate(${(S.knob - 512) / 512 * 135}deg)`; }
function setBtn(b) {
  if (b === 3 && S.btn !== 3) useNitro();
  S.btn = b; for (let i = 1; i <= 5; i++) $("k" + i).classList.toggle("on", b === i);
}
const keys = {};
addEventListener("keydown", (e) => { keys[e.key] = true; if (e.key === " ") { e.preventDefault(); if (!MB.live()) useNitro(); } });
addEventListener("keyup", (e) => { keys[e.key] = false; });
function useNitro() { if (!S.running || S.count > 0 || S.nitro <= 0 || S.boost > 0) return; S.nitro--; S.boost = 1.6; SFX.noise(0.9, 0.25, 900); hudNitro(); }
function hudNitro() { $("nitro").textContent = "●".repeat(S.nitro) + "○".repeat(3 - S.nitro); }

/* ---------- 流程 ---------- */
function start(mode) {
  S.track = +document.querySelector("input[name=track]:checked").value; buildTrack(S.track); layout();
  const p = PTS[0], q = PTS[3];
  S.car = { x: p[0], y: p[1], a: Math.atan2(q[1] - p[1], q[0] - p[0]), v: 0 };
  Object.assign(S, { mode, running: true, lap: 0, lapT: 0, times: [], nitro: 3, boost: 0, count: 3, prog: 0, half: false, rec: [], skid: [], t: 0 });
  S.laps = mode === "free" ? Infinity : 3;
  const b = loadBest(); S.best = b ? b.time : null; S.ghost = mode === "ghost" && b ? b.rec : null; S.ghostT = 0;
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
  const t = S.lapT; S.times.push(t); MB.send("lap");
  const nb = !S.best || t < S.best;
  if (nb) { S.best = t; saveBest(t, S.rec); toast(`新紀錄！${t.toFixed(2)} 秒`); [523, 659, 784, 1046].forEach((f, i) => SFX.tone(f, f, 0.2, "triangle", 0.14, i * 0.08)); }
  else { toast(`第 ${S.lap + 1} 圈 ${t.toFixed(2)} 秒`); SFX.tone(880, 880, 0.15, "triangle", 0.12); }
  S.lap++; S.lapT = 0; S.rec = []; S.ghostT = 0;
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
    if (after !== before) { if (after > 0) SFX.tone(600, 600, 0.15, "square", 0.1); else { SFX.tone(1200, 1200, 0.3, "square", 0.12); MB.send("go"); } } return; }
  S.lapT += dt; S.boost = Math.max(0, S.boost - dt);
  const n = nearest(c.x, c.y), off = n.d > ROAD / 2;
  const maxV = (off ? 100 : 280) * (S.boost > 0 ? 1.45 : 1);
  if (S.btn === 1 || S.boost > 0) c.v += (S.boost > 0 ? 420 : 240) * dt;
  else if (S.btn === 2) c.v -= 420 * dt;
  else c.v -= 90 * dt;
  c.v = clamp(c.v, -60, maxV); if (c.v > maxV) c.v = maxV;
  if (off && c.v > 110) c.v -= 400 * dt;
  const steer = (S.knob - 512) / 512;
  c.a += steer * 2.6 * dt * clamp(Math.abs(c.v) / 160, 0, 1.2) * Math.sign(c.v || 1);
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

/* ---------- 畫面 ---------- */
function W2S(x, y) { return [view.ox + x * view.s, view.oy + y * view.s]; }
function pathTrack() { g.beginPath(); PTS.forEach((p, i) => { const [x, y] = W2S(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); }
function drawCar(x, y, a, col, alpha = 1) {
  const [sx, sy] = W2S(x, y), s = view.s;
  g.save(); g.globalAlpha = alpha; g.translate(sx, sy); g.rotate(a); g.scale(s, s);
  g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(-15, -8, 32, 18);
  g.fillStyle = "#222"; g.fillRect(-12, -11, 8, 4); g.fillRect(6, -11, 8, 4); g.fillRect(-12, 7, 8, 4); g.fillRect(6, 7, 8, 4);
  g.fillStyle = col; g.beginPath(); g.moveTo(18, 0); g.lineTo(10, -8); g.lineTo(-16, -8); g.lineTo(-16, 8); g.lineTo(10, 8); g.closePath(); g.fill();
  g.fillStyle = "#9fe6ff"; g.fillRect(2, -6, 6, 12); g.fillStyle = "#fff"; g.fillRect(-14, -2, 14, 4);
  g.restore();
}
function draw() {
  g.fillStyle = "#3f7a34"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = (i * 197) % W, y = (i * 113) % H; g.fillStyle = "rgba(30,70,25,.5)"; g.beginPath(); g.arc(x, y, 14 + (i % 5) * 4, 0, 7); g.fill(); }
  if (!PTS.length) return;
  g.lineJoin = "round"; g.lineCap = "round";
  pathTrack(); g.strokeStyle = "#e9e3d3"; g.lineWidth = (ROAD + 10) * view.s; g.stroke();
  pathTrack(); g.strokeStyle = "#c4521a"; g.setLineDash([14 * view.s, 14 * view.s]); g.lineWidth = (ROAD + 10) * view.s; g.stroke(); g.setLineDash([]);
  pathTrack(); g.strokeStyle = "#4b4b55"; g.lineWidth = ROAD * view.s; g.stroke();
  pathTrack(); g.strokeStyle = "rgba(255,255,255,.4)"; g.setLineDash([16 * view.s, 18 * view.s]); g.lineWidth = 2; g.stroke(); g.setLineDash([]);
  // 起點線
  const p0 = PTS[0], p1 = PTS[1], ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const [sx, sy] = W2S(p0[0], p0[1]); g.save(); g.translate(sx, sy); g.rotate(ang + Math.PI / 2);
  for (let i = -4; i < 4; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? "#fff" : "#111"; g.fillRect(i * 8 * view.s, j * 8 * view.s - 8 * view.s, 8 * view.s, 8 * view.s); }
  g.restore();
  for (const s of S.skid) { const [x, y] = W2S(s.x, s.y); g.fillStyle = `rgba(0,0,0,${s.life / 6})`; g.fillRect(x - 2, y - 2, 4, 4); }
  if (S.ghost && S.running && S.count <= 0) { const r = S.ghost[Math.min(S.ghost.length - 1, Math.floor(S.ghostT))]; if (r) drawCar(r[0], r[1], r[2], "#5fe1ff", 0.45); }
  const c = S.car; if (c) { if (S.boost > 0) { const [x, y] = W2S(c.x - Math.cos(c.a) * 20, c.y - Math.sin(c.a) * 20); g.fillStyle = "rgba(95,225,255,.7)"; g.beginPath(); g.arc(x, y, 8 * view.s + Math.random() * 6, 0, 7); g.fill(); }
    drawCar(c.x, c.y, c.a, "#f5c547"); }
  if (S.running && S.count > 0) { g.fillStyle = "#ffc94a"; g.strokeStyle = "#2b1d14"; g.lineWidth = 8; g.font = "900 120px Space Mono, monospace"; g.textAlign = "center";
    const t = String(Math.ceil(S.count)); g.strokeText(t, W / 2, H / 2 + 40); g.fillText(t, W / 2, H / 2 + 40); }
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
resize(); buildTrack(0); layout(); requestAnimationFrame(loop);

document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", () => start(b.dataset.mode)));
$("againBtn").onclick = () => start(S.mode);
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
