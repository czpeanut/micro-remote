"use strict";
/*
 * 體感指揮家 — 主題2 第八堂
 *  micro:bit → 平板：beat#（揮一下＝一拍）、t:BPM（micro:bit 自己算的速度，挑戰）、x:數字（左右傾斜）
 *  平板 → micro:bit：bar#（每一小節）、end#（演奏完畢）
 *  曲子：貝多芬《歡樂頌》（公共領域），四個聲部：弦樂、木管、銅管、打擊
 */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const cv = $("view"), g = cv.getContext("2d");
let W = 0, H = 0;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); }
addEventListener("resize", resize); resize();

/* ---------- 樂譜 ---------- */
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MEL = [
  [[64, 1], [64, 1], [65, 1], [67, 1]], [[67, 1], [65, 1], [64, 1], [62, 1]], [[60, 1], [60, 1], [62, 1], [64, 1]], [[64, 1.5], [62, 0.5], [62, 2]],
  [[64, 1], [64, 1], [65, 1], [67, 1]], [[67, 1], [65, 1], [64, 1], [62, 1]], [[60, 1], [60, 1], [62, 1], [64, 1]], [[62, 1.5], [60, 0.5], [60, 2]],
  [[62, 1], [62, 1], [64, 1], [60, 1]], [[62, 1], [64, 0.5], [65, 0.5], [64, 1], [60, 1]], [[62, 1], [64, 0.5], [65, 0.5], [64, 1], [62, 1]], [[60, 1], [62, 1], [55, 2]],
  [[64, 1], [64, 1], [65, 1], [67, 1]], [[67, 1], [65, 1], [64, 1], [62, 1]], [[60, 1], [60, 1], [62, 1], [64, 1]], [[62, 1.5], [60, 0.5], [60, 2]],
];
const C = [48, 52, 55], G7 = [43, 47, 50, 53];
const CH = ["C", "G", "C", "G", "C", "G", "C", "GC", "G", "C", "G", "CG", "C", "G", "C", "GC"];
const BARS = MEL.length, BEATS = BARS * 4;
const TARGETS = [[0, 100, "中板"], [4, 72, "慢板"], [8, 140, "快板"], [12, 100, "中板"]];
const EV = []; // {beat, sec:'str'|'wood'|'brass'|'drum'|'bass', midi, len}
MEL.forEach((bar, bi) => { let b = bi * 4; for (const [m, l] of bar) { EV.push({ beat: b, sec: "str", midi: m + 12, len: l }); EV.push({ beat: b, sec: "wood", midi: m + 12 - (m >= 64 ? 4 : 3), len: l }); b += l; } });
CH.forEach((c, bi) => {
  const halves = c.length === 2 ? [c[0], c[1]] : [c, c];
  halves.forEach((h, k) => { const notes = h === "C" ? C : G7, b = bi * 4 + k * 2;
    EV.push({ beat: b, sec: "bass", midi: notes[0] - 12, len: 1.8 }); EV.push({ beat: b + 1, sec: "bass", midi: notes[0], len: 0.9 });
    notes.slice(1).forEach((n) => EV.push({ beat: b, sec: "brass", midi: n + 12, len: 1.7 })); });
  for (let k = 0; k < 4; k++) EV.push({ beat: bi * 4 + k, sec: "drum", midi: k % 2 ? 2 : 1, len: 0.2 });
});
EV.push({ beat: BEATS - 2, sec: "drum", midi: 3, len: 2 });
EV.sort((a, b) => a.beat - b.beat);

/* ---------- 狀態 ---------- */
const S = { mode: null, running: false, pos: 0, rate: 0, bpm: 0, beats: [], lastBeat: 0, tilt: 0, next: 0, bar: -1, good: 0, total: 0,
  extBpm: 0, extT: 0, swing: 0, flash: { str: 0, wood: 0, brass: 0, drum: 0 }, notes: [], t: 0, waiting: true , vol: { str: 1, wood: 1, brass: 1, drum: 1 }, labTarget: 0, light: "warm", fw: [], side: "mid" , scene: "hall" };
const SECT = { str: { name: "弦樂", col: "#e9a34a", side: -1 }, wood: { name: "木管", col: "#7cc46a", side: -1 }, brass: { name: "銅管", col: "#f2d04b", side: 1 }, drum: { name: "打擊", col: "#e0605a", side: 1 } };
function gainOf(sec) { const s = (SECT[sec] || SECT.str).side; return clamp(1 + s * S.tilt * 0.9, 0.15, 1.9) * (S.vol[sec] ?? 1); }
const labFire = (ev, arg) => (S.mode === "lab" && typeof LAB !== "undefined" ? LAB.fire(ev, arg) : 0);
function target() { if (S.mode === "lab") return [0, S.labTarget || 0, "目標"]; const bar = Math.floor(S.pos / 4); let t = TARGETS[0]; for (const x of TARGETS) if (bar >= x[0]) t = x; return t; }

/* ---------- 輸入 ---------- */
MB.on((ev) => {
  if (ev.word === "beat") beat();
  if (ev.key === "t" && ev.value > 20 && ev.value < 300) { S.extBpm = ev.value; S.extT = performance.now(); }
  if (ev.key === "x") S.tilt = clamp(ev.value / 900, -1, 1);
});
const keys = {};
addEventListener("keydown", (e) => { if (e.key === " " && !e.repeat) { e.preventDefault(); beat(); } keys[e.key] = true; });
addEventListener("keyup", (e) => { keys[e.key] = false; });

function beat() {
  if (!S.running) return;
  const now = performance.now() / 1000; S.swing = 1;
  if (S.lastBeat) { const iv = now - S.lastBeat; if (iv > 0.2 && iv < 2.5) { S.beats.push(iv); if (S.beats.length > 4) S.beats.shift(); } }
  S.lastBeat = now;
  if (S.beats.length) {
    const avg = S.beats.reduce((a, b) => a + b, 0) / S.beats.length;
    S.bpm = performance.now() - S.extT < 1500 && S.extBpm ? S.extBpm : 60 / avg;
  } else if (!S.bpm) S.bpm = 90;
  if (S.waiting) { S.waiting = false; S.pos = Math.round(S.pos); }
  else { const want = Math.round(S.pos); S.pos += (want - S.pos) * 0.5; }
  if (S.mode === "challenge" && S.pos > 1) { const [, tg] = target(); S.total++; if (Math.abs(S.bpm - tg) / tg < 0.15) S.good++; }
  hud(); labFire("beat");
}
function hud() {
  $("bpm").textContent = S.bpm ? Math.round(S.bpm) : "--";
  const [, tg, name] = target(); $("tgt").textContent = `${name} ${tg}`;
  $("acc").textContent = S.total ? `${Math.round(S.good / S.total * 100)}%` : "--";
  $("bar").textContent = `${Math.min(BARS, Math.floor(S.pos / 4) + 1)}/${BARS}`;
}

/* ---------- 合成器 ---------- */
let master = null;
function out() { const a = SFX.audio(); if (!a) return null; if (!master) { master = a.createGain(); master.gain.value = 0.5; const comp = a.createDynamicsCompressor(); master.connect(comp).connect(a.destination); } return master; }
function play(ev, when, dur) {
  const a = SFX.audio(), o = out(); if (!a || !o || !SFX.on) return;
  const gm = gainOf(ev.sec === "bass" ? "str" : ev.sec);
  const pan = a.createStereoPanner ? a.createStereoPanner() : null; if (pan) { pan.pan.value = ev.sec === "str" || ev.sec === "bass" ? -0.4 : ev.sec === "wood" ? -0.15 : ev.sec === "brass" ? 0.3 : 0.4; pan.connect(o); }
  const dest = pan || o;
  if (ev.sec === "drum") {
    if (ev.midi === 1 || ev.midi === 3) { const osc = a.createOscillator(), gg = a.createGain(); osc.frequency.setValueAtTime(ev.midi === 3 ? 90 : 120, when); osc.frequency.exponentialRampToValueAtTime(40, when + 0.3);
      gg.gain.setValueAtTime(0.5 * gm * (ev.midi === 3 ? 1.4 : 1), when); gg.gain.exponentialRampToValueAtTime(0.001, when + (ev.midi === 3 ? 1.2 : 0.35)); osc.connect(gg).connect(dest); osc.start(when); osc.stop(when + 1.3); }
    else { const n = Math.floor(a.sampleRate * 0.15), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = a.createBufferSource(), f = a.createBiquadFilter(), gg = a.createGain(); f.type = "highpass"; f.frequency.value = 1500; gg.gain.value = 0.18 * gm; s.buffer = buf; s.connect(f).connect(gg).connect(dest); s.start(when); }
    return;
  }
  const type = { str: "sawtooth", wood: "triangle", brass: "square", bass: "triangle" }[ev.sec];
  const vol = { str: 0.09, wood: 0.07, brass: 0.035, bass: 0.16 }[ev.sec] * gm;
  const osc = a.createOscillator(), f = a.createBiquadFilter(), gg = a.createGain();
  osc.type = type; osc.frequency.value = mf(ev.midi);
  if (ev.sec === "str") { const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 4; lfo.connect(lg).connect(osc.frequency); lfo.start(when); lfo.stop(when + dur + 0.3); }
  f.type = "lowpass"; f.frequency.value = ev.sec === "brass" ? 1400 : 2600;
  const att = ev.sec === "str" ? 0.06 : 0.02;
  gg.gain.setValueAtTime(0, when); gg.gain.linearRampToValueAtTime(vol, when + att); gg.gain.setValueAtTime(vol, when + Math.max(att, dur * 0.8)); gg.gain.linearRampToValueAtTime(0, when + dur + 0.12);
  osc.connect(f).connect(gg).connect(dest); osc.start(when); osc.stop(when + dur + 0.2);
}

/* ---------- 流程 ---------- */
function start(mode) {
  const sc = document.querySelector("input[name=scene]:checked"); if (sc && mode !== "lab") S.scene = sc.value;
  Object.assign(S, { mode, running: true, pos: 0, rate: 0, bpm: 0, beats: [], lastBeat: 0, next: 0, bar: -1, good: 0, total: 0, waiting: true, notes: [] });
  $("menu").hidden = true; $("endOv").hidden = true; $("tgtBox").hidden = $("accBox").hidden = mode !== "challenge";
  hud(); out(); toast("舉起指揮棒，往下揮一下開始！");
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1800); }
function finish() {
  S.running = false; MB.send("end");
  $("endTitle").textContent = "演奏完畢！掌聲鼓勵！";
  if (S.mode === "challenge") { const p = S.total ? Math.round(S.good / S.total * 100) : 0; $("endText").textContent = "速度準確度"; $("endScore").textContent = `${p}%  ${p >= 80 ? "★★★" : p >= 50 ? "★★☆" : "★☆☆"}`; }
  else { $("endText").textContent = "你指揮完整首《歡樂頌》，平均速度"; $("endScore").textContent = `${Math.round(S.bpm)} BPM`; }
  SFX.noise(2.5, 0.25, 2000, 0.2, "bandpass");
  setTimeout(() => { $("endOv").hidden = false; }, 1200);
}

function update(dt) {
  S.t += dt; S.swing = Math.max(0, S.swing - dt * 3);
  if (!MB.live()) { if (keys.ArrowLeft) S.tilt = Math.max(-1, S.tilt - dt * 2); else if (keys.ArrowRight) S.tilt = Math.min(1, S.tilt + dt * 2); else S.tilt *= 0.95; }
  for (const k in S.flash) S.flash[k] = Math.max(0, S.flash[k] - dt * 2.5);
  S.notes = S.notes.filter((n) => (n.life -= dt) > 0); for (const n of S.notes) { n.y -= 40 * dt; n.x += n.vx * dt; }
  S.fw = S.fw.filter((p) => (p.life -= dt) > 0); for (const p of S.fw) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
  if (S.mode === "lab" && S.running) { const side = S.tilt > 0.5 ? "right" : S.tilt < -0.5 ? "left" : "mid"; if (side !== S.side) { S.side = side; labFire("tilt", side); } }
  if (!S.running || S.waiting) return;
  const now = performance.now() / 1000, iv = S.bpm ? 60 / S.bpm : 1;
  // 指揮停下來：樂團慢慢停住，等下一拍
  if (now - S.lastBeat > iv * 1.6) { S.waiting = S.pos % 1 > 0.85 || S.pos % 1 < 0.05; if (S.waiting) { S.pos = Math.round(S.pos); toast("樂團在等你揮下一拍…"); return; } }
  const bps = S.bpm / 60; S.pos += bps * dt;
  const a = SFX.audio(); const look = 0.12 * bps;
  while (S.next < EV.length && EV[S.next].beat < S.pos + look) {
    const ev = EV[S.next++];
    if (ev.beat < S.pos - 0.25) continue;
    const when = (a ? a.currentTime : 0) + Math.max(0, (ev.beat - S.pos) / bps);
    play(ev, when, ev.len / bps);
    const key = ev.sec === "bass" ? "str" : ev.sec; setTimeout(() => { S.flash[key] = 1; if (ev.sec !== "bass" && Math.random() < 0.5) S.notes.push({ sec: key, x: rnd(-60, 60), y: 0, vx: rnd(-20, 20), life: 1.4 }); }, Math.max(0, (ev.beat - S.pos) / bps * 1000));
  }
  const bar = Math.floor(S.pos / 4);
  if (bar !== S.bar && bar < BARS) { S.bar = bar; if (S.mode !== "lab") MB.send("bar"); hud(); labFire("everybar"); labFire("bar", bar + 1); if (S.mode === "challenge") { const t = TARGETS.find((x) => x[0] === bar); if (t) toast(`${t[2]}：大約每分鐘 ${t[1]} 拍`); } }
  if (S.pos >= BEATS + 1) { if (S.mode === "lab") labSongEnd(); else finish(); }
}

/* ---------- 畫面：指揮台背後視角（音樂廳／練習室） ---------- */
const IMG = {};
for (const k of ["hall", "room", "str", "wood", "brass", "drum", "fox-up", "fox-down"]) { IMG[k] = new Image(); IMG[k].src = `assets/maestro-${k}.webp`; }
const ok = (im) => im && im.complete && im.naturalWidth;
// 各聲部在背景圖上的位置（比例，以腳底中心為準）和寬度
const LAYOUT = {
  hall: { wood: [0.34, 0.60, 0.25], brass: [0.66, 0.60, 0.25], str: [0.23, 0.79, 0.33], drum: [0.77, 0.79, 0.30] },
  room: { wood: [0.35, 0.58, 0.24], brass: [0.66, 0.58, 0.24], str: [0.24, 0.78, 0.32], drum: [0.77, 0.78, 0.29] },
};
let BG = { x: 0, y: 0, w: 1, h: 1 };
function bgRect(im) { const iw = im.naturalWidth || 1376, ih = im.naturalHeight || 768, s = Math.max(W / iw, H / ih); BG = { w: iw * s, h: ih * s, x: (W - iw * s) / 2, y: (H - ih * s) * 0.35 }; return BG; }
function secPos(key) { const L = LAYOUT[S.scene] || LAYOUT.hall, [fx, fy, fw] = L[key]; return { x: BG.x + fx * BG.w, y: BG.y + fy * BG.h, w: fw * BG.w }; }
function drawSection(key) {
  const im = IMG[key], p = secPos(key), f = S.flash[key], gm = gainOf(key), v = S.vol[key] ?? 1;
  if (!ok(im)) return;
  const w = p.w, h = w * im.naturalHeight / im.naturalWidth;
  // 聚光燈：聲部越大聲越亮
  g.save(); g.globalCompositeOperation = "lighter";
  const gr = g.createRadialGradient(p.x, p.y - h * 0.5, 10, p.x, p.y - h * 0.5, w * 0.62);
  gr.addColorStop(0, `rgba(255,214,140,${(0.08 + f * 0.28) * Math.min(1.6, gm)})`); gr.addColorStop(1, "rgba(255,214,140,0)");
  g.fillStyle = gr; g.fillRect(p.x - w, p.y - h * 1.6, w * 2, h * 2.2); g.restore();
  // 演奏時上下跳一下
  const bob = f * h * 0.035, sq = 1 - f * 0.03;
  g.save(); if (v === 0) { g.filter = "grayscale(1) brightness(.6)"; g.globalAlpha = 0.75; }
  g.translate(p.x, p.y); g.scale(1 + f * 0.012, sq); g.drawImage(im, -w / 2, -h - bob, w, h); g.restore(); g.filter = "none";
  // 名牌和音量
  const bars = v === 0 ? "靜音" : "▮".repeat(clamp(Math.round(gm * 3), 1, 6));
  g.font = "900 15px Noto Sans TC, sans-serif"; g.textAlign = "center"; const label = `${SECT[key].name} ${bars}`, tw = g.measureText(label).width + 20;
  const ly = key === "wood" || key === "brass" ? p.y - h - 30 : p.y + 4;
  g.fillStyle = "rgba(43,29,20,.82)"; g.fillRect(p.x - tw / 2, ly, tw, 24); g.strokeStyle = SECT[key].col; g.lineWidth = 2; g.strokeRect(p.x - tw / 2, ly, tw, 24);
  g.fillStyle = "#f3eee1"; g.fillText(label, p.x, ly + 17);
}
function drawFox() {
  const down = S.swing > 0.55, im = IMG[down ? "fox-down" : "fox-up"]; if (!ok(im)) return;
  const h = Math.min(H * 0.44, W * 0.38), w = h * im.naturalWidth / im.naturalHeight;
  const cx = W / 2 + S.tilt * 10, by = H + h * 0.06 + S.swing * h * 0.025;
  // 指揮台上的光
  const gr = g.createRadialGradient(cx, by - h * 0.45, 20, cx, by - h * 0.45, h * 0.75); gr.addColorStop(0, "rgba(255,230,170,.22)"); gr.addColorStop(1, "rgba(255,230,170,0)");
  g.fillStyle = gr; g.fillRect(cx - h, by - h * 1.3, h * 2, h * 1.4);
  g.save(); g.translate(cx, by); g.rotate(S.tilt * 0.07); g.drawImage(im, -w / 2, -h, w, h); g.restore();
  // 指揮棒揮過的軌跡
  if (S.swing > 0.05) { g.strokeStyle = `rgba(255,255,255,${S.swing * 0.6})`; g.lineWidth = 3; g.beginPath(); const tx = cx + w * 0.3, ty = by - h * 0.92;
    g.arc(tx - w * 0.05, ty + h * 0.12, h * 0.16, -1.9, -1.9 + S.swing * 1.6); g.stroke(); }
}
function draw() {
  const bgIm = IMG[S.scene === "room" ? "room" : "hall"];
  g.fillStyle = "#1a0e08"; g.fillRect(0, 0, W, H);
  if (ok(bgIm)) { const r = bgRect(bgIm); g.drawImage(bgIm, r.x, r.y, r.w, r.h); } else bgRect({ naturalWidth: 1376, naturalHeight: 768 });
  // 沒在指揮時燈光暗一點
  const idle = !S.running || S.waiting ? 0.28 : 0;
  if (idle) { g.fillStyle = `rgba(10,5,0,${idle})`; g.fillRect(0, 0, W, H); }
  if (S.mode === "lab" && S.light !== "warm") { g.fillStyle = { blue: "rgba(40,90,220,.3)", red: "rgba(220,40,60,.3)", green: "rgba(40,200,120,.26)", rainbow: `hsla(${(S.t * 90) % 360},80%,50%,.26)`, dark: "rgba(0,0,0,.55)" }[S.light] || "transparent"; g.fillRect(0, 0, W, H); }
  for (const key of ["wood", "brass", "str", "drum"]) drawSection(key);
  for (const n of S.notes) { const p = secPos(n.sec); g.globalAlpha = clamp(n.life, 0, 1); g.fillStyle = SECT[n.sec].col; g.strokeStyle = "#2b1d14"; g.lineWidth = 3; g.font = "900 30px serif"; g.textAlign = "center";
    g.strokeText("♪", p.x + n.x, p.y - p.w * 0.45 + n.y); g.fillText("♪", p.x + n.x, p.y - p.w * 0.45 + n.y); } g.globalAlpha = 1;
  drawFox();
  for (const p of S.fw) { g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.col; g.fillRect(p.x - 2, p.y - 2, 4, 4); } g.globalAlpha = 1;
  // 速度錶
  const mx = W - 120, my = H - 70, r = 74;
  g.fillStyle = "rgba(43,29,20,.78)"; g.beginPath(); g.arc(mx, my, r + 18, Math.PI, 0); g.lineTo(mx + r + 18, my + 30); g.lineTo(mx - r - 18, my + 30); g.closePath(); g.fill();
  g.lineWidth = 12; g.strokeStyle = "#ffffff22"; g.beginPath(); g.arc(mx, my, r, Math.PI, 0); g.stroke();
  if (S.mode === "challenge" || (S.mode === "lab" && S.labTarget)) { const [, tg] = target(); const a1 = Math.PI + clamp((tg * 0.85 - 40) / 200, 0, 1) * Math.PI, a2 = Math.PI + clamp((tg * 1.15 - 40) / 200, 0, 1) * Math.PI; g.strokeStyle = "#3ee69a"; g.beginPath(); g.arc(mx, my, r, a1, a2); g.stroke(); }
  const na = Math.PI + clamp(((S.bpm || 40) - 40) / 200, 0, 1) * Math.PI; g.strokeStyle = "#ffc94a"; g.lineWidth = 4; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(na) * r, my + Math.sin(na) * r); g.stroke();
  g.fillStyle = "#f3eee1"; g.font = "700 12px Space Mono, monospace"; g.textAlign = "center"; g.fillText("40", mx - r, my + 20); g.fillText("240", mx + r, my + 20); g.fillText("BPM", mx, my + 20);
  if (S.running && S.waiting) { g.font = "900 30px Noto Sans TC, sans-serif"; g.lineWidth = 6; g.strokeStyle = "#2b1d14"; g.fillStyle = "#ffc94a"; const t = S.pos < 0.5 ? "往下揮一下，開始演奏！" : "樂團在等你…";
    g.strokeText(t, W / 2, H * 0.2); g.fillText(t, W / 2, H * 0.2); }
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", () => start(b.dataset.mode)));
$("againBtn").onclick = () => start(S.mode);
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.mode === "lab") LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
