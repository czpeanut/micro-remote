"use strict";
/* 酷丁狐飛行島 — 規則實驗室（積木規則）。需要先載入 rulelab.js 和 flight.js */
const { hat, act, val, dd, vin } = RuleLab.helpers;
const CF = "#2f6fd6";
const WHERE = [["小島上空隨機", "land"], ["高空", "high"], ["飛機前方", "ahead"], ["大山附近", "mountain"], ["海面上", "sea"]];
const LAB = RuleLab.create({
  id: "flight", title: "飛行規則實驗室",
  tip: "<b>怎麼玩</b><br>1. 「當遊戲開始」裡放出星星或圓環。<br>2. 用「當收集到星星」「當穿過圓環」加分。<br>3. 「當撞到」決定扣生命還是重新起飛。<br><b>操作</b>：micro:bit 左右傾斜轉彎、前後傾斜上下，按住 A 加油門、B 減油門；或方向鍵、W／S。<br>飛機從跑道出發，油門加到夠快會自己離地。",
  blocks: [
    hat("fl_star", "當收集到星星", [], "裡面的「它」就是那顆星星"),
    hat("fl_ring", "當穿過圓環", [], "同一個圓環 2 秒內只算一次"),
    hat("fl_place", "當發現新地點", [], "飛到機場、燈塔、火山口…這些地方附近時執行"),
    hat("fl_crash", "當撞到 %1", [dd("W", [["地面", "ground"], ["海面", "water"]])], "有這個積木時，撞到後會自動拉高重新飛"),
    act("fl_spawn", "放出 %1 個 %2 在 %3", [vin("N", "Number"), dd("KIND", [["星星", "star"], ["圓環", "ring"]]), dd("WHERE", WHERE)], CF, "一次最多 40 個"),
    act("fl_remove_it", "移除「它」", [], CF),
    act("fl_remove_all", "移除所有 %1", [dd("KIND", [["星星", "star"], ["圓環", "ring"]])], CF),
    act("fl_sky", "天空 %1", [dd("S", [["白天", "day"], ["黃昏", "sunset"], ["夜晚", "night"], ["大霧", "fog"]])], CF),
    act("fl_speed", "飛機速度 %1", [dd("V", [["普通", "1"], ["慢", "0.7"], ["快", "1.3"]])], CF),
    act("fl_boost", "加速 %1 秒", [vin("N", "Number")], CF),
    act("fl_home", "回到機場重新起飛", [], CF),
    val("fl_alt", "飛行高度", [], CF),
    val("fl_spd", "飛行速度", [], CF),
    val("fl_found", "已經發現幾個地點", [], CF),
    val("fl_count", "%1 的數量", [dd("KIND", [["星星", "star"], ["圓環", "ring"]])], CF),
  ],
  hats: ["fl_star", "fl_ring", "fl_crash", "fl_place"],
  evNames: { star: "當收集到星星", place: "當發現新地點", ring: "當穿過圓環", crash: (a) => `當撞到${a === "water" ? "海面" : "地面"}` },
  gens(F, h) {
    const { q, v, call, hatGen, O, num } = h;
    F.fl_star = hatGen("star"); F.fl_place = hatGen("place"); F.fl_found = () => ["api.found()", O.FUNCTION_CALL]; F.fl_ring = hatGen("ring"); F.fl_crash = hatGen("crash", (b) => q(b.getFieldValue("W")));
    F.fl_spawn = (b) => call("spawn", q(b.getFieldValue("KIND")), v(b, "N", "1"), q(b.getFieldValue("WHERE")));
    F.fl_remove_it = () => call("removeIt");
    F.fl_remove_all = (b) => call("removeAll", q(b.getFieldValue("KIND")));
    F.fl_sky = (b) => call("sky", q(b.getFieldValue("S")));
    F.fl_speed = (b) => call("speed", num(b.getFieldValue("V")));
    F.fl_boost = (b) => call("boost", v(b, "N", "2"));
    F.fl_home = () => call("home");
    F.fl_alt = () => ["api.alt()", O.FUNCTION_CALL];
    F.fl_spd = () => ["api.spd()", O.FUNCTION_CALL];
    F.fl_count = (b) => [`api.count(${q(b.getFieldValue("KIND"))})`, O.FUNCTION_CALL];
  },
  toolbox: ({ n, b }) => [{ name: "飛行", colour: CF, contents: [b("fl_spawn", { N: n(10) }), b("fl_remove_it"), b("fl_remove_all"), b("fl_sky"), b("fl_speed"), b("fl_boost", { N: n(2) }), b("fl_home"), b("fl_alt"), b("fl_spd"), b("fl_found"), b("fl_count")] }],
  api: {
    spawn(kind, n, where) { n = clamp(Math.round(Number(n) || 0), 0, 40); for (let i = 0; i < n; i++) { if (ITEMS.filter((x) => !x.dead).length >= 120) { LAB.toast("放不下更多了"); return; } const p = randomSpot(where);
      if (kind === "ring") addRing(p.x, p.y, p.z, S.yaw + rnd(-0.5, 0.5)).mesh.material = ringMat.next; else addStar(p.x, p.y, p.z); } },
    removeIt() { const it = this._it; if (it) removeItem(it); },
    removeAll(kind) { for (const it of ITEMS) if (it.kind === kind) removeItem(it); },
    sky(k) { setSky(k); },
    speed(v) { S.vmul = clamp(Number(v) || 1, 0.5, 1.6); },
    boost(n) { S.boost = clamp(Number(n) || 0, 0, 10); },
    home() { resetPlane(); },
    alt() { return Math.round(S.p.y); },
    found() { return PLACES.filter((q) => q.found).length; },
    spd() { return Math.round(S.speed); },
    count(kind) { return ITEMS.filter((it) => it.kind === kind && !it.dead).length; },
  },
  templates: (x) => {
    const B = x.B, N = x.N;
    const spawn = (n, k, w) => B("fl_spawn", { KIND: k, WHERE: w || "land" }, { N: N(n) });
    const rm = () => B("fl_remove_it"), sky = (s) => B("fl_sky", { S: s });
    return [
      { id: "c5", name: "第五堂｜限時收集星星", xml: x.xml([
        x.H("rl_start", {}, [spawn(30, "star"), spawn(8, "star", "high"), x.time(60), x.say("60 秒收集最多星星！")]),
        x.H("fl_star", {}, [x.score(1), x.sound("ding"), x.send("star"), rm(), spawn(1, "star")]),
        x.H("fl_crash", { W: "ground" }, [x.send("crash"), x.say("撞到了！小心地面")]),
        x.H("fl_crash", { W: "water" }, [x.send("crash"), x.say("掉進海裡了！")]),
        x.H("rl_timeup", {}, [x.send("end"), x.win("時間到！")]),
      ]) },
      { id: "c5b", name: "第五堂進階｜三條命", xml: x.xml([
        x.H("rl_start", {}, [x.lives(3), spawn(25, "star"), x.say("撞到地面或海面會扣一條命")]),
        x.H("fl_star", {}, [x.score(1), x.send("star"), rm()]),
        x.H("fl_crash", { W: "ground" }, [x.livesC(-1), x.send("crash")]),
        x.H("fl_crash", { W: "water" }, [x.livesC(-1), x.send("crash")]),
        x.H("rl_score", { N: 20 }, [x.win("收集 20 顆星星！")]),
        x.H("rl_lives0", {}, [x.lose("飛機壞掉了")]),
      ]) },
      { id: "c5c", name: "第五堂進階｜夜間圓環", xml: x.xml([
        x.H("rl_start", {}, [sky("night"), spawn(1, "ring", "ahead"), x.time(90), x.say("夜間飛行！穿過圓環會出現下一個")]),
        x.H("fl_ring", {}, [x.score(1), x.sound("win"), x.send("ring"), rm(), spawn(1, "ring", "ahead"), B("fl_boost", {}, { N: N(1) })]),
        x.H("rl_timeup", {}, [x.win("夜間飛行結束！")]),
      ]) },
      { id: "c5e", name: "第五堂進階｜群島探險", xml: x.xml([
        x.H("rl_start", {}, [x.say("五座島上有 12 個地點，全部找到吧！"), x.stat("地點", B("fl_found"))]),
        x.H("fl_place", {}, [x.score(1), x.sound("win"), x.send("star"), x.stat("地點", B("fl_found")), x.ifThen(x.cmp(B("fl_found"), "GTE", x.num(12)), [x.win("全部的地點都找到了！")])]),
        x.H("fl_crash", { W: "ground" }, [x.send("crash")]),
        x.H("fl_crash", { W: "water" }, [x.send("crash")]),
      ]) },
      { id: "c5d", name: "實驗｜高度計", xml: x.xml([
        x.H("rl_start", {}, [x.set("最高", x.num(0)), x.say("飛得越高越好！看看最高可以到幾公尺")]),
        x.H("rl_every", { SEC: 0.5 }, [x.stat("高度", B("fl_alt")), x.ifThen(x.cmp(B("fl_alt"), "GT", x.vget("最高")), [x.set("最高", B("fl_alt")), x.stat("最高", x.vget("最高"))])]),
      ]) },
    ];
  },
  onPlay() { start("lab"); for (const pl of PLACES) pl.found = false; },
  onEnd() { S.running = false; },
  onStop() { S.running = false; S.mode = null; clearItems(); setSky("day"); },
  onMenu() { $("menu").hidden = false; },
});
$("labCard").onclick = () => { $("menu").hidden = true; LAB.open(); };
(function hookTick() { let last = performance.now(); (function t(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (S.mode === "lab" && S.running) LAB.tick(dt); requestAnimationFrame(t); })(last); })();
if (location.hash === "#lab") { $("menu").hidden = true; LAB.open(); }
