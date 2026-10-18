"use strict";
/*
 * 超音波太空梭 — 主題2 第五堂
 *  micro:bit → 平板：d:距離（公分）。5 公分 = 最低，40 公分 = 最高
 *  平板 → micro:bit：star#（吃到能量水晶）、hit#（撞到隕石）
 */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
let DMIN = 5, DMAX = 40;
const cv = $("view"), g = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener("resize", resize); resize();

const S = { mode: null, running: false, score: 0, lives: 3, left: 60, dist: null, target: 0.5, y: 0.5, vy: 0, inv: 0, speed: 1, t: 0,
  rocks: [], gems: [], parts: [], stars: [], planets: [], spawnR: 0, spawnG: 0, travelled: 0, keyDir: 0, shake: 0 };
for (let i = 0; i < 160; i++) S.stars.push({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1) });
for (let i = 0; i < 3; i++) S.planets.push({ x: rnd(0.2, 1.4), y: rnd(0.1, 0.9), r: rnd(30, 90), hue: rnd(0, 360), sp: rnd(0.004, 0.012) });

/* ---------- 輸入 ---------- */
MB.on((ev) => {
  if (ev.key === "d" && ev.value > 0) setDist(ev.value);
});
function setDist(d) {
  S.dist = d;
  S.target = clamp((d - DMIN) / (DMAX - DMIN), 0, 1);
  $("dist").textContent = Math.round(d);
}
cv.addEventListener("pointermove", (e) => { if (!MB.live()) { S.target = clamp(1 - (e.clientY - 70) / (H - 140), 0, 1); showFake(); } });
addEventListener("keydown", (e) => { if (e.key === "ArrowUp") S.keyDir = 1; if (e.key === "ArrowDown") S.keyDir = -1; });
addEventListener("keyup", (e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") S.keyDir = 0; });
function showFake() { $("dist").textContent = Math.round(DMIN + S.target * (DMAX - DMIN)); }

/* ---------- 音效 ---------- */
const sfx = {
  gem() { SFX.tone(880, 1320, 0.15, "triangle", 0.15); SFX.tone(1320, 1760, 0.12, "triangle", 0.1, 0.07); },
  hit() { SFX.noise(0.5, 0.45, 500); SFX.tone(200, 50, 0.45, "sawtooth", 0.16); },
  end() { [784, 659, 523, 392].forEach((f, i) => SFX.tone(f, f, 0.3, "triangle", 0.14, i * 0.14)); },
  win() { [523, 659, 784, 1046].forEach((f, i) => SFX.tone(f, f, 0.3, "triangle", 0.15, i * 0.1)); },
};

/* ---------- 遊戲流程 ---------- */
function start(mode) {
  Object.assign(S, { mode, running: true, score: 0, lives: 3, left: 60, inv: 0, speed: 1, t: 0, rocks: [], gems: [], parts: [], spawnR: 1.2, spawnG: 0.5, travelled: 0 });
  $("menu").hidden = true; $("endOv").hidden = true;
  $("timeBox").hidden = mode !== "timed";
  hud(); toast(mode === "practice" ? "練習飛行：手抬高、放低試試看！" : "出發！");
  SFX.audio();
}
function end(title, text) {
  S.running = false;
  $("endTitle").textContent = title; $("endText").textContent = text;
  $("endScore").textContent = S.mode === "endless" ? `${Math.floor(S.travelled)} 公里・${S.score} 顆能量` : `${S.score} 顆能量水晶`;
  $("endOv").hidden = false;
}
function hud() {
  $("score").textContent = S.score; $("time").textContent = Math.ceil(S.left);
  $("lives").textContent = S.mode === "practice" ? "∞" : "♥".repeat(S.lives) + "♡".repeat(3 - S.lives);
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1600); }

function shipPos() { return { x: W * 0.2, y: 90 + (1 - S.y) * (H - 180) }; }
function spawnRock() {
  const r = rnd(18, 42) * (H / 800 + 0.4);
  const pts = []; const n = 9 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) pts.push(rnd(0.7, 1.1));
  S.rocks.push({ x: W + r, y: rnd(90, H - 90), r, vx: -rnd(160, 260) * S.speed, vy: rnd(-25, 25), rot: rnd(0, 6), vr: rnd(-1.5, 1.5), pts });
}
function spawnGem() { S.gems.push({ x: W + 20, y: rnd(100, H - 100), vx: -rnd(150, 200) * Math.max(1, S.speed * 0.8), ph: rnd(0, 6) }); }
function burst(x, y, col, n = 18, sp = 220) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(40, sp); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.4, 0.9), col }); } }

function update(dt) {
  S.t += dt;
  if (!MB.live() && S.keyDir) { S.target = clamp(S.target + S.keyDir * dt * 0.9, 0, 1); showFake(); }
  // 太空梭跟著目標高度，有一點慣性
  S.vy += (S.target - S.y) * 30 * dt; S.vy *= Math.pow(0.02, dt); S.y = clamp(S.y + S.vy * dt, 0, 1);
  $("gmark").style.top = `${(1 - S.target) * 100}%`;
  for (const p of S.planets) { p.x -= p.sp * dt * 10; if (p.x < -0.3) { p.x = 1.3; p.y = rnd(0.1, 0.9); p.r = rnd(30, 90); p.hue = rnd(0, 360); } }
  for (const s of S.stars) { s.x -= s.z * dt * 0.25 * (S.running ? S.speed : 0.4); if (s.x < 0) { s.x += 1; s.y = Math.random(); } }
  S.parts = S.parts.filter((p) => (p.life -= dt) > 0); for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; }
  S.shake = Math.max(0, S.shake - dt * 3);
  if (!S.running) return;
  if (S.mode === "lab") { labUpdate(dt); return; }

  if (S.mode === "timed") { S.left -= dt; $("time").textContent = Math.ceil(Math.max(0, S.left)); if (S.left <= 0) { S.left = 0; hud(); sfx.win(); end("時間到！", "你在 60 秒內收集到："); return; } }
  if (S.mode === "endless") { S.speed = 1 + S.t / 40; S.travelled += dt * 10 * S.speed; }
  S.inv = Math.max(0, S.inv - dt);
  if (S.mode !== "practice") { S.spawnR -= dt; if (S.spawnR <= 0) { spawnRock(); S.spawnR = rnd(0.7, 1.4) / Math.sqrt(S.speed); } }
  S.spawnG -= dt; if (S.spawnG <= 0) { spawnGem(); S.spawnG = rnd(0.9, 1.6); }

  const sp = shipPos();
  for (const r of S.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
    if (!r.dead && S.inv <= 0 && Math.hypot(r.x - sp.x, r.y - sp.y) < r.r * 0.85 + 18) {
      r.dead = true; S.lives--; S.inv = 1.5; S.shake = 1; burst(r.x, r.y, "#c9a27a", 26); sfx.hit(); MB.send("hit"); hud();
      if (S.lives <= 0) { sfx.end(); end("護盾用完了", S.mode === "endless" ? "你飛了：" : "你收集到："); return; }
    } }
  S.rocks = S.rocks.filter((r) => !r.dead && r.x > -80);
  for (const m of S.gems) { m.x += m.vx * dt; m.ph += dt * 4;
    if (!m.dead && Math.hypot(m.x - sp.x, m.y - sp.y) < 34) { m.dead = true; S.score++; burst(m.x, m.y, "#7ff3ff", 14, 160); sfx.gem(); MB.send("star"); hud(); } }
  S.gems = S.gems.filter((m) => !m.dead && m.x > -40);
}

/* ---------- 畫面 ---------- */
function drawShip(x, y, tilt) {
  g.save(); g.translate(x, y); g.rotate(tilt);
  const fl = 18 + Math.sin(S.t * 40) * 6;
  const grd = g.createLinearGradient(-30 - fl, 0, -22, 0); grd.addColorStop(0, "rgba(255,120,40,0)"); grd.addColorStop(1, "#ffcf5a");
  g.fillStyle = grd; g.beginPath(); g.moveTo(-22, -7); g.lineTo(-30 - fl, 0); g.lineTo(-22, 7); g.fill();
  g.fillStyle = "#e8eef7"; g.beginPath(); g.moveTo(34, 0); g.quadraticCurveTo(10, -16, -22, -11); g.lineTo(-22, 11); g.quadraticCurveTo(10, 16, 34, 0); g.fill();
  g.fillStyle = "#c4521a"; g.beginPath(); g.moveTo(-6, -11); g.lineTo(-24, -26); g.lineTo(-20, -10); g.fill(); g.beginPath(); g.moveTo(-6, 11); g.lineTo(-24, 26); g.lineTo(-20, 10); g.fill();
  g.fillStyle = "#3b6d8f"; g.beginPath(); g.ellipse(10, -3, 9, 5, 0, 0, 7); g.fill();
  g.fillStyle = "#9fe6ff"; g.beginPath(); g.ellipse(12, -4, 4, 2, 0, 0, 7); g.fill();
  g.restore();
}
function draw() {
  const sh = S.shake > 0 ? S.shake * 8 : 0;
  g.save(); g.translate(rnd(-sh, sh), rnd(-sh, sh));
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#070a26"); bg.addColorStop(1, "#140726"); g.fillStyle = bg; g.fillRect(-20, -20, W + 40, H + 40);
  for (const p of S.planets) { const gr = g.createRadialGradient(p.x * W - p.r * 0.3, p.y * H - p.r * 0.3, p.r * 0.1, p.x * W, p.y * H, p.r);
    gr.addColorStop(0, `hsla(${p.hue},60%,65%,.55)`); gr.addColorStop(1, `hsla(${p.hue},60%,25%,.15)`); g.fillStyle = gr; g.beginPath(); g.arc(p.x * W, p.y * H, p.r, 0, 7); g.fill(); }
  for (const s of S.stars) { g.fillStyle = `rgba(255,255,255,${0.3 + s.z * 0.6})`; g.fillRect(s.x * W, s.y * H, s.z * 2, s.z * 2); }
  for (const m of S.gems) { const r = 13 + Math.sin(m.ph) * 2;
    g.save(); g.translate(m.x, m.y); g.shadowColor = "#7ff3ff"; g.shadowBlur = 18; g.fillStyle = "#bff8ff";
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, r); g.lineTo(-r * 0.7, 0); g.closePath(); g.fill();
    g.fillStyle = "#4fd6f0"; g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, 0); g.closePath(); g.fill(); g.restore(); }
  for (const r of S.rocks) { g.save(); g.translate(r.x, r.y); g.rotate(r.rot);
    g.fillStyle = "#6e5a4b"; g.strokeStyle = "#3d2f25"; g.lineWidth = 3; g.beginPath();
    r.pts.forEach((k, i) => { const a = (i / r.pts.length) * 6.283; const x = Math.cos(a) * r.r * k, y = Math.sin(a) * r.r * k; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#54443a"; g.beginPath(); g.arc(r.r * 0.25, -r.r * 0.2, r.r * 0.22, 0, 7); g.fill(); g.beginPath(); g.arc(-r.r * 0.3, r.r * 0.25, r.r * 0.15, 0, 7); g.fill();
    g.restore(); }
  if (S.mode === "lab") labDraw();
  const sp = shipPos();
  if (!(S.inv > 0 && Math.floor(S.t * 12) % 2)) { g.save(); g.translate(sp.x, sp.y); g.scale(S.shipSz || 1, S.shipSz || 1); drawShip(0, 0, clamp(-S.vy * 0.5, -0.5, 0.5)); g.restore(); }
  if (S.inv > 0) { g.strokeStyle = `rgba(95,225,255,${S.inv / 1.5})`; g.lineWidth = 3; g.beginPath(); g.arc(sp.x, sp.y, 44 * (S.shipSz || 1), 0, 7); g.stroke(); }
  for (const p of S.parts) { g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.col; g.fillRect(p.x - 2, p.y - 2, 4, 4); } g.globalAlpha = 1;
  // 高度刻度
  g.fillStyle = "rgba(255,255,255,.25)"; g.font = "700 12px Space Mono, monospace";
  for (let d = DMIN; d <= DMAX; d += 5) { const y = 90 + (1 - (d - DMIN) / (DMAX - DMIN)) * (H - 180); g.fillRect(8, y, 10, 1); g.fillText(d, 22, y + 4); }
  g.restore();
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

/* ---------- 按鈕 ---------- */
document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", () => start(b.dataset.mode)));
$("againBtn").onclick = () => start(S.mode);
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.mode === "lab") LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
