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

/* ---------- 地形：一座主島＋四座風格小島（雪山、火山、椰子島、城市） ---------- */
const ISLAND = 2700, WORLD_R = 9200, SIZE = 19600, SEG = 230;
function hash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
let seedR = 20261029; const srnd = (a, b) => { seedR = (seedR * 1664525 + 1013904223) >>> 0; return a + (seedR / 4294967296) * (b - a); };
const RUNWAY = { x: -700, z: 1250, len: 520, w: 70 };
const ISLES = [
  { id: "snow", name: "雪山島", x: 300, z: -6500, r: 2000 },
  { id: "volc", name: "火山島", x: 6400, z: -1700, r: 1600 },
  { id: "trop", name: "椰子島", x: 4300, z: 4900, r: 1300 },
  { id: "city", name: "城市島", x: -6300, z: 700, r: 1900 },
];
function mainHeight(x, z) {
  const r = Math.hypot(x, z) / ISLAND, isl = 1 - r * r;
  const n = vnoise(x / 900 + 3, z / 900) + vnoise(x / 380, z / 380 + 7) * 0.5 + vnoise(x / 160, z / 160) * 0.2;
  let h = (isl * 1.15 - 0.2 + (n - 0.85) * 0.8) * 200;
  h += Math.pow(Math.max(0, 1 - Math.hypot(x - 750, z + 650) / 750), 2) * 560;
  h += Math.pow(Math.max(0, 1 - Math.hypot(x + 950, z + 350) / 520), 2) * 320;
  h += Math.pow(Math.max(0, 1 - Math.hypot(x - 1300, z - 700) / 380), 2) * 180;
  const dx = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.len / 2), dz = Math.max(0, Math.abs(z - RUNWAY.z) - RUNWAY.w / 2), dd = Math.hypot(dx, dz);
  if (dd < 160) h = lerp(18, h, clamp(dd / 160, 0, 1) ** 2);
  return h;
}
function isleHeight(I, x, z) {
  const d = Math.hypot(x - I.x, z - I.z) / I.r; if (d > 1.6) return -999;
  const isl = 1 - d * d, n = vnoise(x / 600 + 11, z / 600) + vnoise(x / 220, z / 220 + 5) * 0.4;
  if (I.id === "snow") { let h = (isl * 1.1 - 0.15 + (n - 0.7) * 0.9) * 230;
    h += Math.pow(Math.max(0, 1 - Math.hypot(x - I.x + 300, z - I.z) / 900), 2) * 820 + Math.pow(Math.max(0, 1 - Math.hypot(x - I.x - 600, z - I.z + 400) / 600), 2) * 520; return h; }
  if (I.id === "volc") { let h = (isl * 1.1 - 0.15 + (n - 0.7) * 0.3) * 180 + Math.pow(Math.max(0, 1 - d / 0.8), 1.4) * 760;
    if (d < 0.13) h -= (0.13 - d) / 0.13 * 260; return h; }
  if (I.id === "trop") return (isl * 1.0 - 0.25 + (n - 0.7) * 0.35) * 90;
  if (I.id === "city") { const h = (isl * 1.05 - 0.2) * 120; return h > 30 ? 30 + (h - 30) * 0.05 : h; }
  return -999;
}
function height(x, z) { let h = Math.hypot(x, z) < ISLAND * 1.6 ? mainHeight(x, z) : -80; for (const I of ISLES) h = Math.max(h, isleHeight(I, x, z)); return Math.max(h, -80); }
function ground(x, z) { return Math.max(0, height(x, z)); }
function isleAt(x, z) { let best = "main", bd = Math.hypot(x, z) / ISLAND; for (const I of ISLES) { const d = Math.hypot(x - I.x, z - I.z) / I.r; if (d < bd) { bd = d; best = I.id; } } return best; }

/* ---------- Three.js 場景 ---------- */
const cv = $("view");
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
renderer.setPixelRatio(Math.min(1, window.devicePixelRatio || 1) * 0.75);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 1, 14000);
function resize() { renderer.setSize(innerWidth, innerHeight, false); cv.style.width = "100vw"; cv.style.height = "100vh"; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x557744, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-1, 1.6, 0.8); scene.add(sun);
const SKY = {
  day: { bg: 0x7cc4f0, fog: [1400, 6500], hemi: 0.9, sun: 1.1 },
  sunset: { bg: 0xf2a066, fog: [1200, 5500], hemi: 0.75, sun: 0.9 },
  night: { bg: 0x0b1030, fog: [900, 4500], hemi: 0.35, sun: 0.25 },
  fog: { bg: 0xc8d2dc, fog: [120, 900], hemi: 0.85, sun: 0.6 },
};
scene.fog = new THREE.Fog(0x7cc4f0, 1400, 6500);
function setSky(k) {
  const s = SKY[k] || SKY.day; scene.background = new THREE.Color(s.bg); scene.fog.color.setHex(s.bg); scene.fog.near = s.fog[0]; scene.fog.far = s.fog[1];
  hemi.intensity = s.hemi; sun.intensity = s.sun; starField.visible = k === "night"; S.sky = k;
  for (const w of WINDOWS) w.material.color.setHex(k === "night" || k === "sunset" ? 0xffe27a : 0x9fd3e6);
}
// 地面（平面著色的低多邊形，依島嶼換顏色）
const terrain = (() => {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  const g = geo.toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, n = hash(Math.floor(x / 60), Math.floor(z / 60)), t = isleAt(x, z);
    if (y < 0) c.setHex(0x2f7fae);
    else if (t === "snow") c.setHex(y < 10 ? 0xcfd6dd : y < 140 ? (n < 0.25 ? 0x7f9a8a : n < 0.6 ? 0xe8eef4 : 0xd4dde6) : y < 300 ? (n < 0.5 ? 0x8a8f99 : 0xc8d0da) : 0xf8fbff);
    else if (t === "volc") c.setHex(y < 10 ? 0x5a5050 : y < 220 ? (n < 0.5 ? 0x4a4048 : 0x55494f) : y < 560 ? 0x6a5a55 : 0x8a3a2a);
    else if (t === "trop") c.setHex(y < 14 ? 0xf2e2a8 : n < 0.5 ? 0x8fd14f : 0x7cc443);
    else if (t === "city") c.setHex(y < 8 ? 0xd9d0bc : n < 0.18 ? 0x58b546 : n < 0.6 ? 0x9aa0aa : 0x8a909a);
    else if (y < 4) c.setHex(0xd9c48a); else if (y < 16) c.setHex(0xe8d49a);
    else if (y < 150) c.setHex(n < 0.5 ? 0x58b546 : 0x4fa83e); else if (y < 250) c.setHex(n < 0.5 ? 0x6f9a48 : 0x8a7f72);
    else if (y < 380) c.setHex(n < 0.5 ? 0x8a7f72 : 0x9b9083); else c.setHex(0xf4f8fc);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); scene.add(m); return m;
})();
const water = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: 0x3a8ec0 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.5; scene.add(water);

/* ---------- 世界裡的東西 ---------- */
const matCache = {};
const mat = (c) => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: new THREE.Color(c).multiplyScalar(0.18) }));
const WINDOWS = [];
const COLLIDE = [];   // 會撞到的大型建築 {x, z, r, h}
const ANIM = [];      // 每一格要動的東西
function box(w, h, d, c, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); (parent || scene).add(m); return m; }
function at(x, z) { return ground(x, z); }
function group(x, z, rot, y) { const g = new THREE.Group(); g.position.set(x, y === undefined ? at(x, z) : y, z); g.rotation.y = rot || 0; scene.add(g); return g; }
function house(x, z, c, rot, roof) { const g = group(x, z, rot); box(26, 18, 22, c, 0, 9, 0, g);
  const r = new THREE.Mesh(new THREE.ConeGeometry(22, 14, 4), mat(roof || 0xb4471a)); r.position.y = 25; r.rotation.y = Math.PI / 4; g.add(r);
  box(5, 9, 1, 0x6b4426, 0, 4.5, 11.2, g); return g; }
function scatter(n, geo, material, pick) {
  const mesh = new THREE.InstancedMesh(geo, material, n), m = new THREE.Matrix4(); let k = 0, tries = 0;
  while (k < n && tries < n * 40) { tries++; const p = pick(); if (!p) continue; const s = srnd(0.7, 1.4);
    m.compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, srnd(0, 6), 0)), new THREE.Vector3(s, s * srnd(0.9, 1.3), s)); mesh.setMatrixAt(k++, m); }
  mesh.count = k; scene.add(mesh); return mesh;
}
function inIsle(I, f) { const a = srnd(0, 6.283), r = Math.sqrt(srnd(0, 1)) * I.r * (f || 0.8); return [I.x + Math.cos(a) * r, I.z + Math.sin(a) * r]; }
const IS = Object.fromEntries(ISLES.map((I) => [I.id, I]));
// 主島的樹
const coneGeo = new THREE.ConeGeometry(9, 28, 5); coneGeo.translate(0, 18, 0);
scatter(650, coneGeo, mat(0x2f7d3a), () => { const x = srnd(-ISLAND, ISLAND), z = srnd(-ISLAND, ISLAND), h = height(x, z);
  if (isleAt(x, z) !== "main" || h < 22 || h > 230 || (Math.abs(z - RUNWAY.z) < 140 && Math.abs(x - RUNWAY.x) < 420) || Math.hypot(x + 300, z - 800) < 330) return null; return [x, h - 2, z]; });
// 雪山島的松樹
scatter(420, coneGeo, mat(0x2d5a46), () => { const [x, z] = inIsle(IS.snow, 0.95), h = height(x, z); if (h < 14 || h > 300) return null; return [x, h - 2, z]; });
// 椰子樹
const palmGeo = (() => { const trunk = new THREE.CylinderGeometry(1.4, 2, 30, 5); trunk.translate(0, 15, 0); return trunk; })();
const palmLeaf = (() => { const l = new THREE.ConeGeometry(16, 8, 6); l.translate(0, 32, 0); return l; })();
const palmPick = () => { const [x, z] = inIsle(IS.trop, 0.95), h = height(x, z); if (h < 4 || h > 80) return null; return [x, h - 1, z]; };
seedR = 777; scatter(140, palmGeo, mat(0x8a5a2b), palmPick); seedR = 777; scatter(140, palmLeaf, mat(0x2f9a3a), palmPick);

// ===== 主島：機場 =====
(() => { const r = box(RUNWAY.len, 1, RUNWAY.w * 0.6, 0x55555f, RUNWAY.x, 18.6, RUNWAY.z);
  for (let i = -5; i <= 5; i++) box(22, 1.2, 3, 0xffffff, RUNWAY.x + i * 44, 18.8, RUNWAY.z);
  box(26, 1, 120, 0x5a5a64, RUNWAY.x - 60, 18.6, RUNWAY.z - 80); box(220, 1, 26, 0x5a5a64, RUNWAY.x - 140, 18.6, RUNWAY.z - 140);
  const tw = group(RUNWAY.x - 140, RUNWAY.z - 190, 0, 18); box(14, 60, 14, 0xf3eee1, 0, 30, 0, tw); const glass = box(22, 10, 22, 0x9fd3e6, 0, 65, 0, tw); WINDOWS.push(glass); box(24, 2, 24, 0xd8352a, 0, 71, 0, tw);
  COLLIDE.push({ x: RUNWAY.x - 140, z: RUNWAY.z - 190, r: 14, h: 18 + 72 });
  for (const dx of [-240, -310]) { const hg = group(RUNWAY.x + dx, RUNWAY.z - 160, 0, 18); const roof = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 50, 8, 1, false, 0, Math.PI), mat(0xb8c0c8)); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; hg.add(roof); box(52, 2, 50, 0x8a909a, 0, 1, 0, hg); }
  const ws = group(RUNWAY.x + 200, RUNWAY.z - 60, 0, 18); box(1.5, 22, 1.5, 0xdddddd, 0, 11, 0, ws); const sock = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 6), mat(0xff8a2c)); sock.rotation.z = Math.PI / 2; sock.position.set(6, 21, 0); ws.add(sock);
  ANIM.push((t) => { sock.rotation.x = Math.sin(t * 3) * 0.3; });
})();
// ===== 主島：小鎮（房子、教堂、道路） =====
(() => { const cx = -300, cz = 800, cols = [0xf3eee1, 0xf5c547, 0xffe9c7, 0x9fd3e6, 0xf2b8a0], roofs = [0xb4471a, 0x7a4a2a, 0x3b6d8f, 0xd8352a];
  box(560, 1, 18, 0x5d5d66, cx, at(cx, cz) + 1, cz); box(18, 1, 520, 0x5d5d66, cx, at(cx, cz) + 1, cz);
  let k = 0; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { if (i === 0 || j === 0 || srnd(0, 1) < 0.25) continue; const x = cx + i * 70 + srnd(-10, 10), z = cz + j * 66 + srnd(-10, 10); house(x, z, cols[k % 5], (k % 4) * Math.PI / 2, roofs[k % 4]); k++; }
  const ch = group(cx + 40, cz - 40, 0); box(34, 26, 50, 0xf3eee1, 0, 13, 0, ch); const r = new THREE.Mesh(new THREE.ConeGeometry(30, 16, 4), mat(0x7a4a2a)); r.position.y = 34; r.rotation.y = Math.PI / 4; r.scale.z = 1.4; ch.add(r);
  box(14, 50, 14, 0xf3eee1, 0, 25, -30, ch); const sp = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 4), mat(0x3b6d8f)); sp.position.set(0, 63, -30); sp.rotation.y = Math.PI / 4; ch.add(sp);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(4, 8), mat(0xffffff)); clock.position.set(0, 42, -22.9); ch.add(clock);
  // 公園噴水池
  const fp = group(cx, cz, 0); const pool = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 3, 10), mat(0x9fd3e6)); pool.position.y = 1.5; fp.add(pool); box(4, 12, 4, 0xf3eee1, 0, 6, 0, fp);
})();
// ===== 主島：摩天輪 =====
(() => { const x = 260, z = 1150, g = group(x, z, 0.4); box(4, 70, 4, 0x9aa0aa, -14, 35, 0, g); box(4, 70, 4, 0x9aa0aa, 14, 35, 0, g);
  const wheel = new THREE.Group(); wheel.position.y = 72; g.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(44, 1.6, 4, 16), mat(0xd8352a)); wheel.add(rim);
  const cabs = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const sp = box(1, 44, 1, 0xdddddd, Math.cos(a) * 22, Math.sin(a) * 22, 0, wheel); sp.rotation.z = a - Math.PI / 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), mat([0xf5c547, 0x5fe1ff, 0x3ee69a, 0xff8ad8][i % 4])); cab.userData.a = a; g.add(cab); cabs.push(cab); }
  ANIM.push((t, dt) => { wheel.rotation.z = t * 0.2; for (const c of cabs) { const a = c.userData.a + t * 0.2; c.position.set(Math.cos(a) * 44, 72 + Math.sin(a) * 44 - 6, 0); } });
  COLLIDE.push({ x, z, r: 46, h: at(x, z) + 120 });
})();
// ===== 主島：風車農場 =====
(() => { const fields = [0xf5c547, 0x8fd14f, 0xc89a5a, 0x6fbf4a]; for (let i = 0; i < 8; i++) { const x = 1250 + (i % 4) * 90, z = 250 + Math.floor(i / 4) * 90; box(84, 1, 84, fields[i % 4], x, at(x, z) + 0.8, z); }
  for (let i = 0; i < 3; i++) { const x = 1200 + i * 160, z = 120, g = group(x, z, 0.3); const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 50, 6), mat(0xf3eee1)); tower.position.y = 25; g.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 10, 6), mat(0xd8352a)); cap.position.y = 55; g.add(cap);
    const blades = new THREE.Group(); blades.position.set(0, 48, 9); g.add(blades); for (let k = 0; k < 4; k++) { const b = box(3, 34, 0.8, 0xffffff, 0, 17, 0, blades); const p = new THREE.Group(); p.rotation.z = k * Math.PI / 2; p.add(b); blades.add(p); }
    ANIM.push((t) => { blades.rotation.z = t * (1.2 + i * 0.2); }); }
})();
// ===== 主島：燈塔、山頂的酷丁狐雕像 =====
(() => { const x = 1850, z = 1650, h = Math.max(0, height(x, z)), g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(8 - i * 0.8, 8.6 - i * 0.8, 14, 8), mat(i % 2 ? 0xffffff : 0xd8352a)); s.position.y = 7 + i * 14; g.add(s); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff3a0 })); top.position.y = 76; g.add(top);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(14, 160, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, fog: false }));
  beam.rotation.z = Math.PI / 2; beam.position.set(80, 0, 0); const bg = new THREE.Group(); bg.position.y = 76; bg.add(beam); g.add(bg);
  g.position.set(x, h, z); scene.add(g); ANIM.push((t) => { bg.rotation.y = t * 0.8; beam.visible = S.sky === "night" || S.sky === "fog" || S.sky === "sunset"; });
  COLLIDE.push({ x, z, r: 10, h: h + 82 }); })();
(() => { const x = 750, z = -650, h = height(x, z), g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(40, 0), mat(0xe8762c)); head.position.y = 40; g.add(head);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(16, 34, 5), mat(0xffffff)); snout.rotation.x = Math.PI / 2; snout.position.set(0, 32, 40); g.add(snout);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(14, 38, 4), mat(0xb4471a)); ear.position.set(sx * 22, 86, 0); g.add(ear); }
  box(70, 10, 10, 0x5a3d22, 0, 52, 34, g); g.position.set(x, h - 6, z); g.rotation.y = 0.6; scene.add(g); COLLIDE.push({ x, z, r: 40, h: h + 100 }); })();
// ===== 跨海大橋（主島 ↔ 城市島） =====
(() => { const ax = -2650, az = 500, bx = -4500, bz = 650, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), g = group((ax + bx) / 2, (az + bz) / 2, -Math.atan2(dz, dx), 0);
  box(L, 3, 26, 0x9aa0aa, 0, 40, 0, g); box(L, 4, 1.5, 0xd8352a, 0, 44, 12, g); box(L, 4, 1.5, 0xd8352a, 0, 44, -12, g);
  for (let i = -3; i <= 3; i++) { box(6, 40, 6, 0x8a909a, i * L / 7, 20, 10, g); box(6, 40, 6, 0x8a909a, i * L / 7, 20, -10, g); }
  for (const s of [-1, 1]) { box(8, 110, 8, 0xd8352a, s * L / 4, 95, 12, g); box(8, 110, 8, 0xd8352a, s * L / 4, 95, -12, g); box(8, 8, 32, 0xd8352a, s * L / 4, 148, 0, g); }
})();
// ===== 雪山島：小木屋、天文台、結冰的湖 =====
(() => { const I = IS.snow; for (let i = 0; i < 7; i++) { const [x, z] = [I.x - 900 + i * 60, I.z + 700 + (i % 2) * 50]; const g = group(x, z, srnd(0, 3)); box(24, 16, 20, 0x8a5a2b, 0, 8, 0, g);
    const r = new THREE.Mesh(new THREE.ConeGeometry(21, 13, 4), mat(0xf8fbff)); r.position.y = 22; r.rotation.y = Math.PI / 4; g.add(r); box(3, 10, 3, 0x5a3d22, 7, 26, 0, g); }
  const ox = I.x - 300, oz = I.z, oh = height(ox, oz), ob = group(ox, oz, 0, oh); box(30, 20, 30, 0xf3eee1, 0, 10, 0, ob);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdfe6ee)); dome.position.y = 20; ob.add(dome);
  const tele = box(4, 4, 26, 0x5a3d22, 0, 30, 6, ob); tele.rotation.x = -0.6; COLLIDE.push({ x: ox, z: oz, r: 22, h: oh + 42 });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(160, 9), mat(0xbfe3f2)); lake.rotation.x = -Math.PI / 2; lake.position.set(I.x + 500, at(I.x + 500, I.z + 700) + 1, I.z + 700); scene.add(lake);
})();
// ===== 火山島：熔岩、冒煙、觀測站 =====
(() => { const I = IS.volc, top = height(I.x + I.r * 0.16, I.z);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(I.r * 0.15, 9), new THREE.MeshBasicMaterial({ color: 0xff5a1a })); lava.rotation.x = -Math.PI / 2; lava.position.set(I.x, height(I.x, I.z) + 6, I.z); scene.add(lava);
  const puffs = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(30, 0), new THREE.MeshLambertMaterial({ color: 0x6a6a72, transparent: true, opacity: 0.7, flatShading: true })); m.userData.k = i / 14; scene.add(m); puffs.push(m); }
  ANIM.push((t) => { for (const m of puffs) { const k = (m.userData.k + t * 0.05) % 1; m.position.set(I.x + Math.sin(k * 9) * 40 + k * 160, top + 40 + k * 700, I.z + Math.cos(k * 7) * 40); m.scale.setScalar(0.6 + k * 2.2); m.material.opacity = 0.75 * (1 - k); }
    lava.material.color.setHSL(0.04 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 3) * 0.05); });
  const hx = I.x - I.r * 0.85, hz = I.z + 200, hg = group(hx, hz, 0.5); box(30, 14, 22, 0xf5c547, 0, 7, 0, hg); box(2, 30, 2, 0xdddddd, 10, 22, 0, hg); const dish = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 8), mat(0xffffff)); dish.position.set(10, 38, 0); hg.add(dish);
})();
// ===== 椰子島：海灘小屋、碼頭、小船 =====
(() => { const I = IS.trop; for (let i = 0; i < 6; i++) { const a = 2.6 + i * 0.28, x = I.x + Math.cos(a) * I.r * 0.62, z = I.z + Math.sin(a) * I.r * 0.62, g = group(x, z, a); box(18, 12, 16, 0xe2b878, 0, 6, 0, g);
    const r = new THREE.Mesh(new THREE.ConeGeometry(17, 12, 6), mat(0xc9a050)); r.position.y = 18; g.add(r); }
  const a = 3.1, px = I.x + Math.cos(a) * I.r * 0.75, pz = I.z + Math.sin(a) * I.r * 0.75, pier = group(px, pz, -a, 0); box(260, 3, 14, 0x8a5a2b, -130, 6, 0, pier);
  for (let i = 0; i < 6; i++) box(3, 10, 3, 0x5a3d22, -i * 50, 2, 8, pier);
  for (let i = 0; i < 3; i++) boat(px + Math.cos(a) * (60 + i * 70) + 20, pz + Math.sin(a) * (60 + i * 70) + 30, [0xd8352a, 0x3b6d8f, 0xf5c547][i]);
})();
function boat(x, z, c, sail) { const g = group(x, z, srnd(0, 6), 0); const hull = new THREE.Mesh(new THREE.CylinderGeometry(6, 3, 26, 6, 1), mat(c)); hull.rotation.x = Math.PI / 2; hull.scale.y = 1; hull.position.y = 2; g.add(hull);
  if (sail) { box(1.2, 30, 1.2, 0x8a5a2b, 0, 18, 0, g); const s = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 3), mat(0xffffff)); s.position.set(0, 18, 3); s.scale.z = 0.15; g.add(s); } return g; }
// ===== 城市島：摩天大樓、大樓之塔 =====
(() => { const I = IS.city, cols = [0x9aa0aa, 0x7a8ca8, 0xd9d0bc, 0xb8c0c8, 0x6a7a90];
  for (let i = -4; i <= 4; i++) { box(I.r * 1.2, 1, 16, 0x4a4a52, I.x, 31, I.z + i * 120); box(16, 1, I.r * 1.2, 0x4a4a52, I.x + i * 120, 31, I.z); }
  for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) { const x = I.x + i * 120 + 60, z = I.z + j * 120 + 60; if (Math.hypot(x - I.x, z - I.z) > I.r * 0.62 || (i === -1 && j === -1) || srnd(0, 1) < 0.15) continue;
    const h = srnd(50, 230) * (1.2 - Math.hypot(x - I.x, z - I.z) / I.r), w = srnd(46, 70), d = srnd(46, 70), b = box(w, h, d, cols[(i + j + 8) % 5], x, 30 + h / 2, z);
    const win = box(w + 1, h * 0.85, d * 0.6, 0x9fd3e6, x, 30 + h / 2, z); win.material = new THREE.MeshLambertMaterial({ color: 0x9fd3e6, flatShading: true, emissive: 0x334455 }); WINDOWS.push(win);
    COLLIDE.push({ x, z, r: Math.max(w, d) / 2 + 4, h: 30 + h }); }
  const tg = group(I.x - 60, I.z - 60, 0, 30); let y = 0; for (let k = 0; k < 8; k++) { const w = 46 - k * 3; box(w, 48, w, k % 2 ? 0x5fa08a : 0x7ab8a0, 0, y + 24, 0, tg); y += 48; }
  box(4, 80, 4, 0xdddddd, 0, y + 40, 0, tg); COLLIDE.push({ x: I.x - 60, z: I.z - 60, r: 26, h: 30 + y + 80 });
})();
// ===== 海上：帆船、貨輪、熱氣球 =====
const SHIPS = [];
for (let i = 0; i < 10; i++) { const a = srnd(0, 6.28), r = srnd(3000, 5500), g = boat(Math.cos(a) * r, Math.sin(a) * r, [0xffffff, 0xd8352a, 0x3b6d8f][i % 3], true); SHIPS.push({ g, a, r, w: srnd(0.008, 0.02) * (i % 2 ? 1 : -1) }); }
for (let i = 0; i < 2; i++) { const g = group(0, 0, 0, 0); box(120, 16, 28, 0x3b4a5a, 0, 6, 0, g); box(30, 20, 24, 0xf3eee1, -40, 22, 0, g); for (let k = 0; k < 4; k++) box(18, 14, 22, [0xd8352a, 0xf5c547, 0x5fa08a, 0x3b6d8f][k], 10 + k * 20, 21, 0, g); SHIPS.push({ g, a: i * 3, r: 7200, w: 0.006, big: true }); }
const BALLOONS = [];
for (let i = 0; i < 6; i++) { const g = new THREE.Group(); const env = new THREE.Mesh(new THREE.IcosahedronGeometry(22, 1), mat([0xff8a2c, 0x5fe1ff, 0xf5c547, 0xff4fd8, 0x3ee69a, 0xd8352a][i])); env.scale.y = 1.2; env.position.y = 30; g.add(env);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), mat(0x8a5a2b)); g.add(basket); const x = srnd(-2000, 2000), z = srnd(-2000, 2000); g.position.set(x, ground(x, z) + srnd(300, 500), z); scene.add(g); BALLOONS.push({ g, y: g.position.y, p: srnd(0, 6) }); }
// ===== 動物和飛鳥 =====
const geoCache = {};
const bgeo = (w, h, d) => { const k = w + "," + h + "," + d; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); };
function part(w, h, d, c, x, y, z, parent) { const m = new THREE.Mesh(bgeo(w, h, d), mat(c)); m.position.set(x, y, z); parent.add(m); return m; }
function pivot(x, y, z, parent) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
// 四隻腳的動物（模型朝 -z 前進）
const SPECIES = {
  sheep: { body: [9, 6, 12, 0xf3f1ea], head: [3.6, 3.6, 4.2, 0x2b2b2b], leg: [1.6, 3, 0x2b2b2b], spd: 6 },
  cow: { body: [9, 7.5, 16, 0xf6f3ec], head: [4.6, 4.6, 5.4, 0xf6f3ec], leg: [2, 5, 0xf6f3ec], spd: 5, extra: (g, b) => { part(9.2, 4, 5, 0x2b2b2b, 0, b.y + 1.5, 2, g); part(5, 3, 4, 0x2b2b2b, 2.2, b.y - 1, -4, g); } },
  horse: { body: [6, 6.5, 15, 0x8a5a2b], head: [3.4, 7, 4, 0x8a5a2b], leg: [1.8, 7, 0x5a3d22], spd: 12, mane: 0x3a2716 },
  pig: { body: [7, 5.5, 10, 0xf2a7b5], head: [4.6, 4.2, 3.6, 0xf2a7b5], leg: [1.8, 2.2, 0xe08a9a], spd: 5 },
  deer: { body: [5, 5, 11, 0xb07a45], head: [2.8, 3.2, 4, 0xb07a45], leg: [1.2, 6.5, 0x8a5a2b], spd: 11, antler: 0x6b4426 },
  goat: { body: [5, 5, 9, 0xd9d0bc], head: [2.6, 3, 3.6, 0xd9d0bc], leg: [1.3, 4, 0x8a8070], spd: 7, horn: 0x5a5048 },
  fox: { body: [4, 3.6, 9, 0xe8762c], head: [3.6, 3, 4, 0xe8762c], leg: [1.1, 2.6, 0x2b1d14], spd: 13, tail: 0xe8762c, ears: 0xe8762c },
  flamingo: { body: [3.2, 3.2, 6, 0xff8fb0], head: [1.6, 2, 3.2, 0xff8fb0], leg: [0.6, 9, 0xff6f98], spd: 4, two: true, neck: 6 },
  penguin: { penguin: true, spd: 3 },
};
function makeAnimal(kind) {
  const sp = SPECIES[kind], g = new THREE.Group(), legs = []; let head = null;
  if (sp.penguin) {
    const b = pivot(0, 0, 0, g); part(4.5, 7, 4, 0x1f2328, 0, 3.8, 0, b); part(3.4, 5, 0.6, 0xffffff, 0, 3.5, -2.1, b); part(3.6, 3, 3.6, 0x1f2328, 0, 8.6, 0, b);
    part(1.4, 0.8, 1.8, 0xf5a623, 0, 8.4, -2.4, b); part(1, 0.5, 2.4, 0xf5a623, -1.2, 0.3, -0.6, b); part(1, 0.5, 2.4, 0xf5a623, 1.2, 0.3, -0.6, b);
    return { g, legs, head: null, body: b, sp, kind };
  }
  const [bw, bh, bd, bc] = sp.body, [lw, lh, lc] = sp.leg, y = lh + bh / 2;
  part(bw, bh, bd, bc, 0, y, 0, g);
  const lx = bw / 2 - lw / 2, lz = bd / 2 - lw;
  const spots = sp.two ? [[-0.8, 0], [0.8, 0]] : [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
  for (const [x, z] of spots) { const p = pivot(x, lh, z, g); part(lw, lh, lw, lc, 0, -lh / 2, 0, p); legs.push(p); }
  const [hw, hh, hd, hc] = sp.head, ny = y + bh / 2 + (sp.neck || 0);
  head = pivot(0, y + bh * 0.3, -bd / 2 + 0.5, g);
  if (sp.neck) part(0.8, sp.neck + 2, 0.8, bc, 0, (sp.neck + 2) / 2, 0, head);
  const hy = (sp.neck || 0) + (kind === "horse" ? 3 : hh * 0.35);
  part(hw, hh, hd, hc, 0, hy, -hd / 2, head);
  if (sp.mane) part(1, hh, 2, sp.mane, 0, hy + 1, 0.4, head);
  if (sp.antler) { part(0.5, 4, 0.5, sp.antler, -1, hy + hh / 2 + 2, -0.5, head); part(0.5, 4, 0.5, sp.antler, 1, hy + hh / 2 + 2, -0.5, head); part(3.4, 0.5, 0.5, sp.antler, 0, hy + hh / 2 + 3.4, -0.5, head); }
  if (sp.horn) { part(0.6, 2.4, 0.6, sp.horn, -0.8, hy + hh / 2 + 1, 0, head); part(0.6, 2.4, 0.6, sp.horn, 0.8, hy + hh / 2 + 1, 0, head); }
  if (sp.ears) { part(1, 1.8, 0.6, sp.ears, -1.2, hy + hh / 2 + 0.8, -0.6, head); part(1, 1.8, 0.6, sp.ears, 1.2, hy + hh / 2 + 0.8, -0.6, head); part(1.2, 1, 1.4, 0xf3eee1, 0, hy - 0.6, -hd - 0.4, head); }
  if (kind === "pig") part(2, 1.6, 0.8, 0xe07a8c, 0, hy - 0.4, -hd - 0.2, head);
  if (sp.tail) { const t = pivot(0, y + 0.6, bd / 2, g); t.rotation.x = 0.5; part(2.6, 2.6, 7, sp.tail, 0, 0, 3.4, t); part(2.4, 2.4, 1.6, 0xf3eee1, 0, 0, 7.4, t); }
  if (sp.extra) sp.extra(g, { y });
  return { g, legs, head, body: null, sp, kind };
}
const ANIMALS = [];
function landNear(cx, cz, R, lo, hi) { for (let k = 0; k < 200; k++) { const a = srnd(0, 6.283), r = Math.sqrt(srnd(0, 1)) * R, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, h = height(x, z); if (h >= lo && h <= hi && Math.abs(x - RUNWAY.x) > 330) return [x, z]; } return null; }
function herd(kind, cx, cz, n, R, lo, hi, scale) {
  const c = landNear(cx, cz, R * 0.5, lo, hi) || landNear(cx, cz, R * 1.5, lo, hi); if (!c) return;
  for (let i = 0; i < n; i++) { const p = landNear(c[0], c[1], 80, lo, hi); if (!p) continue; const a = makeAnimal(kind); a.g.scale.setScalar(scale || 1);
    a.g.position.set(p[0], ground(p[0], p[1]), p[1]); a.yaw = srnd(0, 6.28); a.g.rotation.y = a.yaw; scene.add(a.g);
    Object.assign(a, { home: c, R: R, lo, hi, mode: "idle", timer: srnd(0, 3), ph: srnd(0, 6), run: 0 }); ANIMALS.push(a); }
}
herd("sheep", 1350, 200, 8, 400, 22, 200); herd("sheep", 1000, -150, 7, 400, 22, 200); herd("sheep", -200, -300, 7, 500, 22, 220);
herd("cow", 1500, 500, 5, 400, 22, 200); herd("cow", 400, 300, 5, 400, 22, 200);
herd("horse", -700, 500, 4, 500, 22, 200); herd("horse", 200, -1000, 4, 500, 22, 260);
herd("pig", -150, 1100, 5, 250, 20, 200);
herd("fox", 750, -650, 3, 350, 22, 400, 1.2); herd("fox", -1200, -200, 2, 400, 22, 300, 1.2);
herd("penguin", IS.snow.x - IS.snow.r * 0.7, IS.snow.z + 300, 8, 300, 4, 60, 1.3); herd("penguin", IS.snow.x + IS.snow.r * 0.6, IS.snow.z + 500, 7, 300, 4, 60, 1.3);
herd("deer", IS.snow.x - 500, IS.snow.z + 500, 5, 600, 40, 300); herd("deer", IS.snow.x + 500, IS.snow.z - 300, 4, 600, 40, 300);
herd("goat", IS.volc.x - 700, IS.volc.z + 300, 5, 600, 30, 330); herd("goat", IS.volc.x + 500, IS.volc.z - 600, 4, 600, 30, 330);
herd("flamingo", IS.trop.x + IS.trop.r * 0.6, IS.trop.z, 7, 400, 2, 25, 1.3); herd("flamingo", IS.trop.x, IS.trop.z + IS.trop.r * 0.6, 6, 400, 2, 25, 1.3);
// 飛鳥（一群一群）
const FLOCKS = [];
function makeBird(c, wc, s) {
  const g = new THREE.Group(); g.scale.setScalar(s);
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 4), mat(c)); body.rotation.x = -Math.PI / 2; g.add(body);
  part(1.4, 1.2, 1.6, c, 0, 0.4, -2.6, g); part(0.5, 0.4, 1, 0xf5a623, 0, 0.3, -3.8, g);
  const L = pivot(-0.6, 0.2, 0, g), R = pivot(0.6, 0.2, 0, g); part(6, 0.3, 2.4, wc, -3, 0, 0, L); part(6, 0.3, 2.4, wc, 3, 0, 0, R);
  scene.add(g); return { g, L, R };
}
function flock(kind, cx, cz, R, alt, n, s) {
  const look = { gull: [0xffffff, 0xb8c0c8], goose: [0x5a5048, 0x8a8070], pigeon: [0x8a90a0, 0x6a7080], parrot: null, eagle: [0x5a3d22, 0x3a2716] }[kind];
  const pc = [[0xd8352a, 0x3b6dd8], [0x3ee69a, 0xf5c547], [0x3b6dd8, 0xf5c547]];
  const f = { kind, c: [cx, cz], R, alt, yaw: srnd(0, 6.28), turn: 0, speed: kind === "eagle" ? 34 : kind === "goose" ? 46 : 38, p: new THREE.Vector3(cx + srnd(-R, R) * 0.5, alt, cz + srnd(-R, R) * 0.5), birds: [], flee: 0, tt: 0 };
  for (let i = 0; i < n; i++) { const col = look || pc[i % 3]; const b = makeBird(col[0], col[1], s);
    const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? -1 : 1);
    b.off = kind === "goose" ? new THREE.Vector3(side * row * 9, 0, row * 8) : new THREE.Vector3(srnd(-30, 30), srnd(-12, 12), srnd(-30, 30));
    b.ph = srnd(0, 6.28); f.birds.push(b); }
  FLOCKS.push(f);
}
for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; flock("gull", Math.cos(a) * 2300, Math.sin(a) * 2300, 700, srnd(70, 150), 6, 1.4); }
flock("gull", IS.trop.x, IS.trop.z, 1200, 90, 6, 1.4); flock("gull", IS.city.x, IS.city.z, 1500, 120, 6, 1.4);
for (let i = 0; i < 5; i++) flock("goose", srnd(-4000, 4000), srnd(-4000, 4000), 3500, srnd(300, 480), 7, 1.7);
flock("pigeon", IS.city.x, IS.city.z, 600, 130, 10, 1.1); flock("pigeon", -300, 800, 400, 80, 8, 1.1);
flock("parrot", IS.trop.x, IS.trop.z, 600, 70, 9, 1.2);
flock("eagle", IS.snow.x, IS.snow.z, 500, 520, 1, 3); flock("eagle", IS.volc.x, IS.volc.z, 600, 480, 1, 3); flock("eagle", 750, -650, 500, 560, 1, 3);
// 海豚和鯨魚
const PODS = [];
function makeDolphin(c) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.8, 12, 6), mat(c)); b.rotation.x = Math.PI / 2; g.add(b);
  const n = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 6), mat(c)); n.rotation.x = -Math.PI / 2; n.position.z = -7.4; g.add(n);
  part(0.4, 3, 2.2, c, 0, 2, 0.5, g); part(5, 0.4, 1.8, c, 0, 0, 6.4, g); part(1.2, 0.6, 4, 0xe9f4ff, 0, -1.2, -1, g); scene.add(g); return g; }
for (let i = 0; i < 6; i++) { const a = srnd(0, 6.283), r = srnd(2500, 4200), pod = { a, r, w: srnd(0.02, 0.035) * (i % 2 ? 1 : -1), d: [] };
  for (let k = 0; k < 4; k++) pod.d.push({ g: makeDolphin(i % 3 ? 0x7a8ca8 : 0x8a9ab0), o: k * 0.22, s: srnd(-20, 20) }); PODS.push(pod); }
const WHALES = [];
for (let i = 0; i < 3; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 1), mat(0x3b4a5a)); b.scale.set(1, 0.55, 2.6); g.add(b);
  part(26, 1.2, 8, 0x3b4a5a, 0, 0, 44, g); part(10, 2, 26, 0xc9d3dc, 0, -6, -6, g);
  const spout = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 6, 1, true), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); spout.position.set(0, 18, -14); g.add(spout);
  scene.add(g); WHALES.push({ g, spout, a: srnd(0, 6.28), r: [3000, 4600, 6200][i], w: 0.012 * (i % 2 ? 1 : -1), ph: srnd(0, 10) }); }
const _v = new THREE.Vector3();
function animateLife(t, dt) {
  const P = S.p, cam = camera.position;
  for (const a of ANIMALS) {
    const x = a.g.position.x, z = a.g.position.z, far = Math.hypot(x - cam.x, z - cam.z);
    a.g.visible = far < 3200; if (far > 2600) continue;
    // 飛機低空飛過會被嚇跑
    const pd = Math.hypot(P.x - x, P.z - z);
    if (S.running && pd < 160 && P.y - a.g.position.y < 110 && a.run <= 0) { a.run = 2.5; a.yaw = Math.atan2(P.x - x, P.z - z); a.mode = "walk"; }
    a.timer -= dt; a.run = Math.max(0, a.run - dt);
    if (a.timer <= 0 && a.run <= 0) { const r = srnd(0, 1); a.mode = r < 0.45 ? "walk" : r < 0.8 ? "graze" : "idle"; a.timer = srnd(2, 6); if (a.mode === "walk") a.yaw += srnd(-1.2, 1.2); }
    let sp = a.run > 0 ? a.sp.spd * 3 : a.mode === "walk" ? a.sp.spd : 0;
    if (sp > 0) {
      const dh = Math.hypot(x - a.home[0], z - a.home[1]);
      if (dh > a.R) { const want = Math.atan2(-(a.home[0] - x), -(a.home[1] - z)); let d = want - a.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; a.yaw += clamp(d, -2, 2) * dt * 2; }
      const nx = x - Math.sin(a.yaw) * sp * dt, nz = z - Math.cos(a.yaw) * sp * dt, h = height(nx, nz);
      if (h < a.lo || h > a.hi || (Math.abs(nx - RUNWAY.x) < 300 && Math.abs(nz - RUNWAY.z) < 60)) { a.yaw += 2.5; sp = 0; } else { a.g.position.x = nx; a.g.position.z = nz; }
    }
    { let d = a.yaw - a.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); a.g.rotation.y += d * Math.min(1, dt * 4); }
    a.g.position.y = ground(a.g.position.x, a.g.position.z);
    const sw = sp > 0 ? Math.sin(t * sp * 0.9 + a.ph) * (a.run > 0 ? 0.9 : 0.5) : 0;
    a.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? sw : -sw) * (i > 1 ? -1 : 1); });
    if (a.head) a.head.rotation.x += ((a.mode === "graze" && sp === 0 ? -0.8 : 0) - a.head.rotation.x) * Math.min(1, dt * 3);
    if (a.body) { a.body.rotation.z = sp > 0 ? Math.sin(t * 9 + a.ph) * 0.18 : 0; if (a.run > 0) a.body.rotation.x = -0.6; else a.body.rotation.x *= 0.9; }
  }
  for (const f of FLOCKS) {
    f.tt -= dt; if (f.tt <= 0) { f.tt = srnd(2, 5); f.turn = f.kind === "eagle" ? 0.35 : srnd(-0.4, 0.4); }
    const dc = Math.hypot(f.p.x - f.c[0], f.p.z - f.c[1]);
    if (dc > f.R) { const want = Math.atan2(-(f.c[0] - f.p.x), -(f.c[1] - f.p.z)); let d = want - f.yaw; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; f.yaw += clamp(d, -1, 1) * dt * 0.8; }
    else f.yaw += f.turn * dt;
    const near = f.p.distanceTo(P) < 90 && S.running; if (near) f.flee = 3;
    f.flee = Math.max(0, f.flee - dt);
    const v = f.speed * (f.flee > 0 ? 1.8 : 1);
    f.p.x -= Math.sin(f.yaw) * v * dt; f.p.z -= Math.cos(f.yaw) * v * dt;
    const gy = Math.max(f.alt, ground(f.p.x, f.p.z) + 50) + (f.flee > 0 ? 60 : 0); f.p.y += (gy + Math.sin(t * 0.3 + f.c[0]) * 15 - f.p.y) * Math.min(1, dt * 0.8);
    const far = f.p.distanceTo(cam) > 4500;
    for (const b of f.birds) {
      b.g.visible = !far; if (far) continue;
      _v.copy(b.off).applyAxisAngle(THREE.Object3D.DEFAULT_UP, f.yaw);
      const spread = f.flee > 0 ? 1.8 : 1;
      b.g.position.set(f.p.x + _v.x * spread, f.p.y + _v.y * spread + Math.sin(t * 1.3 + b.ph) * 3, f.p.z + _v.z * spread);
      b.g.rotation.set(0, f.yaw + Math.sin(t * 0.7 + b.ph) * 0.08, -f.turn * 0.6, "YXZ");
      const glide = f.kind === "eagle" || (f.kind === "gull" && Math.sin(t * 0.5 + b.ph) > 0.3);
      const fl = glide && f.flee <= 0 ? Math.sin(t * 1.5 + b.ph) * 0.08 : Math.sin(t * (f.kind === "pigeon" || f.kind === "parrot" ? 16 : 9) + b.ph) * 0.7;
      b.L.rotation.z = -fl; b.R.rotation.z = fl;
    }
  }
  for (const pod of PODS) { pod.a += pod.w * dt;
    for (const d of pod.d) { const a = pod.a + d.o * Math.sign(pod.w) * 0.02, x = Math.cos(a) * (pod.r + d.s), z = Math.sin(a) * (pod.r + d.s);
      const ph = ((t * 0.45 + d.o) % 1), jump = ph < 0.4, k = ph / 0.4;
      d.g.position.set(x, jump ? Math.sin(k * Math.PI) * 16 - 3 : -10, z);
      d.g.visible = jump && Math.hypot(x - cam.x, z - cam.z) < 4500;
      d.g.rotation.set(jump ? Math.cos(k * Math.PI) * 0.9 : 0, Math.atan2(-(-Math.sin(a)) * Math.sign(pod.w), -(Math.cos(a)) * Math.sign(pod.w)), 0, "YXZ"); } }
  for (const w of WHALES) { w.a += w.w * dt; const x = Math.cos(w.a) * w.r, z = Math.sin(w.a) * w.r;
    w.g.position.set(x, 1 + Math.sin(t * 0.4 + w.ph) * 2.5, z); w.g.rotation.y = Math.atan2(Math.sin(w.a) * Math.sign(w.w), -Math.cos(w.a) * Math.sign(w.w)) ;
    const sp = (t + w.ph) % 9; w.spout.visible = sp < 1.6; const s = sp < 1.6 ? Math.sin(sp / 1.6 * Math.PI) : 0; w.spout.scale.set(0.4 + s * 0.6, Math.max(0.01, s), 0.4 + s * 0.6); w.spout.position.y = 4 + s * 13; }
}
// 雲
const clouds = [];
for (let i = 0; i < 120; i++) { const g = new THREE.Group(), n = 3 + Math.floor(srnd(0, 3));
  for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(srnd(26, 46), 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa4b4, flatShading: true, transparent: true, opacity: 0.9 })); m.position.set(k * 40 - n * 20, srnd(-8, 8), srnd(-14, 14)); g.add(m); }
  g.position.set(srnd(-9000, 9000), srnd(420, 760), srnd(-9000, 9000)); scene.add(g); clouds.push(g); }
// 夜晚的星空
const starField = (() => { const geo = new THREE.BufferGeometry(), arr = []; for (let i = 0; i < 700; i++) { const a = srnd(0, Math.PI * 2), e = srnd(0.08, 1.4), r = 11000; arr.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 18, fog: false })); p.visible = false; scene.add(p); return p; })();
// 可以探索的地點
const PLACES = [
  { name: "機場", x: RUNWAY.x - 100, z: RUNWAY.z - 100 }, { name: "小鎮", x: -300, z: 800 }, { name: "摩天輪", x: 260, z: 1150 }, { name: "風車農場", x: 1350, z: 200 },
  { name: "燈塔", x: 1850, z: 1650 }, { name: "酷丁狐雕像", x: 750, z: -650 }, { name: "跨海大橋", x: -3570, z: 575 }, { name: "雪山天文台", x: IS.snow.x - 300, z: IS.snow.z },
  { name: "雪山小屋", x: IS.snow.x - 720, z: IS.snow.z + 720 }, { name: "火山口", x: IS.volc.x, z: IS.volc.z }, { name: "椰子島碼頭", x: IS.trop.x - IS.trop.r * 0.75, z: IS.trop.z }, { name: "城市高塔", x: IS.city.x - 60, z: IS.city.z - 60 },
].map((p) => ({ ...p, found: false }));
function animateWorld(t, dt) {
  for (const f of ANIM) f(t, dt);
  animateLife(t, dt);
  for (const s of SHIPS) { s.a += s.w * dt * 6; s.g.position.set(Math.cos(s.a) * s.r, s.big ? 0 : 0, Math.sin(s.a) * s.r); s.g.rotation.y = -s.a + (s.w > 0 ? 0 : Math.PI); s.g.position.y = Math.sin(t * 1.5 + s.r) * 0.8; }
  for (const b of BALLOONS) { b.g.position.y = b.y + Math.sin(t * 0.4 + b.p) * 20; b.g.position.x += Math.sin(b.p) * dt * 4; b.g.position.z += Math.cos(b.p) * dt * 4; }
}

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
const S = { mode: null, running: false, t: 0, p: new THREE.Vector3(0, 160, 1700), yaw: 0, pitch: 0, roll: 0, speed: 0, thr: 0, inv: 0, ground: true, airT: 0, btn: 0, lastB: 0,
  ix: 0, iy: 0, sx: 0, sy: 0, lastIn: 0, lastD: 0, d: null, score: 0, left: 0, rings: [], ringIdx: 0, ringT: 0, sky: "day", vmul: 1, boost: 0, outT: 0, crashes: 0 };
const keys = {};
addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith("Arrow")) e.preventDefault(); });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
MB.on((ev) => {
  const now = performance.now();
  if (ev.key === "x") { S.ix = clamp(ev.value / 700, -1, 1); S.lastIn = now; }
  if (ev.key === "y") { S.iy = clamp(-ev.value / 700, -1, 1); S.lastIn = now; }   // micro:bit 往前壓時 y 是負的 → 機頭往下
  if (ev.key === "b") { S.btn = ev.value; S.lastB = now; }   // 1＝按住 A 加油門，2＝按住 B 減油門
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
// 停在跑道東端，機頭朝西；要自己加油門滑行、起飛
const RWY_Y = 18 + 3;
function resetPlane() { S.p.set(RUNWAY.x + RUNWAY.len / 2 - 30, RWY_Y, RUNWAY.z); S.yaw = Math.PI / 2; S.pitch = 0; S.roll = 0; S.speed = 0; S.thr = 0; S.inv = 0; S.ground = true; S.airT = 0; }
function start(mode) {
  clearItems(); Object.assign(S, { mode, running: true, t: 0, score: 0, left: 0, rings: [], ringIdx: 0, ringT: 0, vmul: 1, boost: 0, crashes: 0 });
  setSky("day"); resetPlane(); for (const pl of PLACES) pl.found = false;
  if (mode === "timed") for (let i = 0; i < 45; i++) { const p = randomSpot(i % 6 ? "land" : "high"); addStar(p.x, p.y, p.z); }
  if (mode === "free") for (let i = 0; i < 60; i++) { const I = ISLES[i % 5] || null, p = I ? (() => { const a = rnd(0, 6.28), r = rnd(0, I.r * 0.8), x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r; return { x, y: ground(x, z) + rnd(40, 160), z }; })() : randomSpot("land"); addStar(p.x, p.y, p.z); }
  if (mode === "timed") S.left = 60;
  if (mode === "rings") { S.rings = buildCourse(); S.rings[0].mesh.material = ringMat.next;
    const r0 = S.rings[0], r1 = S.rings[1], dx = r1.x - r0.x, dz = r1.z - r0.z, L = Math.hypot(dx, dz);   // 從第一個圓環前面出發
  }
  $("menu").hidden = true; $("endOv").hidden = true; hud(); SFX.audio();
  toast("按住 A 加油門，滑行起飛！");
  S.goal = mode === "rings" ? "跟著箭頭穿過圓環！" : mode === "free" ? "到處逛逛，找找看有哪些地方" : mode === "timed" ? "收集星星！60 秒開始倒數" : "";
}
function finish(title, text, score) {
  S.running = false; send("end");
  $("endTitle").textContent = title; $("endText").textContent = text; $("endScore").textContent = score;
  setTimeout(() => { $("endOv").hidden = false; }, 700);
}
function hud() {
  if (S.mode === "rings") { $("l1").textContent = "圓環"; $("v1").textContent = `${S.ringIdx}/${S.rings.length}`; $("l2").textContent = "時間"; $("v2").textContent = S.ringT.toFixed(1); }
  else if (S.mode === "free") { $("l1").textContent = "星星"; $("v1").textContent = S.score; $("l2").textContent = "探索"; $("v2").textContent = `${PLACES.filter((q) => q.found).length}/${PLACES.length}`; }
  else { $("l1").textContent = "星星"; $("v1").textContent = S.score; $("l2").textContent = "時間"; $("v2").textContent = S.mode === "timed" ? Math.ceil(S.left) : "--"; }
}
function collect(it) {
  if (S.mode === "lab") { if (typeof LAB !== "undefined") LAB.fire(it.kind === "star" ? "star" : "ring", undefined, it); return; }
  if (it.kind === "star") { removeItem(it); S.score++; sfx.star(); send("star"); burst(it.x, it.y, it.z, 0xffd84a);
    if (S.mode === "timed") { const p = randomSpot("land"); addStar(p.x, p.y, p.z); } hud(); }
}
function crash(what) {
  sfx.crash(); burst(S.p.x, Math.max(S.p.y, 2), S.p.z, what === "water" ? 0xbfe8ff : 0x8a6a4a); S.crashes++;
  if (S.mode === "lab") { if (typeof LAB !== "undefined" && LAB.fire("crash", what)) { S.inv = 1.5; S.ground = false; S.p.y = ground(S.p.x, S.p.z) + 120; S.pitch = 0.1; return; } }
  else send("crash");
  toast(what === "water" ? "掉進海裡了！重新起飛" : "撞到地面了！重新起飛");
  S.p.y = ground(S.p.x, S.p.z) + 140; S.pitch = 0.15; S.roll = 0; S.speed = Math.max(S.speed, 70); S.inv = 2; S.ground = false;
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
  // 油門：按住 A 加、按住 B 減（鍵盤 W／S）；有送超音波 d 時改用手的高度
  if (now - S.lastD < 1500 && S.d != null) S.thr = clamp((S.d - 5) / 35, 0, 1);
  else { const up = (now - S.lastB < 1500 && S.btn === 1) || keys.w, dn = (now - S.lastB < 1500 && S.btn === 2) || keys.s;
    if (up) S.thr = Math.min(1, S.thr + dt * 0.5); if (dn) S.thr = Math.max(0, S.thr - dt * 0.5); }
  // 飛行（街機式）
  const inv = $("invert").checked ? -1 : 1;
  S.roll += (S.sx * 0.95 - S.roll) * Math.min(1, dt * 3);
  let pitchTarget = clamp(-S.sy * inv * 0.7, -0.75, 0.75);
  S.boost = Math.max(0, S.boost - dt);
  if (S.ground) {
    // 在跑道上：油門推動滑行，速度夠了機頭自動抬起離地
    S.roll *= 0.8; pitchTarget = S.speed > 70 ? Math.max(pitchTarget, 0.22) : 0;
    S.speed = Math.max(0, S.speed + (S.thr * 45 - 6 - S.speed * 0.05) * dt * (S.running ? 1 : 0));
  } else {
    const target = (55 + S.thr * 110) * S.vmul * (S.boost > 0 ? 1.6 : 1) - S.pitch * 30;
    S.speed += (target - S.speed) * Math.min(1, dt * 0.9);
  }
  S.pitch += (pitchTarget - S.pitch) * Math.min(1, dt * 2);
  if (S.running) {
    if (S.ground) S.yaw += clamp(-S.sx, -1, 1) * 0.4 * dt * Math.min(1, S.speed / 20); else S.yaw -= S.roll * 1.05 * dt;
    // 飛太遠會自動轉回小島
    const r = Math.hypot(S.p.x, S.p.z);
    if (r > WORLD_R) { const want = Math.atan2(S.p.x, S.p.z); let da = want - S.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; S.yaw += clamp(da, -1, 1) * dt * 0.9; if (S.t - S.outT > 3) { S.outT = S.t; toast("太遠了，往回飛！"); } }
    S.p.addScaledVector(fwd(), S.speed * dt);
    if (S.p.y > 900) { S.p.y = 900; S.pitch = Math.min(S.pitch, 0); }
    S.inv = Math.max(0, S.inv - dt);
    const g = ground(S.p.x, S.p.z);
    if (S.ground) {
      if (S.p.y > g + 9) { S.ground = false; S.inv = 1; toast("起飛了！" + (S.goal || "")); }
      else if (S.speed < 70 || S.p.y < g + 3) { if (g > RWY_Y + 5) crash("ground"); else S.p.y = g + 3; }
    }
    else if (S.p.y < g + 3) { if (S.inv > 0) S.p.y = g + 3; else crash(height(S.p.x, S.p.z) <= 0 ? "water" : "ground"); }
    else if (S.inv <= 0) for (const c of COLLIDE) if (S.p.y < c.h && Math.hypot(S.p.x - c.x, S.p.z - c.z) < c.r + 4) { crash("ground"); break; }
    // 發現新地點
    if (S.mode === "free" || S.mode === "lab") for (const pl of PLACES) if (!pl.found && Math.hypot(pl.x - S.p.x, pl.z - S.p.z) < 450) {
      pl.found = true; const n = PLACES.filter((q) => q.found).length; toast(`發現：${pl.name}！（${n}/${PLACES.length}）`); SFX.tone(660, 990, 0.25, "triangle", 0.12); hud();
      if (S.mode === "lab" && typeof LAB !== "undefined") LAB.fire("place", undefined, pl);
      if (S.mode === "free" && n === PLACES.length) toast("所有地點都找到了！你是探險家！"); }
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
    if (S.mode === "timed" && !S.ground) { S.left -= dt; if (S.left <= 0) { S.left = 0; hud(); finish("時間到！", "60 秒內收集到的星星：", `${S.score} 顆`); } else if (Math.ceil(S.left) !== Math.ceil(S.left + dt)) hud(); }
    if (S.mode === "rings" && !S.ground) { S.ringT += dt; $("v2").textContent = S.ringT.toFixed(1); }
  }
  // 動畫
  for (const it of ITEMS) if (!it.dead) { if (it.kind === "star") { it.mesh.rotation.y += dt * 2; it.mesh.position.y = it.y + Math.sin(S.t * 2 + it.x) * 3; } else if (it.mesh.material === ringMat.next) it.mesh.scale.setScalar(1 + Math.sin(S.t * 5) * 0.06); }
  for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.life -= dt; b.v.y -= 120 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 5; if (b.life <= 0) { scene.remove(b.m); bits.splice(i, 1); } }
  for (const c of clouds) { c.position.x += dt * 6; if (c.position.x > 9000) c.position.x = -9000; }
  animateWorld(S.t, dt);
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
  else if (S.mode === "free") { let bd = 1e9; for (const pl of PLACES) if (!pl.found) { const d = Math.hypot(pl.x - S.p.x, pl.z - S.p.z); if (d < bd) { bd = d; tgt = { ...pl, y: ground(pl.x, pl.z) + 60 }; } } }
  else { let bd = 1e9; for (const it of ITEMS) if (!it.dead) { const d = Math.hypot(it.x - S.p.x, it.z - S.p.z); if (d < bd) { bd = d; tgt = it; } } }
  const ar = $("arrow");
  if (tgt && S.running) { const a = Math.atan2(-(tgt.x - S.p.x), -(tgt.z - S.p.z)); let da = a - S.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    ar.hidden = false; $("arrowIco").style.transform = `rotate(${-da * 57.3}deg)`; const dy = tgt.y - S.p.y;
    $("arrowTxt").textContent = `${tgt.name ? tgt.name + "　" : ""}${Math.round(Math.hypot(tgt.x - S.p.x, tgt.z - S.p.z))} 公尺 ${!tgt.name && dy > 40 ? "↑ 往上" : !tgt.name && dy < -40 ? "↓ 往下" : ""}`; }
  else ar.hidden = true;
  drawMini();
}
// 小地圖
const mini = $("mini"), mg = mini.getContext("2d"), MAPR = WORLD_R, mapImg = document.createElement("canvas");
(() => { mapImg.width = mapImg.height = 120; const c = mapImg.getContext("2d"), d = c.createImageData(120, 120);
  for (let j = 0; j < 120; j++) for (let i = 0; i < 120; i++) { const x = (i / 119 * 2 - 1) * MAPR, z = (j / 119 * 2 - 1) * MAPR, h = height(x, z), o = (j * 120 + i) * 4, tp = isleAt(x, z);
    const col = h <= 0 ? [58, 142, 192] : tp === "snow" ? [232, 238, 244] : tp === "volc" ? [90, 74, 80] : tp === "city" ? [154, 160, 170] : tp === "trop" ? [143, 209, 79] : h < 16 ? [232, 212, 154] : h < 150 ? [88, 181, 70] : h < 380 ? [138, 127, 114] : [244, 248, 252]; d.data.set([...col, 255], o); }
  c.putImageData(d, 0, 0); })();
function drawMini() {
  const W = mini.width, k = W / (MAPR * 2), mx = (x) => (x + MAPR) * k;
  mg.imageSmoothingEnabled = false; mg.drawImage(mapImg, 0, 0, W, W);
  for (const it of ITEMS) if (!it.dead) { mg.fillStyle = it.kind === "star" ? "#ffd84a" : (S.mode === "rings" && it === S.rings[S.ringIdx] ? "#ff4a2c" : it.mesh.material === ringMat.done ? "#3ee69a88" : "#ffffffaa"); mg.fillRect(mx(it.x) - 2, mx(it.z) - 2, 4, 4); }
  for (const pl of PLACES) { mg.fillStyle = pl.found ? "#ff8a2c" : "rgba(255,255,255,.55)"; mg.beginPath(); mg.arc(mx(pl.x), mx(pl.z), pl.found ? 3.5 : 2.5, 0, 7); mg.fill(); }
  mg.save(); mg.translate(mx(S.p.x), mx(S.p.z)); mg.rotate(-S.yaw); mg.fillStyle = "#d8352a"; mg.strokeStyle = "#fff"; mg.lineWidth = 1.5; mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(5, 5); mg.lineTo(-5, 5); mg.closePath(); mg.fill(); mg.stroke(); mg.restore();
}

let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
resetPlane(); S.running = false; requestAnimationFrame(loop);

document.querySelectorAll(".mode[data-mode]").forEach((b) => b.addEventListener("click", MB.gate(() => start(b.dataset.mode))));
$("againBtn").onclick = MB.gate(() => start(S.mode));
$("backBtn").onclick = () => { $("endOv").hidden = true; $("menu").hidden = false; };
$("menuBtn").onclick = () => { if (S.mode === "lab" && typeof LAB !== "undefined") LAB.stop(); S.running = false; $("menu").hidden = false; };
$("soundBtn").onclick = () => { SFX.set(!SFX.on); $("soundBtn").textContent = SFX.on ? "音效 開" : "音效 關"; };
