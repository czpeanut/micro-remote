"use strict";
/* 旋鈕賽車 — 規則實驗室（積木規則）。需要先載入 rulelab.js 和 race.js */
const { hat, act, val, dd, vin } = RuleLab.helpers;
const CR = "#d8352a";
const RC_KINDS = [["金幣", "coin"], ["香蕉皮", "banana"], ["道具箱", "box"], ["加速板", "pad"], ["油桶", "barrel"]];
const RC_NAME = Object.fromEntries(RC_KINDS.map(([a, b]) => [b, a]));
function labPlace(kind, n, where) {
  if (!RC_NAME[kind] || !PTS.length) return; n = clamp(Math.round(Number(n) || 0), 0, 30);
  const c = S.car, ci = c ? nearest(c.x, c.y).i : 0;
  for (let i = 0; i < n; i++) {
    if (S.items.length >= 120) { LAB.toast("賽道上放不下更多了"); return; }
    let k;
    if (where === "ahead") k = (ci + 25 + i * 12 + Math.floor(rnd(0, 10))) % PTS.length;
    else if (where === "line") k = (ci + 40 + i * 4) % PTS.length;
    else { do { k = Math.floor(rnd(0, PTS.length)); } while (k < 20 || k > PTS.length - 10); }
    const a = PTS[k], b = PTS[(k + 1) % PTS.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const off = where === "line" ? 0 : rnd(-ROAD * 0.32, ROAD * 0.32);
    S.items.push({ kind, x: a[0] - dy / L * off, y: a[1] + dx / L * off, ang: Math.atan2(dy, dx), ph: rnd(0, 6), dead: false });
  }
}
function labDrawItem(o, x, y, s) {
  const t = S.t + (o.ph || 0);
  if (o.kind === "coin") { const w = 7 * s * Math.abs(Math.cos(t * 3)) + s; g.fillStyle = "#f5c547"; g.strokeStyle = "#a8741a"; g.lineWidth = Math.max(1, s * 0.8); g.beginPath(); g.ellipse(x, y - 10 * s, w, 7 * s, 0, 0, 7); g.fill(); g.stroke(); }
  else if (o.kind === "banana") { g.fillStyle = "#ffd93b"; g.strokeStyle = "#7a5a10"; g.lineWidth = Math.max(1, s * 0.6); g.beginPath(); g.arc(x, y - 6 * s, 7 * s, 0.2, Math.PI - 0.2); g.lineTo(x - 3 * s, y - 4 * s); g.arc(x, y - 9 * s, 5 * s, Math.PI - 0.4, 0.4, true); g.closePath(); g.fill(); g.stroke(); }
  else if (o.kind === "box") { const r = 8 * s, yy = y - 12 * s + Math.sin(t * 3) * 2 * s; const hue = (t * 120) % 360; g.fillStyle = `hsla(${hue},80%,60%,.85)`; g.strokeStyle = "#fff"; g.lineWidth = Math.max(1, s * 0.7);
    g.save(); g.translate(x, yy); g.rotate(Math.sin(t) * 0.3); g.fillRect(-r, -r, 2 * r, 2 * r); g.strokeRect(-r, -r, 2 * r, 2 * r); g.fillStyle = "#fff"; g.font = `900 ${Math.max(6, 11 * s)}px sans-serif`; g.textAlign = "center"; g.fillText("?", 0, 4 * s); g.restore(); }
  else if (o.kind === "pad") { g.fillStyle = "#5fe1ff"; g.strokeStyle = "#1a6b8a"; g.lineWidth = Math.max(1, s * 0.6); for (let i = 0; i < 2; i++) { const yy = y - (2 + i * 5) * s; g.beginPath(); g.moveTo(x - 10 * s, yy); g.lineTo(x, yy - 5 * s); g.lineTo(x + 10 * s, yy); g.lineTo(x + 10 * s, yy + 2 * s); g.lineTo(x, yy - 3 * s); g.lineTo(x - 10 * s, yy + 2 * s); g.closePath(); g.fill(); g.stroke(); } }
  else if (o.kind === "barrel") { g.fillStyle = "#c4521a"; g.strokeStyle = "#5a2a0a"; g.lineWidth = Math.max(1, s * 0.6); g.fillRect(x - 6 * s, y - 16 * s, 12 * s, 16 * s); g.strokeRect(x - 6 * s, y - 16 * s, 12 * s, 16 * s); g.fillStyle = "#2b1d14"; g.fillRect(x - 6 * s, y - 11 * s, 12 * s, 1.5 * s); g.fillRect(x - 6 * s, y - 5 * s, 12 * s, 1.5 * s); }
}
const LAB = RuleLab.create({
  id: "race", title: "賽車規則實驗室",
  tip: "<b>怎麼玩</b><br>1. 「當遊戲開始」裡在賽道放金幣或香蕉皮。<br>2. 用「當碰到」決定加分、加速或打滑。<br>3. 用「當跑完一圈」決定幾圈結束。<br><b>操作</b>：旋鈕轉方向，A 油門、B 煞車、C 氮氣，D、E 自己設定；或方向鍵、空白鍵、D、E。",
  blocks: [
    hat("rc_go", "當比賽出發", [], "倒數 3、2、1 結束時執行"),
    hat("rc_lap", "當跑完一圈", [], "每跑完一圈執行；用「上一圈時間」看成績"),
    hat("rc_item", "當車子碰到 %1", [dd("KIND", RC_KINDS)], "裡面的「它」就是碰到的那一個"),
    hat("rc_off", "當開出跑道", [], "車子從跑道開到草地上時執行"),
    hat("rc_key", "當按下 %1 鍵", [dd("K", [["D", "d"], ["E", "e"]])], "五鍵按鍵的 D 或 E（鍵盤也可以按 D、E）"),
    act("rc_place", "在賽道放 %1 個 %2 在 %3", [vin("N", "Number"), dd("KIND", RC_KINDS), dd("WHERE", [["隨機位置", "random"], ["車子前面", "ahead"], ["前面排成一排", "line"]])], CR, "一次最多 30 個"),
    act("rc_remove_it", "移除「它」", [], CR, "放在「當車子碰到」裡面"),
    act("rc_remove_all", "移除所有 %1", [dd("KIND", RC_KINDS)], CR),
    act("rc_boost", "加速 %1 秒", [vin("N", "Number")], CR),
    act("rc_nitro", "氮氣增加 %1", [vin("N", "Number")], CR, "C 鍵可以用的次數"),
    act("rc_spin", "車子打滑", [], CR, "原地轉一圈，速度變慢"),
    act("rc_stop", "車子停下來", [], CR),
    act("rc_vmax", "極速 %1", [dd("V", [["普通", "1"], ["慢", "0.7"], ["快", "1.25"], ["超快", "1.5"]])], CR),
    act("rc_steer", "方向盤 %1", [dd("V", [["普通", "1"], ["靈敏", "1.5"], ["遲鈍", "0.6"], ["相反", "-1"]])], CR, "旋鈕轉一點點，車子轉多少"),
    act("rc_track", "賽道 %1", [dd("T", [["小島環道", "0"], ["森林 S 彎", "1"], ["狐狸之心", "2"]])], CR, "放在「當遊戲開始」裡面"),
    act("rc_ghost", "幽靈車 %1", [dd("ON", [["開", "1"], ["關", "0"]])], CR, "跟最快一圈的紀錄比賽（放在「當遊戲開始」裡面）"),
    val("rc_laps", "跑完幾圈", [], CR),
    val("rc_lastlap", "上一圈時間（秒）", [], CR),
    val("rc_laptime", "這一圈時間（秒）", [], CR),
    val("rc_best", "最快一圈（秒）", [], CR),
    val("rc_speed", "車速", [], CR),
    val("rc_knob", "旋鈕", [], CR),
    val("rc_count", "%1 的數量", [dd("KIND", RC_KINDS)], CR),
  ],
  hats: ["rc_go", "rc_lap", "rc_item", "rc_off", "rc_key"],
  evNames: { go: "當比賽出發", lap: "當跑完一圈", item: (a) => `當車子碰到${RC_NAME[a] || ""}`, off: "當開出跑道", key: (a) => `當按下 ${String(a).toUpperCase()} 鍵` },
  gens(F, h) {
    const { q, v, call, hatGen, O, num } = h;
    F.rc_go = hatGen("go"); F.rc_lap = hatGen("lap"); F.rc_off = hatGen("off");
    F.rc_item = hatGen("item", (b) => q(b.getFieldValue("KIND")));
    F.rc_key = hatGen("key", (b) => q(b.getFieldValue("K")));
    F.rc_place = (b) => call("place", q(b.getFieldValue("KIND")), v(b, "N", "1"), q(b.getFieldValue("WHERE")));
    F.rc_remove_it = () => call("removeIt");
    F.rc_remove_all = (b) => call("removeAll", q(b.getFieldValue("KIND")));
    F.rc_boost = (b) => call("boost", v(b, "N", "1"));
    F.rc_nitro = (b) => call("nitro", v(b, "N", "1"));
    F.rc_spin = () => call("spin");
    F.rc_stop = () => call("stop");
    F.rc_vmax = (b) => call("vmax", num(b.getFieldValue("V")));
    F.rc_steer = (b) => call("steer", num(b.getFieldValue("V")));
    F.rc_track = (b) => call("track", num(b.getFieldValue("T")));
    F.rc_ghost = (b) => call("ghost", num(b.getFieldValue("ON")));
    for (const [t, f] of [["rc_laps", "laps"], ["rc_lastlap", "lastLap"], ["rc_laptime", "lapTime"], ["rc_best", "best"], ["rc_speed", "speed"], ["rc_knob", "knob"]]) F[t] = () => [`api.${f}()`, O.FUNCTION_CALL];
    F.rc_count = (b) => [`api.count(${q(b.getFieldValue("KIND"))})`, O.FUNCTION_CALL];
  },
  toolbox: ({ n, b }) => [{ name: "賽車", colour: CR, contents: [
    b("rc_place", { N: n(5) }), b("rc_remove_it"), b("rc_remove_all"), b("rc_boost", { N: n(1) }), b("rc_nitro", { N: n(1) }), b("rc_spin"), b("rc_stop"),
    b("rc_vmax"), b("rc_steer"), b("rc_track"), b("rc_ghost"), b("rc_laps"), b("rc_lastlap"), b("rc_laptime"), b("rc_best"), b("rc_speed"), b("rc_knob"), b("rc_count")] }],
  api: {
    place: labPlace,
    removeIt() { const it = this._it; if (it) it.dead = true; },
    removeAll(kind) { for (const it of S.items) if (it.kind === kind) it.dead = true; },
    boost(sec) { S.boost = clamp(Number(sec) || 0, 0, 10); SFX.noise(0.6, 0.2, 900); },
    nitro(n) { S.nitro = clamp(S.nitro + Math.round(Number(n) || 0), 0, 9); hudNitro(); },
    spin() { S.spin = 0.7; SFX.tone(700, 200, 0.5, "sawtooth", 0.08); },
    stop() { if (S.car) S.car.v = 0; },
    vmax(v) { S.vmax = clamp(Number(v) || 1, 0.4, 1.8); },
    steer(v) { S.steerK = clamp(Number(v) || 1, -1.5, 2); },
    track(i) {
      i = clamp(Math.round(Number(i) || 0), 0, TRACKS.length - 1); if (i === S.track && PTS.length) return;
      S.track = i; buildTrack(i); buildTexture(); camInit = false; S.items = [];
      const p = PTS[0], q = PTS[3]; S.car = { x: p[0], y: p[1], a: Math.atan2(q[1] - p[1], q[0] - p[0]), v: 0 };
      const b = loadBest(); S.best = b ? b.time : null; S.ghost = S.labGhost && b ? b.rec : null; hud();
    },
    ghost(on) { S.labGhost = !!Number(on); const b = loadBest(); S.ghost = S.labGhost && b ? b.rec : null; S.ghostT = 0; if (S.labGhost && !b) LAB.toast("還沒有紀錄，先跑一圈"); },
    laps() { return S.lap; },
    lastLap() { return S.lastLap; },
    lapTime() { return Math.round(S.lapT * 10) / 10; },
    best() { return S.best ? Math.round(S.best * 100) / 100 : 0; },
    speed() { return S.car ? Math.round(Math.max(0, S.car.v) / 3) : 0; },
    knob() { return Math.round(S.knob); },
    count(kind) { return S.items.reduce((n, it) => n + (it.kind === kind && !it.dead ? 1 : 0), 0); },
  },
  templates: (x) => {
    const B = x.B, N = x.N;
    const place = (n, k, w) => B("rc_place", { KIND: k, WHERE: w || "random" }, { N: N(n) });
    const rm = () => B("rc_remove_it");
    return [
      { id: "c7", name: "第七堂｜三圈計時賽", xml: x.xml([
        x.H("rl_start", {}, [x.say("跑完三圈！")]),
        x.H("rc_go", {}, [x.send("go")]),
        x.H("rc_lap", {}, [x.send("lap"), x.stat("圈數", B("rc_laps")), x.stat("上一圈", B("rc_lastlap")),
          x.ifThen(x.cmp(B("rc_laps"), "GTE", x.num(3)), [x.send("end"), x.win("完賽！")])]),
      ]) },
      { id: "c7b", name: "第七堂進階｜金幣大作戰", xml: x.xml([
        x.H("rl_start", {}, [place(25, "coin"), place(6, "banana"), x.time(60), x.say("60 秒撿最多金幣，小心香蕉皮！")]),
        x.H("rc_item", { KIND: "coin" }, [x.score(1), x.sound("ding"), rm()]),
        x.H("rc_item", { KIND: "banana" }, [B("rc_spin"), x.score(-2), x.sound("bump"), rm()]),
        x.H("rl_every", { SEC: 5 }, [x.ifThen(x.cmp(B("rc_count", { KIND: "coin" }), "LT", x.num(10)), [place(8, "coin", "ahead")])]),
      ]) },
      { id: "c7c", name: "第七堂進階｜加速板和道具箱", xml: x.xml([
        x.H("rl_start", {}, [B("rc_track", { T: "1" }), place(8, "pad"), place(6, "box"), x.say("踩加速板！撿道具箱拿氮氣")]),
        x.H("rc_item", { KIND: "pad" }, [B("rc_boost", {}, { N: N(1) }), x.sound("eat")]),
        x.H("rc_item", { KIND: "box" }, [B("rc_nitro", {}, { N: N(1) }), x.say("氮氣 +1"), rm()]),
        x.H("rc_lap", {}, [x.stat("圈數", B("rc_laps")), place(4, "box"), x.ifThen(x.cmp(B("rc_laps"), "GTE", x.num(3)), [x.win("完賽！")])]),
      ]) },
      { id: "c7d", name: "第七堂進階｜不要開出跑道", xml: x.xml([
        x.H("rl_start", {}, [x.lives(3), B("rc_vmax", { V: "1.25" }), x.say("極速變快了！開出跑道會扣生命")]),
        x.H("rc_off", {}, [x.livesC(-1), x.sound("bump"), x.send("miss")]),
        x.H("rc_key", { K: "d" }, [B("rc_steer", { V: "1.5" }), x.say("方向盤變靈敏")]),
        x.H("rc_key", { K: "e" }, [B("rc_steer", { V: "1" }), x.say("方向盤恢復普通")]),
        x.H("rc_lap", {}, [x.score(1), x.ifThen(x.cmp(B("rc_laps"), "GTE", x.num(2)), [x.win("兩圈都沒出局！")])]),
        x.H("rl_lives0", {}, [x.lose("開出跑道太多次了")]),
      ]) },
    ];
  },
  onPlay() {
    Object.assign(S, { lab: true, vmax: 1, steerK: 1, spin: 0, items: [], wasOff: false, lastLap: 0, labGhost: false });
    start("lab");
  },
  onEnd() { S.running = false; },
  onStop() { S.running = false; S.lab = false; S.items = []; S.vmax = 1; S.steerK = 1; S.spin = 0; S.ghost = null; },
  onMenu() { $("menu").hidden = false; },
});
$("labCard").onclick = () => { $("menu").hidden = true; LAB.open(); };
(function hookTick() { let last = performance.now(); (function t(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (S.lab && S.running && S.count <= 0) LAB.tick(dt); requestAnimationFrame(t); })(last); })();
if (location.hash === "#lab") { $("menu").hidden = true; LAB.open(); }
