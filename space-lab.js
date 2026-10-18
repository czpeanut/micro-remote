"use strict";
/* 超音波太空梭 — 規則實驗室（積木規則）。需要先載入 rulelab.js 和 space.js */
const SP_KINDS = [["能量水晶", "gem"], ["隕石", "rock"], ["燃料罐", "fuel"], ["護盾泡泡", "shield"], ["外星飛碟", "ufo"]];
const SP_NAME = Object.fromEntries(SP_KINDS.map(([a, b]) => [b, a]));
const SP_R = { gem: 18, rock: 30, fuel: 18, shield: 20, ufo: 26 };
const SP_COL = { gem: "#7ff3ff", rock: "#c9a27a", fuel: "#ff9f43", shield: "#5fe1ff", ufo: "#9dff6a" };
const L = { ents: [], fly: 1, kspd: {}, crowd: false };

function labSpawn(kind, n, where) {
  if (!SP_R[kind]) return; n = clamp(Math.round(Number(n) || 0), 0, 20);
  for (let i = 0; i < n; i++) {
    if (L.ents.length >= 80) { if (!L.crowd) { L.crowd = true; LAB.toast("太空太擠了，放不下更多"); } return; }
    const top = 100, bot = H - 100, sy = shipPos().y;
    const y = where === "top" ? top + rnd(0, 40) : where === "bottom" ? bot - rnd(0, 40) : where === "middle" ? H / 2 + rnd(-30, 30) : where === "ship" ? clamp(sy, top, bot) : rnd(top, bot);
    const base = kind === "rock" ? rnd(160, 260) : kind === "ufo" ? rnd(110, 150) : rnd(140, 190);
    const e = { kind, x: W + 40 + i * 70, y, by: y, vx: -base, ph: rnd(0, 6), cool: 0, dead: false, r: SP_R[kind] * (kind === "rock" ? rnd(0.8, 1.4) : 1), rot: rnd(0, 6), vr: rnd(-1.5, 1.5), pts: [] };
    if (kind === "rock") for (let k = 0; k < 10; k++) e.pts.push(rnd(0.7, 1.1));
    L.ents.push(e);
  }
}
function labUpdate(dt) {
  LAB.tick(dt); if (!LAB.running) return;
  S.inv = Math.max(0, S.inv - dt); S.speed = L.fly;
  const sp = shipPos(), sz = S.shipSz || 1;
  for (const e of L.ents) {
    if (e.dead) continue;
    const m = (L.kspd[e.kind] ?? 1) * L.fly;
    e.x += e.vx * m * dt; e.ph += dt * 4; e.rot += e.vr * dt; e.cool = Math.max(0, e.cool - dt);
    if (e.kind === "ufo") e.y = e.by + Math.sin(e.ph * 0.7) * 70;
    if (e.x < -60) { e.dead = true; LAB.fire("miss", e.kind, e); continue; }
    if (e.cool <= 0 && Math.hypot(e.x - sp.x, e.y - sp.y) < e.r * 0.85 + 18 * sz) {
      e.cool = 0.8;
      if (S.inv > 0 && (e.kind === "rock" || e.kind === "ufo")) { e.dead = true; burst(e.x, e.y, "#5fe1ff", 16); continue; }
      LAB.fire("touch", e.kind, e);
    }
  }
  L.ents = L.ents.filter((e) => !e.dead);
}
function labDraw() {
  for (const e of L.ents) {
    g.save(); g.translate(e.x, e.y);
    if (e.kind === "gem") { const r = 13 + Math.sin(e.ph) * 2; g.shadowColor = "#7ff3ff"; g.shadowBlur = 18; g.fillStyle = "#bff8ff";
      g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, r); g.lineTo(-r * 0.7, 0); g.closePath(); g.fill(); g.fillStyle = "#4fd6f0"; g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, 0); g.closePath(); g.fill(); }
    else if (e.kind === "rock") { g.rotate(e.rot); g.fillStyle = "#6e5a4b"; g.strokeStyle = "#3d2f25"; g.lineWidth = 3; g.beginPath();
      e.pts.forEach((k, i) => { const a = (i / e.pts.length) * 6.283, x = Math.cos(a) * e.r * k, y = Math.sin(a) * e.r * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#54443a"; g.beginPath(); g.arc(e.r * 0.25, -e.r * 0.2, e.r * 0.22, 0, 7); g.fill(); }
    else if (e.kind === "fuel") { g.rotate(Math.sin(e.ph) * 0.2); g.fillStyle = "#ff9f43"; g.strokeStyle = "#5a2a0a"; g.lineWidth = 2; g.fillRect(-11, -16, 22, 32); g.strokeRect(-11, -16, 22, 32);
      g.fillStyle = "#fff3"; g.fillRect(-8, -12, 5, 24); g.fillStyle = "#2b1d14"; g.fillRect(-5, -21, 10, 6); g.font = "900 13px sans-serif"; g.textAlign = "center"; g.fillStyle = "#2b1d14"; g.fillText("F", 2, 6); }
    else if (e.kind === "shield") { const r = 18 + Math.sin(e.ph) * 2; g.strokeStyle = "#5fe1ff"; g.lineWidth = 3; g.fillStyle = "rgba(95,225,255,.18)"; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#e9f4ff"; g.beginPath(); g.moveTo(0, -9); g.lineTo(8, -5); g.lineTo(6, 6); g.lineTo(0, 10); g.lineTo(-6, 6); g.lineTo(-8, -5); g.closePath(); g.fill(); }
    else if (e.kind === "ufo") { g.fillStyle = "#9dff6a55"; g.beginPath(); g.ellipse(0, -6, 12, 12, 0, Math.PI, 0); g.fill(); g.fillStyle = "#b9c4d0"; g.beginPath(); g.ellipse(0, 2, 28, 9, 0, 0, 7); g.fill();
      for (let i = -2; i <= 2; i++) { g.fillStyle = Math.floor(e.ph * 2 + i) % 2 ? "#ffc94a" : "#ff6f6f"; g.beginPath(); g.arc(i * 10, 3, 2.5, 0, 7); g.fill(); }
      g.fillStyle = "#9dff6a"; g.beginPath(); g.arc(0, -8, 5, 0, 7); g.fill(); }
    g.restore();
  }
}

const { hat, act, val, dd, vin } = RuleLab.helpers;
const CS = "#3866d6";
const WHERE = [["隨機高度", "random"], ["最上面", "top"], ["中間", "middle"], ["最下面", "bottom"], ["太空梭的高度", "ship"]];
const SPEEDS = [["普通", "1"], ["慢", "0.5"], ["快", "1.6"], ["超快", "2.4"], ["停住", "0"]];
const LAB = RuleLab.create({
  id: "space", title: "太空梭規則實驗室",
  tip: "<b>怎麼玩</b><br>1. 從「事件」拖出「當遊戲開始」。<br>2. 從「太空」放出隕石或水晶。<br>3. 用「當太空梭碰到」決定加分或扣生命。<br><b>操作</b>：手在超音波上方上下移動，或用 ↑ ↓、滑鼠。",
  blocks: [
    hat("sp_touch", "當太空梭碰到 %1", [dd("KIND", SP_KINDS)], "裡面的「它」就是碰到的那一個"),
    hat("sp_miss", "當 %1 飛走了", [dd("KIND", SP_KINDS)], "沒有被碰到，飛出畫面左邊時執行"),
    act("sp_spawn", "放出 %1 個 %2 在 %3", [vin("N", "Number"), dd("KIND", SP_KINDS), dd("WHERE", WHERE)], CS, "從畫面右邊飛進來，一次最多 20 個"),
    act("sp_remove_it", "移除「它」", [], CS, "放在「當太空梭碰到」裡面"),
    act("sp_remove_all", "移除所有 %1", [dd("KIND", SP_KINDS)], CS),
    act("sp_kind_speed", "%1 的速度設為 %2", [dd("KIND", SP_KINDS), dd("SPD", SPEEDS)], CS),
    act("sp_fly", "飛行速度 %1", [dd("SPD", SPEEDS.slice(0, 4))], CS, "所有東西和星空一起變快或變慢"),
    act("sp_shield", "開啟護盾 %1 秒", [vin("N", "Number")], CS, "護盾開著時，碰到隕石和飛碟會直接把它們撞碎"),
    act("sp_size", "太空梭大小 %1", [dd("SZ", [["普通", "1"], ["小", "0.7"], ["大", "1.4"]])], CS),
    act("sp_range", "超音波範圍 %1 到 %2 公分", [vin("A", "Number"), vin("B", "Number")], CS, "手在最近的距離時飛最低，最遠時飛最高"),
    act("sp_shake", "畫面震動", [], CS),
    act("sp_fx", "在 %1 產生 %2", [dd("AT", [["「它」的位置", "it"], ["太空梭的位置", "ship"]]), dd("FX", [["爆炸", "boom"], ["閃光", "flash"], ["星星", "stars"]])], CS),
    val("sp_dist", "手的距離（公分）", [], CS),
    val("sp_height", "太空梭高度（0～100）", [], CS),
    val("sp_count", "%1 的數量", [dd("KIND", SP_KINDS)], CS),
  ],
  hats: ["sp_touch", "sp_miss"],
  evNames: { touch: (a) => `當太空梭碰到${SP_NAME[a] || ""}`, miss: (a) => `當${SP_NAME[a] || ""}飛走了` },
  gens(F, h) {
    const { q, v, call, hatGen, O, num } = h;
    F.sp_touch = hatGen("touch", (b) => q(b.getFieldValue("KIND")));
    F.sp_miss = hatGen("miss", (b) => q(b.getFieldValue("KIND")));
    F.sp_spawn = (b) => call("spawn", q(b.getFieldValue("KIND")), v(b, "N", "1"), q(b.getFieldValue("WHERE")));
    F.sp_remove_it = () => call("removeIt");
    F.sp_remove_all = (b) => call("removeAll", q(b.getFieldValue("KIND")));
    F.sp_kind_speed = (b) => call("kindSpeed", q(b.getFieldValue("KIND")), num(b.getFieldValue("SPD")));
    F.sp_fly = (b) => call("fly", num(b.getFieldValue("SPD")));
    F.sp_shield = (b) => call("shield", v(b, "N", "3"));
    F.sp_size = (b) => call("size", num(b.getFieldValue("SZ")));
    F.sp_range = (b) => call("range", v(b, "A", "5"), v(b, "B", "40"));
    F.sp_shake = () => call("shake");
    F.sp_fx = (b) => call("fx", q(b.getFieldValue("AT")), q(b.getFieldValue("FX")));
    F.sp_dist = () => ["api.dist()", O.FUNCTION_CALL];
    F.sp_height = () => ["api.height()", O.FUNCTION_CALL];
    F.sp_count = (b) => [`api.count(${q(b.getFieldValue("KIND"))})`, O.FUNCTION_CALL];
  },
  toolbox: ({ n, b }) => [{ name: "太空", colour: CS, contents: [
    b("sp_spawn", { N: n(1) }), b("sp_remove_it"), b("sp_remove_all"), b("sp_kind_speed"), b("sp_fly"), b("sp_shield", { N: n(3) }), b("sp_size"),
    b("sp_range", { A: n(5), B: n(40) }), b("sp_shake"), b("sp_fx"), b("sp_dist"), b("sp_height"), b("sp_count")] }],
  api: {
    spawn: labSpawn,
    removeIt() { const e = this._it; if (e && !e.dead) { e.dead = true; burst(e.x, e.y, SP_COL[e.kind], 14, 160); } },
    removeAll(kind) { for (const e of L.ents) if (e.kind === kind) e.dead = true; },
    kindSpeed(kind, m) { L.kspd[kind] = clamp(Number(m) || 0, 0, 3); },
    fly(m) { L.fly = clamp(Number(m) || 1, 0.3, 3); },
    shield(sec) { S.inv = clamp(Number(sec) || 0, 0, 30); },
    size(m) { S.shipSz = clamp(Number(m) || 1, 0.5, 1.6); },
    range(a, b) { a = Number(a) || 0; b = Number(b) || 0; if (Math.abs(b - a) < 2) return; DMIN = Math.min(a, b); DMAX = Math.max(a, b); if (S.dist) setDist(S.dist); },
    shake() { S.shake = 1; },
    fx(at, type) {
      const e = at === "it" && this._it ? this._it : shipPos();
      if (type === "boom") { burst(e.x, e.y, "#ffb347", 34); burst(e.x, e.y, "#ff5a3c", 16); S.shake = Math.max(S.shake, 0.7); }
      else if (type === "flash") burst(e.x, e.y, "#ffffff", 30, 260); else burst(e.x, e.y, "#ffe27a", 24, 180);
    },
    dist() { return S.dist != null && MB.live() ? Math.round(S.dist) : Math.round(DMIN + S.target * (DMAX - DMIN)); },
    height() { return Math.round(S.y * 100); },
    count(kind) { return L.ents.reduce((n, e) => n + (e.kind === kind && !e.dead ? 1 : 0), 0); },
  },
  templates: (x) => {
    const B = x.B, N = x.N, T = x.T;
    const spawn = (n, k, w) => B("sp_spawn", { KIND: k, WHERE: w || "random" }, { N: N(n) });
    const rm = () => B("sp_remove_it"), shake = () => B("sp_shake"), fx = (at, f) => B("sp_fx", { AT: at, FX: f });
    const shield = (n) => B("sp_shield", {}, { N: N(n) }), speed = (k, s) => B("sp_kind_speed", { KIND: k, SPD: s });
    const gemRule = x.H("sp_touch", { KIND: "gem" }, [x.score(1), x.sound("ding"), x.send("star"), rm()]);
    const rockRule = x.H("sp_touch", { KIND: "rock" }, [x.livesC(-1), x.sound("boom"), fx("it", "boom"), shake(), x.send("hit"), rm(), shield(1.5)]);
    return [
      { id: "c5", name: "第五堂｜限時 60 秒", xml: x.xml([
        x.H("rl_start", {}, [x.time(60), x.lives(3), x.say("出發！收集能量水晶")]),
        x.H("rl_every", { SEC: 1 }, [spawn(1, "rock")]),
        x.H("rl_every", { SEC: 1.5 }, [spawn(1, "gem")]),
        gemRule, rockRule,
        x.H("rl_timeup", {}, [x.win("時間到！看看收集了幾顆")]),
        x.H("rl_lives0", {}, [x.lose("護盾用完了")]),
      ]) },
      { id: "c5b", name: "第五堂進階｜燃料危機", xml: x.xml([
        x.H("rl_start", {}, [x.set("燃料", x.num(100)), x.stat("燃料", x.vget("燃料")), x.lives(3), x.say("燃料會一直減少，記得接燃料罐！")]),
        x.H("rl_every", { SEC: 1 }, [x.change("燃料", -5), x.stat("燃料", x.vget("燃料")), x.ifThen(x.cmp(x.vget("燃料"), "LT", x.num(1)), [x.lose("燃料用完了")])]),
        x.H("rl_every", { SEC: 0.5 }, [x.ifThen(x.cmp(x.rand(1, 3), "EQ", x.num(1)), [spawn(1, "rock")])]),
        x.H("rl_every", { SEC: 4 }, [spawn(1, "fuel")]),
        x.H("rl_every", { SEC: 1.5 }, [spawn(1, "gem")]),
        x.H("sp_touch", { KIND: "fuel" }, [x.change("燃料", 30), x.ifThen(x.cmp(x.vget("燃料"), "GT", x.num(100)), [x.set("燃料", x.num(100))]), x.stat("燃料", x.vget("燃料")), x.sound("eat"), rm()]),
        gemRule, rockRule,
        x.H("rl_score", { N: 20 }, [x.win("收集 20 顆水晶，任務成功！")]),
        x.H("rl_lives0", {}, [x.lose("護盾用完了")]),
      ]) },
      { id: "c5c", name: "第五堂進階｜飛碟和護盾", xml: x.xml([
        x.H("rl_start", {}, [x.lives(3), x.time(90), x.say("飛碟會上下飄，撿護盾泡泡撞碎它們！")]),
        x.H("rl_every", { SEC: 2.5 }, [spawn(1, "ufo")]),
        x.H("rl_every", { SEC: 8 }, [spawn(1, "shield", "ship")]),
        x.H("rl_every", { SEC: 1 }, [spawn(1, "gem")]),
        x.H("sp_touch", { KIND: "shield" }, [shield(5), x.say("護盾 5 秒！"), x.sound("eat"), rm()]),
        x.H("sp_touch", { KIND: "ufo" }, [x.livesC(-1), x.sound("bump"), fx("ship", "flash"), shake(), shield(1.5)]),
        gemRule,
        x.H("sp_miss", { KIND: "gem" }, [x.score(-1)]),
        x.H("rl_timeup", {}, [x.win("撐過 90 秒！")]),
      ]) },
      { id: "c5d", name: "實驗｜超音波範圍", xml: x.xml([
        x.H("rl_start", {}, [B("sp_range", {}, { A: N(10), B: N(25) }), x.say("範圍改成 10～25 公分，試試看手要動多少")]),
        x.H("rl_every", { SEC: 0.5 }, [x.stat("距離", B("sp_dist")), x.stat("高度", B("sp_height"))]),
        x.H("rl_every", { SEC: 2 }, [spawn(1, "gem")]),
        gemRule,
      ]) },
    ];
  },
  onPlay() {
    L.ents = []; L.fly = 1; L.kspd = {}; L.crowd = false; DMIN = 5; DMAX = 40; S.shipSz = 1;
    Object.assign(S, { mode: "lab", running: true, score: 0, inv: 0, speed: 1, t: 0, rocks: [], gems: [], parts: [] });
    $("menu").hidden = true; $("endOv").hidden = true;
  },
  onEnd() { S.running = false; },
  onStop() { S.running = false; S.mode = null; L.ents = []; DMIN = 5; DMAX = 40; S.shipSz = 1; },
  onMenu() { $("menu").hidden = false; },
});
$("labCard").onclick = () => { $("menu").hidden = true; LAB.open(); };
if (location.hash === "#lab") { $("menu").hidden = true; LAB.open(); }
