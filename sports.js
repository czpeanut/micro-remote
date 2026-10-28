"use strict";
/*
 * micro:bit 運動會 — 主題2 第六堂
 *  micro:bit → 平板：x:數字（加速度 x，左右傾斜，約 -1024～1024）
 *                    s:數字（揮動力道 = 加速度強度，超過門檻時才送，約 1500～3500）
 *  平板 → micro:bit：good#（打得好）、miss#（沒打到）
 */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const cv = $("view"), g = cv.getContext("2d");
let W = 0, H = 0;
function resize() { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); }
addEventListener("resize", resize); resize();

const S = { game: null, running: false, tilt: 0, t: 0, msg: "", msgT: 0, parts: [],
  lab: false, npins: 10, bumper: false, aim: true, ballSpd: 1, cpu: 1, curve: true, power: 0, res: 0, dist: 0, timing: 0 };
const labFire = (ev, arg) => { if (S.lab && typeof LAB !== "undefined") LAB.fire(ev, arg); };
const powerOf = (s) => clamp((s - 1500) / 2000, 0.05, 1);

/* ---------- 輸入 ---------- */
MB.on((ev) => {
  if (ev.key === "x") setTilt(clamp(ev.value / 1024, -1, 1));
  if (ev.key === "s") swing(powerOf(ev.value), ev.value);
});
function setTilt(v) { S.tilt = v; $("tilt").style.left = `${50 + v * 48}%`; }
const keys = {}; let charge = 0;
addEventListener("keydown", (e) => { keys[e.key] = true; if (e.key === " ") e.preventDefault(); });
addEventListener("keyup", (e) => { keys[e.key] = false; if (e.key === " ") { const s = 1500 + charge * 2000; swing(powerOf(s), Math.round(s)); charge = 0; } });
function swing(p, raw) {
  $("pw").style.width = `${p * 100}%`; $("pwv").textContent = raw;
  setTimeout(() => { $("pw").style.width = "0"; }, 900);
  S.power = Math.round(p * 100);
  if (S.running) labFire("swing");
  if (S.running && GAMES[S.game].swing) GAMES[S.game].swing(p);
}
function say(t, good) { S.msg = t; S.msgT = 1.6; if (S.lab) return; if (good === true) MB.send("good"); if (good === false) MB.send("miss"); }
function hud(l1, v1, l2, v2) { $("l1").textContent = l1; $("v1").textContent = v1; $("l2").textContent = l2; $("v2").textContent = v2; }
function burst(x, y, col, n = 16, sp = 200) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(30, sp); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.4, 0.9), col }); } }
/* ---------- 插圖（背景與角色） ---------- */
const SPR = {};
for (const k of ["bowl", "tennis", "base", "fox-bowl-a", "fox-bowl-b", "fox-ten-a", "fox-ten-b", "fox-bat-a", "fox-bat-b", "bear-a", "bear-b", "rabbit"]) { SPR[k] = new Image(); SPR[k].src = `assets/sp-${k}.webp`; }
const sok = (k) => SPR[k] && SPR[k].complete && SPR[k].naturalWidth;
function cover(k, ay = 0.5) { const im = SPR[k], iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(W / iw, H / ih), r = { s, x: (W - iw * s) / 2, y: (H - ih * s) * ay }; g.drawImage(im, r.x, r.y, iw * s, ih * s); return r; }
function sprite(k, x, y, h, rot = 0, flip = false) { if (!sok(k)) return; const im = SPR[k], kk = h / 380, w = im.naturalWidth * kk, hh = im.naturalHeight * kk;
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1); g.drawImage(im, -w / 2, -hh, w, hh); g.restore(); }
function finish(title, text, score) { if (S.lab) return; S.running = false; $("endTitle").textContent = title; $("endText").textContent = text; $("endScore").textContent = score; setTimeout(() => { $("endOv").hidden = false; }, 900); }
const sfx = {
  whoosh(p) { SFX.noise(0.25, 0.15 + p * 0.2, 1200 + p * 2000, 0, "bandpass"); },
  hit(p) { SFX.tone(500 + p * 400, 200, 0.12, "square", 0.12); SFX.noise(0.08, 0.3, 3000); },
  pins() { for (let i = 0; i < 6; i++) SFX.noise(0.12, 0.25, 2500, i * 0.04); },
  cheer() { SFX.noise(1.2, 0.18, 1800, 0, "bandpass"); [523, 659, 784].forEach((f, i) => SFX.tone(f, f, 0.25, "triangle", 0.12, i * 0.1)); },
  boo() { SFX.tone(300, 150, 0.4, "sawtooth", 0.1); },
};

/* ================= 保齡球 ================= */
const BOWL = (() => {
  const L = 18, LW = 0.53, BR = 0.11, PR = 0.06;
  let st;
  function rack() {
    const pins = []; const rows = [[0], [-0.15, 0.15], [-0.3, 0, 0.3], [-0.45, -0.15, 0.15, 0.45]];
    const nr = S.npins >= 10 ? 4 : S.npins >= 6 ? 3 : S.npins >= 3 ? 2 : 1;
    rows.slice(0, nr).forEach((r, i) => r.forEach((x) => pins.push({ x: x * 0.8, z: 16 + i * 0.26, vx: 0, vz: 0, down: false, fall: 0 })));
    return pins;
  }
  function init() { st = { frame: 1, total: 0, pins: rack(), ball: null, phase: "aim", wait: 0, lastDown: 0 }; upd(); }
  function upd() { hud("倒瓶", st.total, "第幾球", `${Math.min(st.frame, 5)}/5`); }
  function swing(p) {
    if (st.phase !== "aim") return;
    st.ball = { x: S.tilt * (LW - BR), z: 0.5, vx: S.tilt * -0.05, vz: 4 + p * 9 }; st.phase = "roll"; sfx.whoosh(p);
  }
  function step(dt) {
    if (st.phase === "aim") return;
    const b = st.ball;
    if (st.phase === "roll") {
      const n = 6;
      for (let k = 0; k < n; k++) {
        const h = dt / n;
        b.x += b.vx * h; b.z += b.vz * h;
        if (Math.abs(b.x) > LW - BR * 0.5) { if (S.bumper) { b.vx = -b.vx * 0.8 - Math.sign(b.x) * 0.05; } else { b.gutter = true; b.vx = 0; } b.x = Math.sign(b.x) * (LW - BR * 0.5); }
        for (const pin of st.pins) {
          pin.x += pin.vx * h; pin.z += pin.vz * h; pin.vx *= 1 - 3 * h; pin.vz *= 1 - 3 * h; if (Math.abs(pin.x) > LW + 0.05) { pin.x = Math.sign(pin.x) * (LW + 0.05); pin.vx *= -0.3; } if (pin.z > L + 1.2) { pin.z = L + 1.2; pin.vz = 0; }
          if (!b.gutter) { const dx = pin.x - b.x, dz = pin.z - b.z, d = Math.hypot(dx, dz);
            if (d < BR + PR && d > 0) { const nx = dx / d, nz = dz / d, rel = b.vx * nx + b.vz * nz;
              if (rel > 0) { pin.vx += nx * rel * 1.15; pin.vz += nz * rel * 1.15; b.vx -= nx * rel * 0.25; b.vz -= nz * rel * 0.25; pin.down = true; } } }
        }
        for (let i = 0; i < st.pins.length; i++) for (let j = i + 1; j < st.pins.length; j++) {
          const a = st.pins[i], c = st.pins[j], dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
          if (d < PR * 2 && d > 0) { const nx = dx / d, nz = dz / d, rel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
            if (rel > 0) { a.vx -= nx * rel * 0.9; a.vz -= nz * rel * 0.9; c.vx += nx * rel * 0.9; c.vz += nz * rel * 0.9; if (a.down || c.down) { a.down = c.down = true; } } }
        }
      }
      for (const pin of st.pins) if (pin.down) pin.fall = Math.min(1, pin.fall + dt * 3);
      if (b.z > L + 1) { st.phase = "count"; st.wait = 1.4; }
    } else if (st.phase === "count") {
      for (const pin of st.pins) { pin.x += pin.vx * dt; pin.z += pin.vz * dt; pin.vx *= 0.95; pin.vz *= 0.95; if (pin.down) pin.fall = Math.min(1, pin.fall + dt * 3); }
      st.wait -= dt;
      if (st.wait <= 0) {
        const down = st.pins.filter((p) => p.down).length; st.total += down;
        if (down === st.pins.length) { say("全倒！STRIKE！", true); sfx.cheer(); } else if (down >= 7) { say(`打倒 ${down} 支！`, true); sfx.pins(); } else if (down > 0) { say(`打倒 ${down} 支`, true); sfx.pins(); } else { say(st.ball.gutter ? "洗溝了…" : "一支都沒倒", false); sfx.boo(); }
        st.frame++; upd(); S.res = down; labFire("bowl");
        if (st.frame > 5 && !S.lab) finish("保齡球結束！", "5 球一共打倒：", `${st.total} 支瓶`);
        else { st.pins = rack(); st.ball = null; st.phase = "aim"; }
      }
    }
  }
  function proj(x, z) { const hz = H * 0.16, near = H * 1.0, k = 6; const s = k / (z + k); return { x: W / 2 + x * W * 0.9 * s, y: hz + (near - hz) * s, s }; }
  function draw() {
    if (sok("bowl")) { cover("bowl", 0.4); g.fillStyle = "rgba(20,10,30,.18)"; g.fillRect(0, 0, W, H); }
    else { const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#2a1d33"); sky.addColorStop(1, "#4a2c3d"); g.fillStyle = sky; g.fillRect(0, 0, W, H); }
    // 後牆
    const wl = proj(-LW - 0.4, L + 1.5), wr = proj(LW + 0.4, L + 1.5);
    if (!sok("bowl")) {
    g.fillStyle = "#1c1424"; g.fillRect(wl.x - 40, wl.y - (wr.x - wl.x) * 0.5, wr.x - wl.x + 80, (wr.x - wl.x) * 0.5);
    g.fillStyle = "#f5c547"; g.font = `900 ${Math.round((wr.x - wl.x) * 0.08)}px Noto Sans TC, sans-serif`; g.textAlign = "center"; g.fillText("micro:bit BOWLING", W / 2, wl.y - (wr.x - wl.x) * 0.3); }
    // 球道
    const a = proj(-LW - 0.1, 0), b = proj(LW + 0.1, 0), c = proj(LW + 0.1, L + 1.5), d = proj(-LW - 0.1, L + 1.5);
    g.fillStyle = "#3a3a46"; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.fill();
    const e = proj(-LW, 0), f = proj(LW, 0), h = proj(LW, L + 1.5), i = proj(-LW, L + 1.5);
    const wood = g.createLinearGradient(0, i.y, 0, e.y); wood.addColorStop(0, "#b98a52"); wood.addColorStop(1, "#e2b878");
    g.fillStyle = wood; g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(f.x, f.y); g.lineTo(h.x, h.y); g.lineTo(i.x, i.y); g.fill();
    g.strokeStyle = "rgba(120,80,40,.35)"; g.lineWidth = 1;
    for (let k = -4; k <= 4; k++) { const p1 = proj(k * LW / 5, 0), p2 = proj(k * LW / 5, L + 1.5); g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke(); }
    for (let k = -2; k <= 2; k++) { const p = proj(k * 0.12, 4.5); g.fillStyle = "#5b3a1e"; g.beginPath(); g.moveTo(p.x, p.y - 10 * p.s * 3); g.lineTo(p.x - 6, p.y); g.lineTo(p.x + 6, p.y); g.fill(); }
    // 瞄準線
    if (st.phase === "aim" && S.aim) { const p1 = proj(S.tilt * (LW - BR), 0.5), p2 = proj(S.tilt * (LW - BR), 16); g.setLineDash([8, 8]); g.strokeStyle = "rgba(255,201,74,.8)"; g.lineWidth = 3; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke(); g.setLineDash([]); }
    // 瓶（由遠到近畫）
    const items = st.pins.map((p) => ({ z: p.z, f: () => drawPin(p) }));
    const bb = st.ball || { x: S.tilt * (LW - BR), z: 0.5 };
    if (st.ball || !sok("fox-bowl-a")) items.push({ z: bb.z, f: () => { const p = proj(bb.x, bb.z), r = BR * W * 0.9 * p.s; const gr = g.createRadialGradient(p.x - r * 0.3, p.y - r * 1.3, r * 0.1, p.x, p.y - r, r);
      gr.addColorStop(0, "#7fb8ff"); gr.addColorStop(1, "#1b3f8f"); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y - r, r, 0, 7); g.fill(); } });
    items.sort((u, v) => v.z - u.z).forEach((it) => it.f());
    // 酷丁狐（背對畫面）：瞄準時拿著球，丟出去後換成出手的姿勢
    const aimX = st.ball ? clamp(st.ball.x, -LW, LW) : S.tilt * (LW - BR), fp = proj(aimX, 0);
    const throwing = !!st.ball;
    sprite(throwing ? "fox-bowl-b" : "fox-bowl-a", fp.x - W * 0.03, H + H * 0.02, H * 0.46, throwing ? 0 : S.tilt * 0.05);
  }
  function drawPin(p) {
    const q = proj(p.x, p.z), hgt = 0.28 * W * 0.9 * q.s, w = PR * W * 0.9 * q.s;
    g.save(); g.translate(q.x, q.y); g.rotate(p.fall * 1.4 * (p.x >= 0 ? 1 : -1)); g.globalAlpha = 1 - p.fall * 0.3;
    g.fillStyle = "#fbf7ef"; g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 1.6, -hgt * 0.45, -w * 0.5, -hgt * 0.7); g.quadraticCurveTo(-w * 1.1, -hgt, 0, -hgt);
    g.quadraticCurveTo(w * 1.1, -hgt, w * 0.5, -hgt * 0.7); g.quadraticCurveTo(w * 1.6, -hgt * 0.45, w, 0); g.fill();
    g.fillStyle = "#d33"; g.fillRect(-w * 0.6, -hgt * 0.72, w * 1.2, hgt * 0.06); g.fillRect(-w * 0.62, -hgt * 0.63, w * 1.24, hgt * 0.05);
    g.restore();
  }
  return { name: "保齡球", init, step, draw, swing, rerack() { if (st && st.phase === "aim") st.pins = rack(); } };
})();

/* ================= 網球 ================= */
const TENNIS = (() => {
  let st;
  const CW = 1, CL = 2;
  function init() { st = { me: 0, cpu: 0, ball: null, phase: "serve", wait: 1.2, cpuX: 0, myX: 0, swingT: -9 }; upd(); }
  function upd() { hud("我", st.me, "電腦", st.cpu); }
  function serve() { const tx = rnd(-0.35, 0.35); st.ball = { x: st.cpuX, y: 0.05, tx, vy: rnd(0.8, 1.05) * S.ballSpd, from: "cpu", h: 0 }; st.phase = "play"; SFX.tone(400, 200, 0.08, "square", 0.08); }
  function swing(p) {
    st.swingT = S.t; sfx.whoosh(p);
    const b = st.ball; if (!b || st.phase !== "play" || b.from !== "cpu") return;
    const err = (b.y - 0.9) / b.vy; // 球還要多久到達擊球點（負的代表太晚）
    if (Math.abs(err) > 0.28) return; // 太早或太晚，揮空
    sfx.hit(p);
    const dir = clamp(S.tilt * 0.45 + err * 1.4, -0.6, 0.6);
    b.from = "me"; b.vy = -(0.8 + p * 1.1); b.tx = clamp(b.x + dir, -0.45, 0.45); b.power = p;
    const timing = Math.abs(err) < 0.08 ? "完美時機！" : err > 0 ? "有點早" : "有點晚";
    say(timing, Math.abs(err) < 0.15);
    S.timing = Math.round(Math.abs(err) * 1000); labFire("hit");
  }
  function point(who, text) {
    if (who === "me") { st.me++; sfx.cheer(); } else { st.cpu++; sfx.boo(); }
    say(text, who === "me"); upd(); st.phase = "wait"; st.wait = 1.6; st.ball = null;
    labFire("point", who); if (who === "cpu") labFire("miss");
    if (st.me >= 5 || st.cpu >= 5) finish(st.me >= 5 ? "你贏了！" : "電腦贏了", "比數", `${st.me} : ${st.cpu}`);
  }
  function step(dt) {
    st.myX = lerp(st.myX, st.ball ? st.ball.x : 0, dt * 4);
    if (st.phase === "serve" || st.phase === "wait") { st.wait -= dt; st.cpuX = lerp(st.cpuX, 0, dt * 2); if (st.wait <= 0 && S.running) serve(); return; }
    const b = st.ball; if (!b) return;
    const tot = 0.85; b.y += b.vy * dt; const prog = b.from === "cpu" ? (b.y - 0.05) / tot : (0.9 - b.y) / tot;
    b.x = lerp(b.from === "cpu" ? st.cpuX : st.myX, b.tx, clamp(prog, 0, 1)); b.h = Math.sin(clamp(prog, 0, 1) * Math.PI) * 0.6 + 0.08;
    if (b.from === "cpu") {
      if (b.y > 1.08) point("cpu", "沒接到…");
    } else {
      st.cpuX = lerp(st.cpuX, b.tx, dt * (1.4 + 0.4 * Math.random()) * S.cpu);
      if (b.y < 0.08) {
        const reach = (0.16 - b.power * 0.08) * Math.sqrt(S.cpu);
        if (Math.abs(st.cpuX - b.x) < reach) { b.from = "cpu"; b.vy = rnd(0.85, 1.15) * S.ballSpd; b.tx = clamp(rnd(-0.4, 0.4), -0.45, 0.45); SFX.tone(450, 220, 0.08, "square", 0.08); }
        else point("me", b.power > 0.7 ? "好球！電腦接不到！" : "得分！");
      }
    }
  }
  let BG = null;
  function cp(x, y) {
    if (BG) { // 照背景圖上球場的透視：遠端底線 y=345、寬 295；近端底線 y=595、寬 745（原圖座標）
      const k = 0.316, t = clamp(y, -0.1, 1.15), ty = k * t / (1 + (k - 1) * t), Y = 345 + 250 * ty, hw = lerp(147.5, 372.5, ty);
      return { x: BG.x + (687.5 + x * 2 * hw) * BG.s, y: BG.y + Y * BG.s, s: (hw / 372.5) * BG.s * 1.25 }; }
    const top = H * 0.16, bot = H * 0.92, t = y; const wTop = W * 0.32, wBot = W * 0.78; const w = lerp(wTop, wBot, t); return { x: W / 2 + x * w, y: lerp(top, bot, t), s: lerp(0.55, 1, t) }; }
  function draw() {
    BG = sok("tennis") ? cover("tennis", 0.3) : null;
    if (BG) { drawArt(); return; }
    g.fillStyle = "#2d6a3a"; g.fillRect(0, 0, W, H);
    const c1 = cp(-0.5, 0), c2 = cp(0.5, 0), c3 = cp(0.5, 1), c4 = cp(-0.5, 1);
    g.fillStyle = "#3d7fc4"; g.beginPath(); g.moveTo(c1.x, c1.y); g.lineTo(c2.x, c2.y); g.lineTo(c3.x, c3.y); g.lineTo(c4.x, c4.y); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 3; g.stroke();
    const m1 = cp(-0.5, 0.5), m2 = cp(0.5, 0.5); g.fillStyle = "#222"; g.fillRect(m1.x - 10, m1.y - 22, m2.x - m1.x + 20, 22); g.strokeStyle = "#eee"; g.strokeRect(m1.x - 10, m1.y - 22, m2.x - m1.x + 20, 22);
    const s1 = cp(0, 0.25), s2 = cp(0, 0.75); g.beginPath(); g.moveTo(s1.x, s1.y); g.lineTo(s2.x, s2.y); g.stroke();
    // 球員
    const drawP = (x, y, col, me) => { const p = cp(x, y), r = 22 * p.s; g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y - r * 2.4, r * 0.8, 0, 7); g.fill(); g.fillRect(p.x - r * 0.7, p.y - r * 1.6, r * 1.4, r * 1.6);
      if (me) { const ang = S.t - st.swingT < 0.25 ? -1.2 + (S.t - st.swingT) * 10 : -0.6 + S.tilt * 0.6; g.save(); g.translate(p.x + r, p.y - r * 1.2); g.rotate(ang); g.strokeStyle = "#333"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 1.6); g.stroke(); g.beginPath(); g.ellipse(0, -r * 2.3, r * 0.5, r * 0.75, 0, 0, 7); g.stroke(); g.restore(); } };
    drawP(st.cpuX, 0.02, "#c4521a", false); drawP(st.myX, 0.97, "#f5c547", true);
    const b = st.ball;
    if (b) { const p = cp(b.x, b.y), r = 9 * p.s; g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.4, 0, 0, 7); g.fill();
      g.fillStyle = "#e8ff3a"; g.beginPath(); g.arc(p.x, p.y - b.h * 120 * p.s, r, 0, 7); g.fill();
      if (S.aim && b.from === "cpu" && b.y > 0.62) { const hz = cp(0, 0.9); g.strokeStyle = "rgba(255,255,255,.35)"; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(cp(-0.5, 0.9).x, hz.y); g.lineTo(cp(0.5, 0.9).x, hz.y); g.stroke(); g.setLineDash([]); } }
  }
  function drawArt() {
    const b = st.ball, rp = cp(st.cpuX, 0.0), mp = cp(st.myX, 1.0);
    if (b && b.from === "me") { const p = cp(b.x, b.y), r = 9 * p.s; ball(b, p, r); }
    sprite("rabbit", rp.x, rp.y + 4 * BG.s, 120 * BG.s, 0, st.cpuX > 0.1);
    if (b && b.from === "cpu") { const p = cp(b.x, b.y), r = 9 * p.s; ball(b, p, r);
      if (S.aim && b.y > 0.62) { const a = cp(-0.5, 0.9), c = cp(0.5, 0.9); g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 3; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); g.setLineDash([]); } }
    const sw = S.t - st.swingT < 0.3;
    sprite(sw ? "fox-ten-b" : "fox-ten-a", mp.x - W * 0.02, H + H * 0.03, H * 0.42, sw ? -0.05 : S.tilt * 0.06);
  }
  function ball(b, p, r) { g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.4, 0, 0, 7); g.fill();
    g.fillStyle = "#e8ff3a"; g.strokeStyle = "#7a8a10"; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y - b.h * 120 * p.s, r, 0, 7); g.fill(); g.stroke(); }
  return { name: "網球", init, step, draw, swing };
})();

/* ================= 棒球 ================= */
const BASE = (() => {
  let st;
  function init() { st = { n: 0, hr: 0, best: 0, ball: null, phase: "wait", wait: 1.5, fly: null, swingT: -9 }; upd(); }
  function upd() { hud("全壘打", st.hr, "第幾球", `${Math.min(st.n + 1, 10)}/10`); }
  function pitch() { st.ball = { t: 0, dur: rnd(0.9, 1.3) / S.ballSpd, curve: S.curve ? rnd(-0.15, 0.15) : 0 }; st.phase = "pitch"; SFX.tone(300, 120, 0.1, "square", 0.06); }
  function next() { st.n++; upd(); if (st.n >= 10 && !S.lab) finish("比賽結束！", `最遠一球 ${Math.round(st.best)} 公尺，全壘打：`, `${st.hr} 支`); else { st.phase = "wait"; st.wait = 1.4; } }
  function swing(p) {
    st.swingT = S.t; sfx.whoosh(p);
    if (st.phase !== "pitch") return;
    const b = st.ball, err = b.t - b.dur; // 0 = 剛好到本壘
    if (Math.abs(err) > 0.22) return;
    sfx.hit(p);
    const good = Math.abs(err) < 0.07 ? 1 : Math.abs(err) < 0.14 ? 0.7 : 0.35;
    const dist = 20 + p * good * 110;
    const foul = Math.abs(err) >= 0.14;
    st.fly = { t: 0, dist, ang: clamp(-err * 4 + S.tilt * 0.3, -1, 1), foul }; st.ball = null; st.phase = "fly";
    st.best = Math.max(st.best, foul ? 0 : dist);
    if (foul) say(err < 0 ? "太早了！界外球" : "太晚了！界外球", false);
    else if (dist >= 100) { st.hr++; say(`全壘打！${Math.round(dist)} 公尺`, true); sfx.cheer(); }
    else say(`安打！${Math.round(dist)} 公尺`, true);
    S.dist = foul ? 0 : Math.round(dist); S.timing = Math.round(Math.abs(err) * 1000); labFire("hit");
  }
  function step(dt) {
    if (st.phase === "wait") { st.wait -= dt; if (st.wait <= 0 && S.running) pitch(); }
    else if (st.phase === "pitch") { st.ball.t += dt; if (st.ball.t > st.ball.dur + 0.25) { say("好球！沒打到", false); sfx.boo(); st.ball = null; labFire("miss"); next(); } }
    else if (st.phase === "fly") { st.fly.t += dt; if (st.fly.t > 2) { st.fly = null; next(); } }
  }
  function drawArt() {
    const R = cover("base", 0.55), mx = R.x + 687 * R.s, my = R.y + 585 * R.s, px = R.x + 687 * R.s, py = Math.min(H - 20, R.y + 742 * R.s);
    // 投手熊：投球那一瞬間換成出手的姿勢
    const throwing = st.phase === "pitch" && st.ball && st.ball.t < 0.35;
    sprite(throwing ? "bear-b" : "bear-a", mx, my + 6 * R.s, 150 * R.s);
    if (st.ball) { const k = clamp(st.ball.t / st.ball.dur, 0, 1.3), y = lerp(my - 90 * R.s, py - 40 * R.s, k), x = mx + st.ball.curve * k * k * 260 * R.s, r = lerp(4, 18, Math.min(1, k)) * R.s;
      g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = "#d33"; g.lineWidth = 1.5; g.beginPath(); g.arc(x - r * 0.4, y, r * 0.7, -1, 1); g.stroke(); }
    // 打擊手酷丁狐（背對畫面）
    const sw = S.t - st.swingT < 0.35;
    sprite(sw ? "fox-bat-b" : "fox-bat-a", px - W * 0.13, H + H * 0.03, H * 0.5, sw ? 0 : S.tilt * 0.05);
    if (st.fly) { const k = st.fly.t / 2, d = st.fly.dist, x = W / 2 + st.fly.ang * k * W * 0.45 * (st.fly.foul ? 1.6 : 1), y = H * 0.85 - Math.sin(k * Math.PI) * H * 0.55 * (d / 130) - k * H * 0.3;
      g.fillStyle = "#fff"; g.strokeStyle = "#333"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, lerp(14, 4, k), 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#ffc94a"; g.strokeStyle = "#2b1d14"; g.lineWidth = 6; g.font = "900 40px Noto Sans TC, sans-serif"; g.textAlign = "center"; const tx = st.fly.foul ? "界外" : `${Math.round(d * Math.min(1, k * 1.5))} m`; g.strokeText(tx, W / 2, H * 0.36); g.fillText(tx, W / 2, H * 0.36); }
  }
  function draw() {
    if (sok("base")) { drawArt(); return; }
    const sky = g.createLinearGradient(0, 0, 0, H * 0.45); sky.addColorStop(0, "#5aa7e8"); sky.addColorStop(1, "#bfe3ff"); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = "#2f7a3a"; g.fillRect(0, H * 0.42, W, H); g.fillStyle = "#1f5a2a"; g.fillRect(0, H * 0.4, W, H * 0.03);
    g.fillStyle = "#c79a62"; g.beginPath(); g.moveTo(W / 2, H * 0.52); g.lineTo(W * 0.9, H); g.lineTo(W * 0.1, H); g.fill();
    g.fillStyle = "#b5895a"; g.beginPath(); g.ellipse(W / 2, H * 0.58, 50, 14, 0, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(W / 2 - 22, H * 0.92); g.lineTo(W / 2 + 22, H * 0.92); g.lineTo(W / 2 + 22, H * 0.94); g.lineTo(W / 2, H * 0.96); g.lineTo(W / 2 - 22, H * 0.94); g.fill();
    // 投手
    g.fillStyle = "#c4521a"; g.beginPath(); g.arc(W / 2, H * 0.5, 12, 0, 7); g.fill(); g.fillRect(W / 2 - 10, H * 0.51, 20, 26);
    // 打者（自己的球棒）
    const sw = S.t - st.swingT; const ang = sw < 0.3 ? -2.2 + sw * 12 : -2.2 + S.tilt * 0.3;
    g.save(); g.translate(W / 2 - 70, H * 0.88); g.rotate(ang); g.fillStyle = "#8a5a2b"; g.fillRect(-6, -150, 12, 150); g.restore();
    if (st.ball) { const k = clamp(st.ball.t / st.ball.dur, 0, 1.3), y = lerp(H * 0.53, H * 0.92, k), x = W / 2 + st.ball.curve * k * k * 200, r = lerp(4, 16, Math.min(1, k));
      g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = "#d33"; g.lineWidth = 1.5; g.beginPath(); g.arc(x - r * 0.4, y, r * 0.7, -1, 1); g.stroke(); }
    if (st.fly) { const k = st.fly.t / 2, d = st.fly.dist, x = W / 2 + st.fly.ang * k * W * 0.45 * (st.fly.foul ? 1.6 : 1), y = H * 0.9 - Math.sin(k * Math.PI) * H * 0.5 * (d / 130) - k * H * 0.4;
      g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, lerp(14, 4, k), 0, 7); g.fill();
      g.fillStyle = "#ffc94a"; g.font = "900 34px Noto Sans TC, sans-serif"; g.textAlign = "center"; g.fillText(st.fly.foul ? "界外" : `${Math.round(d * Math.min(1, k * 1.5))} m`, W / 2, H * 0.3); }
  }
  return { name: "棒球", init, step, draw, swing };
})();

const GAMES = { bowl: BOWL, tennis: TENNIS, base: BASE };

/* ---------- 主迴圈 ---------- */
function start(game) {
  S.game = game; S.running = true; $("menu").hidden = true; $("endOv").hidden = true; $("gameName").textContent = GAMES[game].name;
  GAMES[game].init(); SFX.audio();
}
function frame(dt) {
  S.t += dt;
  if (!MB.live()) { let tv = S.tilt; if (keys.ArrowLeft) tv -= dt * 2; else if (keys.ArrowRight) tv += dt * 2; setTilt(clamp(tv, -1, 1)); }
  if (keys[" "]) { charge = Math.min(1, charge + dt * 1.2); $("pw").style.width = `${charge * 100}%`; }
  if (S.game) { GAMES[S.game].step(dt); GAMES[S.game].draw(); } else { g.fillStyle = "#1b3a1f"; g.fillRect(0, 0, W, H); }
  S.parts = S.parts.filter((p) => (p.life -= dt) > 0);
  if (S.msgT > 0) { S.msgT -= dt; g.globalAlpha = clamp(S.msgT * 2, 0, 1); g.fillStyle = "#ffc94a"; g.strokeStyle = "#2b1d14"; g.lineWidth = 6; g.font = "900 44px Noto Sans TC, sans-serif"; g.textAlign = "center";
    g.strokeText(S.msg, W / 2, H * 0.24); g.fillText(S.msg, W / 2, H * 0.24); g.globalAlpha = 1; }
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

document.querySelectorAll(".mode[data-game]").forEach((b) => b.addEventListener("click", () => start(b.dataset.game)));
$("againBtn").onclick = () => start(S.game);
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.lab) LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
