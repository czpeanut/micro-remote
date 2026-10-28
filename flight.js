"use strict";
/*
 * 酷丁狐飛行島 — 主題2 第五堂（3D 自由飛行，N64 風格的低多邊形世界）
 *  micro:bit → 平板：x:數字（左右傾斜＝轉彎）、y:數字（前後傾斜＝機頭上下）、d:數字（超音波距離＝油門，可不送）
 *  平板 → micro:bit：star#（星星）、ring#（圓環）、crash#（撞到）、end#（結束）
 */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- 地形 ---------- */
const SIZE = 6400, SEG = 128, ISLAND = 2700;
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const RUNWAY = { x: -700, z: 1250, len: 520, w: 70 };
function height(x, z) {
  const r = Math.hypot(x, z) / ISLAND, isl = 1 - r * r;
  const n = vnoise(x / 900 + 3, z / 900) + vnoise(x / 380, z / 380 + 7) * 0.5 + vnoise(x / 160, z / 160) * 0.2;
  let h = (isl * 1.15 - 0.2 + (n - 0.85) * 0.8) * 200;
  h += Math.pow(Math.max(0, 1 - Math.hypot(x - 750, z + 650) / 750), 2) * 560;   // 大山
  h += Math.pow(Math.max(0, 1 - Math.hypot(x + 950, z + 350) / 520), 2) * 320;   // 小山
  h += Math.pow(Math.max(0, 1 - Math.hypot(x - 1300, z - 700) / 380), 2) * 180;
  // 機場跑道附近整平
  const dx = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.len / 2), dz = Math.max(0, Math.abs(z - RUNWAY.z) - RUNWAY.w / 2), dd = Math.hypot(dx, dz);
  if (dd < 160) h = lerp(18, h, clamp(dd / 160, 0, 1) ** 2);
  return h;
}
function ground(x, z) { return Math.max(0, height(x, z)); }

/* ---------- Three.js 場景 ---------- */
const cv = $("view");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
renderer.setPixelRatio(Math.min(1, window.devicePixelRatio || 1) * 0.75);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 1, 9000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); cv.style.width = "100vw"; cv.style.height = "100vh"; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x557744, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-1, 1.6, 0.8); scene.add(sun);
const SKY = {
  day: { bg: 0x7cc4f0, fog: [700, 3600], hemi: 0.9, sun: 1.1 },
  sunset: { bg: 0xf2a066, fog: [600, 3200], hemi: 0.75, sun: 0.9 },
  night: { bg: 0x0b1030, fog: [500, 2800], hemi: 0.35, sun: 0.25 },
  fog: { bg: 0xc8d2dc, fog: [120, 900], hemi: 0.85, sun: 0.6 },
};
scene.fog = new THREE.Fog(0x7cc4f0, 700, 3600);
function setSky(k) {
  const s = SKY[k] || SKY.day; scene.background = new THREE.Color(s.bg); scene.fog.color.setHex(s.bg); scene.fog.near = s.fog[0]; scene.fog.far = s.fog[1];
  hemi.intensity = s.hemi; sun.intensity = s.sun; starField.visible = k === "night"; S.sky = k;
}
// 地面（平面著色的低多邊形）
const terrain = (() => {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  const g = geo.toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, x = p.getX(i), z = p.getZ(i), n = hash(Math.floor(x / 50), Math.floor(z / 50));
    if (y < 4) c.setHex(0xd9c48a); else if (y < 16) c.setHex(0xe8d49a);
    else if (y < 150) c.setHex(n < 0.5 ? 0x58b546 : 0x4fa83e); else if (y < 250) c.setHex(n < 0.5 ? 0x6f9a48 : 0x8a7f72);
    else if (y < 380) c.setHex(n < 0.5 ? 0x8a7f72 : 0x9b9083); else c.setHex(0xf4f8fc);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); scene.add(m); return m;
})();
const water = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshLambertMaterial({ color: 0x3a8ec0 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.5; scene.add(water);
// 跑道
(() => { const r = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.len, 1, RUNWAY.w * 0.6), new THREE.MeshLambertMaterial({ color: 0x55555f })); r.position.set(RUNWAY.x, 18.6, RUNWAY.z); scene.add(r);
  for (let i = -5; i <= 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 3), new THREE.MeshLambertMaterial({ color: 0xffffff })); s.position.set(RUNWAY.x + i * 44, 18.8, RUNWAY.z); scene.add(s); } })();
// 樹（一次畫很多棵）
const trees = (() => {
  const cone = new THREE.ConeGeometry(9, 28, 5); cone.translate(0, 18, 0);
  const n = 650, mesh = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: 0x2f7d3a, flatShading: true }), n), m = new THREE.Matrix4();
  let k = 0, tries = 0;
  while (k < n && tries < 20000) { tries++; const x = rnd(-ISLAND, ISLAND), z = rnd(-ISLAND, ISLAND), h = height(x, z);
    if (h < 22 || h > 230 || Math.abs(z - RUNWAY.z) < 90 && Math.abs(x - RUNWAY.x) < 330) continue;
    const s = rnd(0.7, 1.4); m.compose(new THREE.Vector3(x, h - 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(0, 6), 0)), new THREE.Vector3(s, s * rnd(0.9, 1.3), s)); mesh.setMatrixAt(k++, m); }
  mesh.count = k; scene.add(mesh); return mesh;
})();
// 村莊、燈塔、山頂的酷丁狐雕像
const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: new THREE.Color(c).multiplyScalar(0.18) });
function house(x, z, c) { const h = height(x, z), g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(26, 18, 22), mat(c)); b.position.y = 9; g.add(b);
  const r = new THREE.Mesh(new THREE.ConeGeometry(22, 14, 4), mat(0xb4471a)); r.position.y = 25; r.rotation.y = Math.PI / 4; g.add(r); g.position.set(x, h, z); g.rotation.y = rnd(0, 3); scene.add(g); }
[[-300, 700], [-250, 780], [-380, 820], [-200, 660], [-420, 700], [-330, 900], [-150, 860], [200, 1100], [260, 1180], [120, 1220]].forEach(([x, z], i) => house(x, z, [0xf3eee1, 0xf5c547, 0xffe9c7, 0x9fd3e6][i % 4]));
(() => { const x = 1850, z = 1650, h = Math.max(0, height(x, z)), g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(8 - i * 0.8, 8.6 - i * 0.8, 14, 8), mat(i % 2 ? 0xffffff : 0xd8352a)); s.position.y = 7 + i * 14; g.add(s); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff3a0 })); top.position.y = 76; g.add(top); g.position.set(x, h, z); scene.add(g); })();
(() => { const x = 750, z = -650, h = height(x, z), g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(40, 0), mat(0xe8762c)); head.position.y = 40; g.add(head);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(16, 34, 5), mat(0xffffff)); snout.rotation.x = Math.PI / 2; snout.position.set(0, 32, 40); g.add(snout);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(14, 38, 4), mat(0xb4471a)); ear.position.set(sx * 22, 86, 0); g.add(ear); }
  const gog = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 10), mat(0x5a3d22)); gog.position.set(0, 52, 34); g.add(gog);
  g.position.set(x, h - 6, z); g.rotation.y = 0.6; scene.add(g); })();
// 雲
const clouds = [];
for (let i = 0; i < 46; i++) { const g = new THREE.Group(), n = 3 + Math.floor(rnd(0, 3));
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(26, 46), 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa4b4, flatShading: true, transparent: true, opacity: 0.9 })); m.position.set(k * 40 - n * 20, rnd(-8, 8), rnd(-14, 14)); g.add(m); }
  g.position.set(rnd(-3500, 3500), rnd(380, 640), rnd(-3500, 3500)); scene.add(g); clouds.push(g); }
// 夜晚的星空
const starField = (() => { const geo = new THREE.BufferGeometry(), arr = []; for (let i = 0; i < 600; i++) { const a = rnd(0, Math.PI * 2), e = rnd(0.08, 1.4), r = 7000; arr.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 14, fog: false })); p.visible = false; scene.add(p); return p; })();

/* ---------- 飛機（酷丁狐駕駛） ---------- */
const plane = (() => {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.4, 15, 6), mat(0xe8762c)); fus.rotation.x = Math.PI / 2; body.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 6), mat(0xf5c547)); nose.rotation.x = -Math.PI / 2; nose.position.z = -9; body.add(nose);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10, 0.4), mat(0x2b1d14)); prop.position.z = -10.6; body.add(prop);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 4), mat(0xd8352a)); wing.position.set(0, -0.6, -1.5); body.add(wing);
  for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 4.2), mat(0xffffff)); tip.position.set(sx * 10, -0.6, -1.5); body.add(tip); }
  const tailH = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 2.4), mat(0xd8352a)); tailH.position.set(0, 0.4, 6.6); body.add(tailH);
  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 2.6), mat(0xd8352a)); tailV.position.set(0, 2.4, 6.6); body.add(tailV);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 0), mat(0xe8762c)); head.position.set(0, 2.6, -1); body.add(head);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 4), mat(0xb4471a)); ear.position.set(sx * 1.1, 4.4, -0.8); body.add(ear); }
  const gog = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.7), mat(0x5a3d22)); gog.position.set(0, 3.1, -2.6); body.add(gog);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 5), mat(0xffffff)); tail.position.set(0, 1.8, 3.4); tail.rotation.x = Math.PI / 2.5; body.add(tail);
  scene.add(g); return { g, body, prop };
})();

/* ---------- 星星和圓環 ---------- */
const starGeo = new THREE.OctahedronGeometry(7, 0), starMat = new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0x6a5200, flatShading: true });
const ringGeo = new THREE.TorusGeometry(28, 3, 5, 16);
const ringMat = { next: new THREE.MeshLambertMaterial({ color: 0xff8a2c, emissive: 0x803000, flatShading: true }), idle: new THREE.MeshLambertMaterial({ color: 0x9aa4b0, flatShading: true, transparent: true, opacity: 0.7 }), done: new THREE.MeshLambertMaterial({ color: 0x3ee69a, flatShading: true, transparent: true, opacity: 0.35 }) };
const ITEMS = []; // {kind:'star'|'ring', mesh, x,y,z, dead}
function addStar(x, y, z) { const m = new THREE.Mesh(starGeo, starMat); m.position.set(x, y, z); scene.add(m); const it = { kind: "star", mesh: m, x, y, z, dead: false }; ITEMS.push(it); return it; }
function addRing(x, y, z, yaw) { const m = new THREE.Mesh(ringGeo, ringMat.idle); m.position.set(x, y, z); m.rotation.y = yaw; scene.add(m); const it = { kind: "ring", mesh: m, x, y, z, dead: false, yaw }; ITEMS.push(it); return it; }
function removeItem(it) { if (it.dead) return; it.dead = true; scene.remove(it.mesh); }
function clearItems() { for (const it of ITEMS) scene.remove(it.mesh); ITEMS.length = 0; }
function randomSpot(where) {
  for (let k = 0; k < 40; k++) {
    let x, z;
    if (where === "ahead") { const f = fwd(), d = rnd(250, 600); x = S.p.x + f.x * d + rnd(-120, 120); z = S.p.z + f.z * d + rnd(-120, 120); }
    else if (where === "sea") { const a = rnd(0, 6.28), r = rnd(ISLAND * 0.95, ISLAND * 1.15); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    else if (where === "mountain") { x = 750 + rnd(-260, 260); z = -650 + rnd(-260, 260); }
    else { x = rnd(-ISLAND * 0.9, ISLAND * 0.9); z = rnd(-ISLAND * 0.9, ISLAND * 0.9); }
    const g = ground(x, z), y = where === "high" ? g + rnd(260, 420) : g + rnd(30, 140);
    if (y < 900) return { x, y: Math.min(y, 880), z };
  }
  return { x: 0, y: 200, z: 0 };
}
function buildCourse() { // 繞小島一圈的 12 個圓環
  const pts = [];
  for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI * 2, r = 1500 + Math.sin(i * 1.7) * 450; const x = Math.cos(a) * r, z = Math.sin(a) * r + 300; pts.push([x, ground(x, z) + 70 + (i % 3) * 40, z]); }
  return pts.map((p, i) => { const q = pts[(i + 1) % pts.length], prev = pts[(i + pts.length - 1) % pts.length]; const yaw = Math.atan2(q[0] - prev[0], q[2] - prev[2]); return addRing(p[0], p[1], p[2], yaw); });
}

/* ---------- 狀態與輸入 ---------- */
const S = { mode: null, running: false, t: 0, p: new THREE.Vector3(0, 160, 1700), yaw: 0, pitch: 0, roll: 0, speed: 80, thr: 0.5, inv: 0,
  ix: 0, iy: 0, sx: 0, sy: 0, lastIn: 0, lastD: 0, d: null, score: 0, left: 0, rings: [], ringIdx: 0, ringT: 0, sky: "day", vmul: 1, boost: 0, outT: 0, crashes: 0 };
const keys = {};
addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
MB.on((ev) => {
  const now = performance.now();
  if (ev.key === "x") { S.ix = clamp(ev.value / 700, -1, 1); S.lastIn = now; }
  if (ev.key === "y") { S.iy = clamp(ev.value / 700, -1, 1); S.lastIn = now; }
  if (ev.key === "d" && ev.value > 0) { S.d = ev.value; S.lastD = now; }
});
function fwd() { const cp = Math.cos(S.pitch); return new THREE.Vector3(-Math.sin(S.yaw) * cp, Math.sin(S.pitch), -Math.cos(S.yaw) * cp); }

/* ---------- 音效 ---------- */
let engine = null;
function engineSound() {
  const a = SFX.audio(); if (!a) return;
  if (!engine) { const o = a.createOscillator(), gn = a.createGain(), f = a.createBiquadFilter(); o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 500; gn.gain.value = 0; o.connect(f).connect(gn).connect(a.destination); o.start(); engine = { o, gn }; }
  engine.o.frequency.value = 55 + S.speed * 0.9; engine.gn.gain.value = SFX.on && S.running ? 0.025 + S.thr * 0.03 : 0;
}
const sfx = {
  star() { SFX.tone(880, 1320, 0.15, "triangle", 0.15); SFX.tone(1320, 1760, 0.12, "triangle", 0.1, 0.07); },
  ring() { [660, 880, 1100].forEach((f, i) => SFX.tone(f, f, 0.12, "triangle", 0.13, i * 0.06)); },
  crash() { SFX.noise(0.7, 0.45, 500); SFX.tone(180, 40, 0.6, "sawtooth", 0.15); },
};

/* ---------- 流程 ---------- */
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1600); }
const send = (w) => { if (S.mode !== "lab") MB.send(w); };
function resetPlane() { S.p.set(RUNWAY.x + RUNWAY.len / 2 - 40, 110, RUNWAY.z); S.yaw = Math.PI / 2; S.pitch = 0.15; S.roll = 0; S.speed = 70; S.inv = 1.5; }
function start(mode) {
  clearItems(); Object.assign(S, { mode, running: true, t: 0, score: 0, left: 0, rings: [], ringIdx: 0, ringT: 0, vmul: 1, boost: 0, crashes: 0 });
  setSky("day"); resetPlane();
  if (mode === "free" || mode === "timed") for (let i = 0; i < 45; i++) { const p = randomSpot(i % 6 ? "land" : "high"); addStar(p.x, p.y, p.z); }
  if (mode === "timed") S.left = 60;
  if (mode === "rings") { S.rings = buildCourse(); S.rings[0].mesh.material = ringMat.next;
    const r0 = S.rings[0], r1 = S.rings[1], dx = r1.x - r0.x, dz = r1.z - r0.z, L = Math.hypot(dx, dz);   // 從第一個圓環前面出發
    S.p.set(r0.x - dx / L * 320, r0.y + 10, r0.z - dz / L * 320); S.yaw = Math.atan2(-(r0.x - S.p.x), -(r0.z - S.p.z)); S.pitch = 0; }
  $("menu").hidden = true; $("endOv").hidden = true; hud(); SFX.audio();
  toast(mode === "rings" ? "跟著箭頭穿過圓環！" : "起飛！收集星星");
}
function finish(title, text, score) {
  S.running = false; send("end");
  $("endTitle").textContent = title; $("endText").textContent = text; $("endScore").textContent = score;
  setTimeout(() => { $("endOv").hidden = false; }, 700);
}
function hud() {
  if (S.mode === "rings") { $("l1").textContent = "圓環"; $("v1").textContent = `${S.ringIdx}/${S.rings.length}`; $("l2").textContent = "時間"; $("v2").textContent = S.ringT.toFixed(1); }
  else { $("l1").textContent = "星星"; $("v1").textContent = S.score; $("l2").textContent = "時間"; $("v2").textContent = S.mode === "timed" ? Math.ceil(S.left) : "--"; }
}
function collect(it) {
  if (S.mode === "lab") { if (typeof LAB !== "undefined") LAB.fire(it.kind === "star" ? "star" : "ring", undefined, it); return; }
  if (it.kind === "star") { removeItem(it); S.score++; sfx.star(); send("star"); burst(it.x, it.y, it.z, 0xffd84a);
    if (S.mode === "timed") { const p = randomSpot("land"); addStar(p.x, p.y, p.z); } hud(); }
}
function crash(what) {
  sfx.crash(); burst(S.p.x, Math.max(S.p.y, 2), S.p.z, what === "water" ? 0xbfe8ff : 0x8a6a4a); S.crashes++;
  if (S.mode === "lab") { if (typeof LAB !== "undefined" && LAB.fire("crash", what)) { S.inv = 1.5; S.p.y = ground(S.p.x, S.p.z) + 120; S.pitch = 0.1; return; } }
  else send("crash");
  toast(what === "water" ? "掉進海裡了！重新起飛" : "撞到地面了！重新起飛");
  S.p.y = ground(S.p.x, S.p.z) + 140; S.pitch = 0.15; S.roll = 0; S.speed = Math.max(S.speed, 70); S.inv = 2;
}
// 碎片
const bits = [];
function burst(x, y, z, color) {
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.TetrahedronGeometry(rnd(2, 4), 0), new THREE.MeshLambertMaterial({ color, flatShading: true })); m.position.set(x, y, z); scene.add(m);
    bits.push({ m, v: new THREE.Vector3(rnd(-60, 60), rnd(10, 80), rnd(-60, 60)), life: rnd(0.6, 1.2) }); }
}

/* ---------- 每一格 ---------- */
function update(dt) {
  S.t += dt; const now = performance.now();
  // 輸入（micro:bit 傾斜，或鍵盤）
  let ix = S.ix, iy = S.iy;
  if (now - S.lastIn > 1500) { ix = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0); iy = (keys.arrowup ? -1 : 0) + (keys.arrowdown ? 1 : 0); }
  const dz = (v) => (Math.abs(v) < 0.1 ? 0 : (v - Math.sign(v) * 0.1) / 0.9);
  S.sx += (dz(ix) - S.sx) * Math.min(1, dt * 6); S.sy += (dz(iy) - S.sy) * Math.min(1, dt * 6);
  if (now - S.lastD < 1500 && S.d != null) S.thr = clamp((S.d - 5) / 35, 0, 1);
  else { if (keys.w) S.thr = Math.min(1, S.thr + dt * 0.6); if (keys.s) S.thr = Math.max(0, S.thr - dt * 0.6); }
  // 飛行（街機式）
  const inv = $("invert").checked ? -1 : 1;
  S.roll += (S.sx * 0.95 - S.roll) * Math.min(1, dt * 3);
  const pitchTarget = clamp(-S.sy * inv * 0.7, -0.75, 0.75);
  S.pitch += (pitchTarget - S.pitch) * Math.min(1, dt * 2);
  S.boost = Math.max(0, S.boost - dt);
  const target = (55 + S.thr * 110) * S.vmul * (S.boost > 0 ? 1.6 : 1) - S.pitch * 30;
  S.speed += (target - S.speed) * Math.min(1, dt * 0.9);
  if (S.running) {
    S.yaw -= S.roll * 1.05 * dt;
    // 飛太遠會自動轉回小島
    const r = Math.hypot(S.p.x, S.p.z);
    if (r > ISLAND * 1.3) { const want = Math.atan2(S.p.x, S.p.z); let da = want - S.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; S.yaw += clamp(da, -1, 1) * dt * 0.9; if (S.t - S.outT > 3) { S.outT = S.t; toast("太遠了，飛回小島！"); } }
    S.p.addScaledVector(fwd(), S.speed * dt);
    if (S.p.y > 900) { S.p.y = 900; S.pitch = Math.min(S.pitch, 0); }
    S.inv = Math.max(0, S.inv - dt);
    const g = ground(S.p.x, S.p.z);
    if (S.p.y < g + 3) { if (S.inv > 0) S.p.y = g + 3; else crash(height(S.p.x, S.p.z) <= 0 ? "water" : "ground"); }
    // 碰到星星、穿過圓環
    for (const it of ITEMS) {
      if (it.dead) continue;
      const d = Math.hypot(it.x - S.p.x, it.y - S.p.y, it.z - S.p.z);
      if (it.kind === "star" && d < 18) collect(it);
      if (it.kind === "ring" && d < 26) {
        if (S.mode === "rings") { if (it === S.rings[S.ringIdx]) passRing(it); }
        else if (!it.passT || S.t - it.passT > 2) { it.passT = S.t; collect(it); }
      }
    }
    if (S.mode === "timed") { S.left -= dt; if (S.left <= 0) { S.left = 0; hud(); finish("時間到！", "60 秒內收集到的星星：", `${S.score} 顆`); } else if (Math.ceil(S.left) !== Math.ceil(S.left + dt)) hud(); }
    if (S.mode === "rings") { S.ringT += dt; $("v2").textContent = S.ringT.toFixed(1); }
  }
  // 動畫
  for (const it of ITEMS) if (!it.dead) { if (it.kind === "star") { it.mesh.rotation.y += dt * 2; it.mesh.position.y = it.y + Math.sin(S.t * 2 + it.x) * 3; } else if (it.mesh.material === ringMat.next) it.mesh.scale.setScalar(1 + Math.sin(S.t * 5) * 0.06); }
  for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.life -= dt; b.v.y -= 120 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 5; if (b.life <= 0) { scene.remove(b.m); bits.splice(i, 1); } }
  for (const c of clouds) { c.position.x += dt * 6; if (c.position.x > 3600) c.position.x = -3600; }
  plane.prop.rotation.z += dt * (20 + S.speed * 0.4);
  plane.g.position.copy(S.p); plane.g.rotation.set(S.pitch, S.yaw, 0, "YXZ"); plane.body.rotation.z = -S.roll;
  plane.g.visible = !(S.inv > 0 && Math.floor(S.t * 10) % 2 && S.running);
  // 追蹤鏡頭
  const f = fwd(), flat = new THREE.Vector3(f.x, 0, f.z).normalize();
  const want = S.p.clone().addScaledVector(flat, -42).add(new THREE.Vector3(0, 13 - S.pitch * 10, 0));
  const gmin = ground(want.x, want.z) + 4; if (want.y < gmin) want.y = gmin;
  camera.position.lerp(want, Math.min(1, dt * 4)); camera.lookAt(S.p.clone().addScaledVector(f, 30));
  starField.position.copy(camera.position);
  engineSound(); instruments();
}
function passRing(it) {
  it.mesh.material = ringMat.done; S.ringIdx++; sfx.ring(); send("ring"); hud();
  if (S.ringIdx >= S.rings.length) { finish("飛完一圈！", "穿過 12 個圓環，用了：", `${S.ringT.toFixed(1)} 秒`); return; }
  S.rings[S.ringIdx].mesh.material = ringMat.next;
}
function instruments() {
  $("spd").textContent = Math.round(S.speed); $("alt").textContent = Math.round(S.p.y - 0); $("thr").style.width = `${Math.round(S.thr * 100)}%`;
  $("horizon").style.transform = `translateY(${clamp(S.pitch * 40, -26, 26)}px) rotate(${S.roll * 57}deg)`;
  // 箭頭指向下一個目標
  let tgt = null;
  if (S.mode === "rings" && S.running) tgt = S.rings[S.ringIdx];
  else { let bd = 1e9; for (const it of ITEMS) if (!it.dead) { const d = Math.hypot(it.x - S.p.x, it.z - S.p.z); if (d < bd) { bd = d; tgt = it; } } }
  const ar = $("arrow");
  if (tgt && S.running) { const a = Math.atan2(-(tgt.x - S.p.x), -(tgt.z - S.p.z)); let da = a - S.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    ar.hidden = false; $("arrowIco").style.transform = `rotate(${-da * 57.3}deg)`; const dy = tgt.y - S.p.y;
    $("arrowTxt").textContent = `${Math.round(Math.hypot(tgt.x - S.p.x, tgt.z - S.p.z))} 公尺 ${dy > 40 ? "↑ 往上" : dy < -40 ? "↓ 往下" : ""}`; }
  else ar.hidden = true;
  drawMini();
}
// 小地圖
const mini = $("mini"), mg = mini.getContext("2d"), MAPR = ISLAND * 1.35, mapImg = document.createElement("canvas");
(() => { mapImg.width = mapImg.height = 85; const c = mapImg.getContext("2d"), d = c.createImageData(85, 85);
  for (let j = 0; j < 85; j++) for (let i = 0; i < 85; i++) { const x = (i / 84 * 2 - 1) * MAPR, z = (j / 84 * 2 - 1) * MAPR, h = height(x, z), o = (j * 85 + i) * 4;
    const col = h <= 0 ? [58, 142, 192] : h < 16 ? [232, 212, 154] : h < 150 ? [88, 181, 70] : h < 380 ? [138, 127, 114] : [244, 248, 252]; d.data.set([...col, 255], o); }
  c.putImageData(d, 0, 0); })();
function drawMini() {
  const W = mini.width, k = W / (MAPR * 2), mx = (x) => (x + MAPR) * k;
  mg.imageSmoothingEnabled = false; mg.drawImage(mapImg, 0, 0, W, W);
  for (const it of ITEMS) if (!it.dead) { mg.fillStyle = it.kind === "star" ? "#ffd84a" : (S.mode === "rings" && it === S.rings[S.ringIdx] ? "#ff4a2c" : it.mesh.material === ringMat.done ? "#3ee69a88" : "#ffffffaa"); mg.fillRect(mx(it.x) - 2, mx(it.z) - 2, 4, 4); }
  mg.save(); mg.translate(mx(S.p.x), mx(S.p.z)); mg.rotate(-S.yaw); mg.fillStyle = "#d8352a"; mg.strokeStyle = "#fff"; mg.lineWidth = 1.5; mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(5, 5); mg.lineTo(-5, 5); mg.closePath(); mg.fill(); mg.stroke(); mg.restore();
}

let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
resetPlane(); S.running = false; requestAnimationFrame(loop);

document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", () => start(b.dataset.mode)));
$("againBtn").onclick = () => start(S.mode);
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.mode === "lab" && typeof LAB !== "undefined") LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
