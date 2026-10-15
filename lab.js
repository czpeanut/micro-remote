"use strict";
/*
 * 深海規則實驗室 — 用積木寫規則，再用 micro:bit 開潛艇
 *  micro:bit → 電腦：x:數字、y:數字（藍牙串口 寫入值）、p#（按鈕 A）、其他文字#（訊息）
 *  電腦 → micro:bit：0#～4#（雷達強度）、g# 等自訂訊息、e#（遊戲結束）
 */
const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const WW = 4200, VIEW_H = 900, SURFACE = 60, MAXE = 160;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
const fmt = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v));

/* =====================================================================
 * 1. 積木
 * ===================================================================== */
const C = { ev: "#8a5cf6", bio: "#1fa4c9", game: "#e5624e", sub: "#e09a12", sea: "#3866d6", fx: "#2fa66a" };
const KINDS = [["小魚", "fish"], ["水母", "jelly"], ["鯊魚", "shark"], ["珍珠", "pearl"], ["寶箱", "treasure"], ["水雷", "mine"], ["氧氣泡", "oxygen"]];
const KIND_NAME = Object.fromEntries(KINDS.map(([a, b]) => [b, a]));
const WHERE = [["隨機位置", "random"], ["海底", "floor"], ["潛艇附近", "near"], ["水面附近", "surface"], ["遠處", "far"]];
const hat = (type, msg, args, tip) => ({ type, message0: msg + " %" + (args.length + 1) + " %" + (args.length + 2),
  args0: [...args, { type: "input_dummy" }, { type: "input_statement", name: "DO" }], colour: C.ev, tooltip: tip });
const act = (type, msg, args, colour, tip) => ({ type, message0: msg, args0: args, previousStatement: null, nextStatement: null, inputsInline: true, colour, tooltip: tip || "" });
const val = (type, msg, args, colour, tip) => ({ type, message0: msg, args0: args, output: "Number", colour, tooltip: tip || "" });
const dd = (name, options) => ({ type: "field_dropdown", name, options });
const vin = (name, check) => ({ type: "input_value", name, check });

const BLOCKS = [
  hat("ocean_start", "當遊戲開始", [], "按下「開始遊戲」時執行一次"),
  hat("ocean_every", "每隔 %1 秒", [{ type: "field_number", name: "SEC", value: 3, min: 0.5, max: 600, precision: 0.5 }], "遊戲進行中，每隔幾秒執行一次（最少 0.5 秒）"),
  hat("ocean_touch", "當潛艇碰到 %1", [dd("KIND", KINDS)], "潛艇碰到這種東西時執行；裡面的「它」就是碰到的那一個"),
  hat("ocean_bump", "當潛艇撞到岩石", [], "潛艇用力撞到岩石或海底時執行"),
  hat("ocean_score", "當分數達到 %1", [{ type: "field_number", name: "N", value: 10 }], "分數第一次到達這個數字時執行"),
  hat("ocean_timeup", "當倒數時間到", [], "倒數計時歸零時執行；沒有這個積木時，時間到就結束遊戲"),
  hat("ocean_lives0", "當生命用完", [], "生命變成 0 時執行；沒有這個積木時，就直接遊戲失敗"),
  hat("ocean_button", "當按下按鈕 A", [], "micro:bit 傳來 p#，或按鍵盤空白鍵"),
  hat("ocean_msg", "當收到 micro:bit 訊息 %1", [{ type: "field_input", name: "TEXT", text: "a" }], "micro:bit 用藍牙傳來這個文字（加 #）時執行"),

  act("ocean_spawn", "放出 %1 隻 %2 在 %3", [vin("N", "Number"), dd("KIND", KINDS), dd("WHERE", WHERE)], C.bio, "一次最多 30 隻，整片海最多 160 個"),
  act("ocean_remove_it", "移除「它」", [], C.bio, "只能放在「當潛艇碰到」裡面：移除碰到的那一個"),
  act("ocean_remove_all", "移除所有 %1", [dd("KIND", KINDS)], C.bio),
  act("ocean_kind_speed", "%1 的速度設為 %2", [dd("KIND", KINDS), dd("SPD", [["普通", "1"], ["慢", "0.5"], ["快", "1.7"], ["超快", "2.5"], ["停住", "0"]])], C.bio),
  val("ocean_count", "%1 的數量", [dd("KIND", KINDS)], C.bio),
  val("ocean_dist", "潛艇到最近 %1 的距離", [dd("KIND", KINDS)], C.bio, "單位是公尺；海裡沒有這種東西時是 999"),

  act("ocean_score_change", "分數改變 %1", [vin("N", "Number")], C.game),
  act("ocean_score_set", "分數設為 %1", [vin("N", "Number")], C.game),
  val("ocean_score_get", "分數", [], C.game),
  act("ocean_time_set", "倒數計時 %1 秒", [vin("N", "Number")], C.game, "開始倒數，畫面上會出現時間"),
  act("ocean_time_add", "時間增加 %1 秒", [vin("N", "Number")], C.game),
  val("ocean_time_get", "剩下的時間", [], C.game),
  act("ocean_lives_set", "生命設為 %1", [vin("N", "Number")], C.game, "畫面上會出現生命"),
  act("ocean_lives_change", "生命改變 %1", [vin("N", "Number")], C.game),
  val("ocean_lives_get", "生命", [], C.game),
  act("ocean_stat", "在畫面顯示 %1 %2", [{ type: "field_input", name: "LABEL", text: "氧氣" }, vin("V")], C.game, "在上方多一個數字框（最多 4 個）"),
  act("ocean_win", "任務成功 顯示 %1", [vin("T")], C.game),
  act("ocean_lose", "任務失敗 顯示 %1", [vin("T")], C.game),

  act("ocean_sub_speed", "潛艇馬力 %1", [dd("SPD", [["普通", "1"], ["慢", "0.6"], ["快", "1.4"], ["超快", "1.9"]])], C.sub),
  act("ocean_sub_size", "潛艇大小 %1", [dd("SZ", [["普通", "1"], ["小", "0.7"], ["大", "1.35"]])], C.sub),
  act("ocean_sub_home", "潛艇回到起點", [], C.sub),
  act("ocean_shake", "畫面震動", [], C.sub),
  val("ocean_depth_get", "潛艇深度", [], C.sub, "單位是公尺"),

  act("ocean_current", "海流往 %1 強度 %2", [dd("DIR", [["右", "right"], ["左", "left"], ["上", "up"], ["下", "down"], ["停止", "none"]]), dd("STR", [["中", "90"], ["弱", "40"], ["強", "160"]])], C.sea, "海流會推動潛艇和小生物"),
  act("ocean_light", "海底亮度 %1", [dd("L", [["自動（越深越暗）", "auto"], ["明亮", "bright"], ["昏暗", "dim"], ["漆黑", "dark"]])], C.sea),
  act("ocean_sonar", "發射聲納", [], C.sea, "聲波會短暫照亮寶箱和水雷"),
  act("ocean_radar", "雷達 %1", [dd("ON", [["開啟", "on"], ["關閉", "off"]])], C.sea, "開啟後，把最近寶箱的距離 0～4 傳給 micro:bit"),

  act("ocean_say", "說 %1", [vin("T")], C.fx),
  act("ocean_sound", "播放音效 %1", [dd("S", [["叮", "ding"], ["吃到", "eat"], ["嗶", "beep"], ["聲納", "sonar"], ["撞擊", "bump"], ["爆炸", "boom"], ["勝利", "win"], ["失敗", "lose"]])], C.fx),
  act("ocean_fx", "在 %1 產生 %2", [dd("AT", [["「它」的位置", "it"], ["潛艇的位置", "sub"]]), dd("FX", [["閃光", "flash"], ["爆炸", "boom"], ["泡泡", "bubbles"]])], C.fx),
  act("ocean_send", "傳送給 micro:bit %1", [vin("T")], C.fx, "會自動在後面加 #"),
];

const TOOLBOX = (() => {
  const n = (v) => ({ shadow: { type: "math_number", fields: { NUM: v } } });
  const t = (s) => ({ shadow: { type: "text", fields: { TEXT: s } } });
  const b = (type, inputs) => (inputs ? { kind: "block", type, inputs } : { kind: "block", type });
  const cat = (name, colour, contents) => ({ kind: "category", name, colour, contents });
  return { kind: "categoryToolbox", contents: [
    cat("事件", C.ev, ["ocean_start", "ocean_every", "ocean_touch", "ocean_bump", "ocean_score", "ocean_timeup", "ocean_lives0", "ocean_button", "ocean_msg"].map((x) => b(x))),
    cat("海洋生物", C.bio, [b("ocean_spawn", { N: n(3) }), b("ocean_remove_it"), b("ocean_remove_all"), b("ocean_kind_speed"), b("ocean_count"), b("ocean_dist")]),
    cat("遊戲", C.game, [b("ocean_score_change", { N: n(1) }), b("ocean_score_set", { N: n(0) }), b("ocean_score_get"), b("ocean_time_set", { N: n(60) }), b("ocean_time_add", { N: n(10) }), b("ocean_time_get"),
      b("ocean_lives_set", { N: n(3) }), b("ocean_lives_change", { N: n(-1) }), b("ocean_lives_get"), b("ocean_stat", { V: n(100) }), b("ocean_win", { T: t("任務成功！") }), b("ocean_lose", { T: t("再試一次！") })]),
    cat("潛艇", C.sub, [b("ocean_sub_speed"), b("ocean_sub_size"), b("ocean_sub_home"), b("ocean_shake"), b("ocean_depth_get")]),
    cat("海洋", C.sea, [b("ocean_current"), b("ocean_light"), b("ocean_sonar"), b("ocean_radar")]),
    cat("效果", C.fx, [b("ocean_say", { T: t("出發！") }), b("ocean_sound"), b("ocean_fx"), b("ocean_send", { T: t("g") })]),
    { kind: "sep" },
    cat("邏輯", "#5b80a5", [b("controls_if"), { kind: "block", type: "controls_if", extraState: { hasElse: true } }, b("logic_compare", { B: n(0) }), b("logic_operation"), b("logic_negate"), b("logic_boolean")]),
    cat("迴圈", "#5ba55b", [b("controls_repeat_ext", { TIMES: n(3) })]),
    cat("數學", "#5b67a5", [b("math_number"), b("math_arithmetic", { A: n(1), B: n(1) }), b("math_random_int", { FROM: n(1), TO: n(10) }), b("math_round")]),
    cat("文字", "#5ba58c", [b("text"), b("text_join")]),
    { kind: "category", name: "變數", colour: "#a55b80", custom: "VARIABLE" },
  ] };
})();

function defineGenerators(G, O) {
  const F = G.forBlock;
  const v = (b, name, def) => G.valueToCode(b, name, O.NONE) || def;
  const q = (s) => JSON.stringify(String(s));
  const hatGen = (ev, argFn) => (b) => `api.on(${q(ev)}, ${argFn ? argFn(b) : "null"}, function () {\n${G.statementToCode(b, "DO")}});\n`;
  F.ocean_start = hatGen("start");
  F.ocean_every = hatGen("every", (b) => num(b.getFieldValue("SEC")));
  F.ocean_touch = hatGen("touch", (b) => q(b.getFieldValue("KIND")));
  F.ocean_bump = hatGen("bump");
  F.ocean_score = hatGen("score", (b) => num(b.getFieldValue("N")));
  F.ocean_timeup = hatGen("timeup");
  F.ocean_lives0 = hatGen("lives0");
  F.ocean_button = hatGen("button");
  F.ocean_msg = hatGen("msg", (b) => q(b.getFieldValue("TEXT")));
  const call = (fn, ...args) => `api.${fn}(${args.join(", ")});\n`;
  F.ocean_spawn = (b) => call("spawn", q(b.getFieldValue("KIND")), v(b, "N", "1"), q(b.getFieldValue("WHERE")));
  F.ocean_remove_it = () => call("removeIt");
  F.ocean_remove_all = (b) => call("removeAll", q(b.getFieldValue("KIND")));
  F.ocean_kind_speed = (b) => call("kindSpeed", q(b.getFieldValue("KIND")), num(b.getFieldValue("SPD")));
  F.ocean_count = (b) => [`api.count(${q(b.getFieldValue("KIND"))})`, O.FUNCTION_CALL];
  F.ocean_dist = (b) => [`api.dist(${q(b.getFieldValue("KIND"))})`, O.FUNCTION_CALL];
  F.ocean_score_change = (b) => call("addScore", v(b, "N", "1"));
  F.ocean_score_set = (b) => call("setScore", v(b, "N", "0"));
  F.ocean_score_get = () => ["api.getScore()", O.FUNCTION_CALL];
  F.ocean_time_set = (b) => call("setTime", v(b, "N", "60"));
  F.ocean_time_add = (b) => call("addTime", v(b, "N", "10"));
  F.ocean_time_get = () => ["api.getTime()", O.FUNCTION_CALL];
  F.ocean_lives_set = (b) => call("setLives", v(b, "N", "3"));
  F.ocean_lives_change = (b) => call("addLives", v(b, "N", "-1"));
  F.ocean_lives_get = () => ["api.getLives()", O.FUNCTION_CALL];
  F.ocean_stat = (b) => call("stat", q(b.getFieldValue("LABEL")), v(b, "V", "0"));
  F.ocean_win = (b) => call("win", v(b, "T", "''"));
  F.ocean_lose = (b) => call("lose", v(b, "T", "''"));
  F.ocean_sub_speed = (b) => call("subSpeed", num(b.getFieldValue("SPD")));
  F.ocean_sub_size = (b) => call("subSize", num(b.getFieldValue("SZ")));
  F.ocean_sub_home = () => call("subHome");
  F.ocean_shake = () => call("shake");
  F.ocean_depth_get = () => ["api.depth()", O.FUNCTION_CALL];
  F.ocean_current = (b) => call("current", q(b.getFieldValue("DIR")), num(b.getFieldValue("STR")));
  F.ocean_light = (b) => call("light", q(b.getFieldValue("L")));
  F.ocean_sonar = () => call("sonar");
  F.ocean_radar = (b) => call("radar", b.getFieldValue("ON") === "on" ? "true" : "false");
  F.ocean_say = (b) => call("say", v(b, "T", "''"));
  F.ocean_sound = (b) => call("sound", q(b.getFieldValue("S")));
  F.ocean_fx = (b) => call("fx", q(b.getFieldValue("AT")), q(b.getFieldValue("FX")));
  F.ocean_send = (b) => call("send", v(b, "T", "''"));
  G.INFINITE_LOOP_TRAP = 'if (--api._loop < 0) throw new Error("LOOP");\n';
}
const HATS = new Set(["ocean_start", "ocean_every", "ocean_touch", "ocean_bump", "ocean_score", "ocean_timeup", "ocean_lives0", "ocean_button", "ocean_msg"]);

/* =====================================================================
 * 2. 範例規則（第六、七、八堂）
 * ===================================================================== */
const X = (() => {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const seq = (list) => list.filter(Boolean).reduceRight((acc, b) => (acc ? b.replace(/<\/block>$/, `<next>${acc}</next></block>`) : b), "");
  const B = (type, fields = {}, values = {}, stmts = {}, extra = "") =>
    `<block type="${type}">${extra}` +
    Object.entries(fields).map(([k, x]) => `<field name="${k}">${esc(x)}</field>`).join("") +
    Object.entries(values).map(([k, x]) => `<value name="${k}">${x}</value>`).join("") +
    Object.entries(stmts).map(([k, x]) => `<statement name="${k}">${seq(x)}</statement>`).join("") + `</block>`;
  const N = (v) => `<shadow type="math_number"><field name="NUM">${v}</field></shadow>`;
  const T = (s) => `<shadow type="text"><field name="TEXT">${esc(s)}</field></shadow>`;
  const H = (type, fields, body) => ({ type, fields, body });
  const xml = (hats) => {
    let y = 20, x = 20, col = 0;
    const parts = hats.map((h, i) => {
      const s = B(h.type, h.fields || {}, {}, { DO: h.body }).replace(`<block type="${h.type}">`, `<block type="${h.type}" x="${x + col * 470}" y="${y}">`);
      y += 70 + h.body.length * 46 + (JSON.stringify(h.body).match(/controls_if/g) || []).length * 40;
      if (i === Math.ceil(hats.length / 2) - 1) { col = 1; y = 20; }
      return s;
    });
    return `<xml xmlns="https://developers.google.com/blockly/xml">${parts.join("")}</xml>`;
  };
  const vget = (name) => B("variables_get", { VAR: name });
  const cmp = (a, op, b) => B("logic_compare", { OP: op }, { A: a, B: b });
  return {
    seq, B, N, T, H, xml, vget, cmp,
    spawn: (n, kind, where) => B("ocean_spawn", { KIND: kind, WHERE: where }, { N: N(n) }),
    score: (n) => B("ocean_score_change", {}, { N: N(n) }),
    say: (s) => B("ocean_say", {}, { T: T(s) }),
    sound: (s) => B("ocean_sound", { S: s }),
    send: (s) => B("ocean_send", {}, { T: T(s) }),
    time: (n) => B("ocean_time_set", {}, { N: N(n) }),
    lives: (n) => B("ocean_lives_set", {}, { N: N(n) }),
    livesC: (n) => B("ocean_lives_change", {}, { N: N(n) }),
    win: (s) => B("ocean_win", {}, { T: T(s) }),
    lose: (s) => B("ocean_lose", {}, { T: T(s) }),
    light: (l) => B("ocean_light", { L: l }),
    rm: () => B("ocean_remove_it"),
    shake: () => B("ocean_shake"),
    home: () => B("ocean_sub_home"),
    fx: (at, f) => B("ocean_fx", { AT: at, FX: f }),
    radar: (on) => B("ocean_radar", { ON: on ? "on" : "off" }),
    sonar: () => B("ocean_sonar"),
    speed: (k, s) => B("ocean_kind_speed", { KIND: k, SPD: s }),
    set: (name, value) => B("variables_set", { VAR: name }, { VALUE: value }),
    change: (name, n) => B("math_change", { VAR: name }, { DELTA: N(n) }),
    stat: (label, value) => B("ocean_stat", { LABEL: label }, { V: value }),
    ifThen: (cond, then, els) => B("controls_if", {}, { IF0: cond }, els ? { DO0: then, ELSE: els } : { DO0: then }, els ? '<mutation else="1"></mutation>' : ""),
    num: (n) => B("math_number", { NUM: n }),
    count: (k) => B("ocean_count", { KIND: k }),
    dist: (k) => B("ocean_dist", { KIND: k }),
  };
})();

const TEMPLATES = (() => {
  const { H, xml } = X, x = X;
  const sonarRule = H("ocean_button", {}, [x.ifThen(x.cmp(x.vget("聲納"), "GT", x.num(0)),
    [x.sonar(), x.change("聲納", -1), x.stat("聲納", x.vget("聲納"))], [x.say("聲納用完了"), x.sound("beep")])]);
  return [
    { id: "c6", name: "第六堂｜珍珠收集", xml: xml([
      H("ocean_start", {}, [x.spawn(12, "pearl", "random"), x.time(90), x.say("收集發光的珍珠！")]),
      H("ocean_every", { SEC: 5 }, [x.ifThen(x.cmp(x.count("pearl"), "LT", x.num(4)), [x.spawn(4, "pearl", "random")])]),
      H("ocean_touch", { KIND: "pearl" }, [x.score(1), x.sound("ding"), x.send("g"), x.rm()]),
      H("ocean_timeup", {}, [x.win("時間到！看看收集了幾顆")]),
    ]) },
    { id: "c6b", name: "第六堂進階｜小心水母", xml: xml([
      H("ocean_start", {}, [x.lives(3), x.time(90), x.spawn(10, "pearl", "random"), x.spawn(5, "jelly", "random"), x.say("珍珠旁邊有水母，小心！")]),
      H("ocean_score", { N: 10 }, [x.spawn(4, "jelly", "far"), x.speed("jelly", "1.7"), x.say("水母變多又變快了！")]),
      H("ocean_lives0", {}, [x.lose("被水母電暈了")]),
      H("ocean_touch", { KIND: "pearl" }, [x.score(1), x.sound("ding"), x.rm(), x.spawn(1, "pearl", "random")]),
      H("ocean_touch", { KIND: "jelly" }, [x.livesC(-1), x.sound("bump"), x.shake(), x.fx("sub", "flash"), x.say("被電到了！")]),
      H("ocean_timeup", {}, [x.win("撐過 90 秒，任務成功！")]),
    ]) },
    { id: "c7", name: "第七堂｜黑暗尋寶", xml: xml([
      H("ocean_start", {}, [x.light("dark"), x.spawn(1, "treasure", "floor"), x.set("聲納", x.num(3)), x.stat("聲納", x.vget("聲納")), x.time(120), x.say("寶箱藏在黑暗裡，按 A 發射聲納")]),
      H("ocean_every", { SEC: 0.5 }, [x.stat("距離", x.dist("treasure"))]),
      sonarRule,
      H("ocean_touch", { KIND: "treasure" }, [x.score(1), x.sound("win"), x.fx("it", "flash"), x.rm(), x.spawn(1, "treasure", "far"), x.change("聲納", 1), x.stat("聲納", x.vget("聲納"))]),
    ]) },
    { id: "c7b", name: "第七堂進階｜鯊魚出沒", xml: xml([
      H("ocean_start", {}, [x.light("dim"), x.lives(3), x.spawn(10, "pearl", "random"), x.spawn(1, "shark", "far"), x.say("小心鯊魚！")]),
      H("ocean_every", { SEC: 20 }, [x.spawn(1, "shark", "far"), x.say("又來了一隻鯊魚")]),
      H("ocean_score", { N: 15 }, [x.win("甩開鯊魚，任務成功！")]),
      H("ocean_touch", { KIND: "pearl" }, [x.score(1), x.sound("ding"), x.rm(), x.spawn(1, "pearl", "random")]),
      H("ocean_touch", { KIND: "shark" }, [x.livesC(-1), x.sound("boom"), x.shake(), x.home(), x.say("被鯊魚咬到！回到起點")]),
      H("ocean_lives0", {}, [x.lose("被鯊魚追上了")]),
    ]) },
    { id: "c8", name: "第八堂｜雙屏尋寶", xml: xml([
      H("ocean_start", {}, [x.light("dark"), x.radar(true), x.spawn(1, "treasure", "floor"), x.set("聲納", x.num(3)), x.stat("聲納", x.vget("聲納")), x.time(120), x.say("看 micro:bit 的雷達找寶藏")]),
      sonarRule,
      H("ocean_touch", { KIND: "treasure" }, [x.score(1), x.sound("win"), x.send("g"), x.fx("it", "flash"), x.rm(), x.spawn(1, "treasure", "far")]),
      H("ocean_timeup", {}, [x.win("時間到！")]),
    ]) },
    { id: "c8b", name: "第八堂進階｜氧氣危機", xml: xml([
      H("ocean_start", {}, [x.set("氧氣", x.num(100)), x.stat("氧氣", x.vget("氧氣")), x.light("dim"), x.radar(true), x.spawn(1, "treasure", "floor"), x.spawn(4, "oxygen", "floor"), x.spawn(3, "mine", "random"), x.say("氧氣會一直減少，快找寶箱！")]),
      H("ocean_every", { SEC: 1 }, [x.change("氧氣", -3), x.stat("氧氣", x.vget("氧氣")), x.ifThen(x.cmp(x.vget("氧氣"), "LT", x.num(1)), [x.lose("氧氣用完了")])]),
      H("ocean_every", { SEC: 4 }, [x.spawn(1, "oxygen", "floor")]),
      H("ocean_score", { N: 5 }, [x.win("帶回 5 個寶箱！")]),
      H("ocean_touch", { KIND: "oxygen" }, [x.change("氧氣", 25), x.ifThen(x.cmp(x.vget("氧氣"), "GT", x.num(100)), [x.set("氧氣", x.num(100))]), x.stat("氧氣", x.vget("氧氣")), x.sound("eat"), x.rm()]),
      H("ocean_touch", { KIND: "mine" }, [x.fx("it", "boom"), x.rm(), x.change("氧氣", -20), x.stat("氧氣", x.vget("氧氣")), x.shake()]),
      H("ocean_touch", { KIND: "treasure" }, [x.score(1), x.send("g"), x.sound("win"), x.rm(), x.spawn(1, "treasure", "far"), x.spawn(2, "mine", "random")]),
    ]) },
    { id: "free", name: "自由創作", xml: xml([H("ocean_start", {}, [x.say("出發！")])]) },
  ];
})();

/* =====================================================================
 * 3. 規則編輯畫面
 * ===================================================================== */
const STORE = "oceanlab.v1";
const MEDIA = window.BLOCKLY_MEDIA || "vendor/blockly/media/";
let ws = null, G = null;
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function info(t, bad) {
  const el = $("check"); el.textContent = t; el.hidden = false; el.style.background = bad ? "#7a1f2b" : "#0d5b78";
  clearTimeout(info.t); info.t = setTimeout(() => (el.hidden = true), 2600);
}
function loadXml(text) {
  ws.clear();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(text), ws);
  arrange();
}
// 依照積木實際高度排成兩欄，不會互相重疊
function arrange() {
  const tops = ws.getTopBlocks(true); if (!tops.length) return;
  const sizes = tops.map((b) => b.getHeightWidth());
  const total = sizes.reduce((a, s) => a + s.height + 36, 0);
  let x = 30, y = 30, colW = 0, col = 0;
  tops.forEach((b, i) => {
    if (col === 0 && y > 30 && y + sizes[i].height / 2 > total / 2 + 30) { x += colW + 70; y = 30; colW = 0; col = 1; }
    const xy = b.getRelativeToSurfaceXY(); b.moveBy(x - xy.x, y - xy.y);
    y += sizes[i].height + 36; colW = Math.max(colW, sizes[i].width);
  });
  ws.scroll(0, 0);
}
function loadTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id); if (!t) return;
  loadXml(t.xml); S.title = t.name.split("｜").pop(); store(STORE + ".title", S.title);
  info(`已載入：${t.name}（Ctrl+Z 可以復原）`);
}
function saveLocal() { try { store(STORE, JSON.stringify(Blockly.serialization.workspaces.save(ws))); } catch (e) {} }
function initEditor() {
  Blockly.common.defineBlocksWithJsonArray(BLOCKS);
  G = javascript.javascriptGenerator; defineGenerators(G, javascript.Order);
  ws = Blockly.inject("blockly", {
    toolbox: TOOLBOX, renderer: "zelos", trashcan: true, sounds: false, media: MEDIA,
    zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 1.6, minScale: 0.35 },
    grid: { spacing: 28, length: 2, colour: "#d9e2ea", snap: true },
    move: { scrollbars: true, drag: true, wheel: false },
  });
  ws.addChangeListener(Blockly.Events.disableOrphans);
  if (window.BLOCKLY_SPRITES) document.querySelectorAll("#blockly image").forEach((im) => {
    const h = im.getAttribute("href") || im.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
    if (h.endsWith("sprites.png")) { im.setAttribute("href", window.BLOCKLY_SPRITES); im.setAttributeNS("http://www.w3.org/1999/xlink", "href", window.BLOCKLY_SPRITES); }
  });
  let t = 0;
  ws.addChangeListener((e) => { if (e.isUiEvent) return; clearTimeout(t); t = setTimeout(saveLocal, 400); });
  const sel = $("tplSel");
  sel.innerHTML = `<option value="">範例規則…</option>` + TEMPLATES.map((x) => `<option value="${x.id}">${x.name}</option>`).join("");
  sel.onchange = () => { loadTemplate(sel.value); sel.value = ""; };
  $("newBtn").onclick = () => loadTemplate("free");
  $("saveBtn").onclick = () => {
    const data = JSON.stringify({ app: "ocean-lab", title: S.title, blocks: Blockly.serialization.workspaces.save(ws) }, null, 1);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `深海規則-${S.title || "我的規則"}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $("openBtn").onclick = () => $("fileIn").click();
  $("fileIn").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      ws.clear(); Blockly.serialization.workspaces.load(d.blocks || d, ws); S.title = d.title || "我的規則"; info(`已開啟：${f.name}`);
    } catch (err) { info("這個檔案打不開，請選擇「儲存檔案」存下來的 .json", true); }
  };
  $("tipX").onclick = () => ($("tip").hidden = true);
  $("playBtn").onclick = () => startGame();
  // 恢復上次的積木
  let ok = false;
  const saved = store(STORE);
  if (saved) { try { Blockly.serialization.workspaces.load(JSON.parse(saved), ws); ok = ws.getTopBlocks(false).length > 0; } catch (e) { ws.clear(); } }
  S.title = store(STORE + ".title") || "深海探險";
  if (!ok) loadTemplate("c6");
}
function compileRules() {
  G.init(ws);
  let code = "";
  for (const b of ws.getTopBlocks(true)) if (HATS.has(b.type) && b.isEnabled()) code += G.blockToCode(b);
  return G.finish(code);
}

/* =====================================================================
 * 4. 遊戲引擎
 * ===================================================================== */
const cv = $("sea"), ctx = cv.getContext("2d");
const light = document.createElement("canvas"), lctx = light.getContext("2d");
function floorY(x) { return 1240 + 70 * Math.sin(x / 310) + 45 * Math.sin(x / 127 + 1.3) + 22 * Math.sin(x / 53 + 0.4); }
const rocks = [], weeds = [], farRocks = [], school = [], snow = [], bubbles = [], sparks = [];
function buildWorld() {
  rocks.length = weeds.length = farRocks.length = school.length = 0;
  for (let x = 380; x < WW - 200; x += rnd(260, 520)) rocks.push({ x, y: floorY(x) - rnd(10, 40), r: rnd(55, 110), seed: Math.random() });
  for (let i = 0; i < 5; i++) { const x = 700 + i * 720 + rnd(-120, 120); rocks.push({ x, y: rnd(520, 860), r: rnd(60, 95), seed: Math.random() }); }
  for (let x = 40; x < WW; x += rnd(28, 70)) weeds.push({ x, h: rnd(60, 190), ph: rnd(0, 6), hue: rnd(0, 1) });
  for (let x = -200; x < WW + 400; x += rnd(160, 320)) farRocks.push({ x, h: rnd(160, 420), w: rnd(180, 360) });
  for (let s = 0; s < 5; s++) {
    const cx = rnd(300, WW - 300), cy = rnd(250, 1000), dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 8; i++) school.push({ x: cx + rnd(-90, 90), y: cy + rnd(-50, 50), dir, sp: rnd(40, 70), ph: rnd(0, 6), size: rnd(7, 11) });
  }
  snow.length = 0; for (let i = 0; i < 140; i++) snow.push({ x: Math.random(), y: Math.random(), z: rnd(0.3, 1), v: rnd(4, 12) });
}

const S = {
  title: "深海探險", running: false, ended: false, score: 0, left: 0, timeOn: false, lives: 0, livesOn: false, stats: new Map(),
  sub: { x: 260, y: 300, vx: 0, vy: 0, face: 1, faceS: 1, prop: 0, hit: 0, spd: 1, sz: 1 },
  input: { rx: 0, ry: 0, sx: 0, sy: 0, last: 0, key: { x: 0, y: 0 }, pulse: 0 },
  cam: { x: 0, y: 0, shake: 0 }, reveal: 0, ripple: -9, flash: 0, invertY: false, sound: true,
  light: "auto", cur: { x: 0, y: 0 }, kspd: {}, radar: false, lastSent: -1, crowd: false,
};
let E = [], H = [], depthNow = 0;
const R = { fish: 22, jelly: 30, shark: 46, pearl: 28, treasure: 46, mine: 32, oxygen: 26 };

// ---- 規則 API（積木產生的程式只能用這些）----
const api = {
  _loop: 0, _it: null,
  on(ev, arg, fn) { if (typeof fn === "function" && H.length < 200) H.push({ ev, arg, fn, acc: 0, err: 0, off: false }); },
  spawn(kind, n, where) {
    if (!R[kind]) return; n = clamp(Math.round(num(n)), 0, 30);
    for (let i = 0; i < n; i++) {
      if (E.length >= MAXE) { if (!S.crowd) { S.crowd = true; toast("海裡太擠了，放不下更多"); } break; }
      E.push(makeEntity(kind, where));
    }
  },
  removeIt() { const e = api._it; if (e && !e.dead) { e.dead = true; burst(e.x, e.y, COL[e.kind], 14); } },
  removeAll(kind) { for (const e of E) if (e.kind === kind) e.dead = true; },
  kindSpeed(kind, m) { S.kspd[kind] = clamp(num(m), 0, 3); },
  count(kind) { return E.reduce((n, e) => n + (e.kind === kind && !e.dead ? 1 : 0), 0); },
  dist(kind) { const e = nearest(kind); return e ? Math.round(Math.hypot(e.x - S.sub.x, e.y - S.sub.y) / 10) : 999; },
  addScore(n) { setScore(S.score + num(n)); },
  setScore(n) { setScore(num(n)); },
  getScore() { return S.score; },
  setTime(n) { S.left = clamp(num(n), 0, 3600); S.timeOn = S.left > 0; hud(); },
  addTime(n) { if (S.timeOn) { S.left = clamp(S.left + num(n), 0, 3600); hud(); } },
  getTime() { return S.timeOn ? Math.ceil(S.left) : 0; },
  setLives(n) { setLives(num(n)); },
  addLives(n) { setLives((S.livesOn ? S.lives : 0) + num(n)); },
  getLives() { return S.lives; },
  stat(label, v) {
    label = String(label).slice(0, 8) || "數值";
    if (!S.stats.has(label) && S.stats.size >= 4) return;
    S.stats.set(label, typeof v === "number" ? Math.round(v * 10) / 10 : String(v).slice(0, 8)); hud();
  },
  win(t) { endGame(true, String(t || "任務成功！")); },
  lose(t) { endGame(false, String(t || "任務失敗")); },
  subSpeed(m) { S.sub.spd = clamp(num(m), 0.3, 2.5); },
  subSize(m) { S.sub.sz = clamp(num(m), 0.5, 1.6); },
  subHome() { Object.assign(S.sub, { x: 260, y: 300, vx: 0, vy: 0 }); for (let i = 0; i < 20; i++) bubbles.push({ x: 260 + rnd(-60, 60), y: 300 + rnd(-30, 30), vx: rnd(-20, 20), vy: rnd(-60, -20), r: rnd(3, 8), life: 1 }); },
  shake() { S.cam.shake = 16; },
  depth() { return depthNow; },
  current(dir, str) { const s = clamp(num(str), 0, 200); S.cur = { x: dir === "right" ? s : dir === "left" ? -s : 0, y: dir === "down" ? s : dir === "up" ? -s : 0 }; },
  light(l) { S.light = ["auto", "bright", "dim", "dark"].includes(l) ? l : "auto"; },
  sonar() { const now = performance.now(); S.ripple = now; S.reveal = now + 1700; sfx.sonar(); },
  radar(on) { S.radar = !!on; S.lastSent = -1; if (!on) send("0"); },
  say(t) { toast(String(t).slice(0, 40)); },
  sound(n) { (sfx[n] || sfx.beep)(); },
  fx(at, type) {
    const p = at === "it" && api._it ? api._it : S.sub;
    if (type === "boom") { burst(p.x, p.y, "#ffb347", 40); burst(p.x, p.y, "#ff5a3c", 20); S.cam.shake = Math.max(S.cam.shake, 18); sfx.boom(); }
    else if (type === "flash") { burst(p.x, p.y, "#ffffff", 30); S.flash = performance.now(); }
    else for (let i = 0; i < 30; i++) bubbles.push({ x: p.x + rnd(-40, 40), y: p.y + rnd(-20, 20), vx: rnd(-40, 40), vy: rnd(-90, -30), r: rnd(3, 9), life: 1.2 });
  },
  send(t) { const s = String(t).replace(/#/g, "").slice(0, 18); if (s) send(s); },
};
Object.freeze(api.on);

let depth = 0, errShown = 0;
function fireOne(h, it) {
  if (h.off || depth > 6) return;
  const prevIt = api._it; depth++;
  if (depth === 1) api._loop = 20000;
  api._it = it || null;
  try { h.fn(); }
  catch (err) {
    h.err++; if (h.err >= 3 || (err && err.message === "LOOP")) h.off = true;
    showErr(err && err.message === "LOOP" ? `「${evName(h)}」裡的迴圈重複太多次，這條規則先停用` : `「${evName(h)}」出錯：${(err && err.message) || err}`);
  }
  api._it = prevIt; depth--;
}
function fire(ev, arg, it) {
  let n = 0;
  for (const h of H) if (h.ev === ev && (arg === undefined || h.arg === arg)) { n++; if (S.running || ev === "start") fireOne(h, it); }
  return n;
}
function has(ev) { return H.some((h) => h.ev === ev && !h.off); }
function evName(h) {
  return { start: "當遊戲開始", every: `每隔 ${h.arg} 秒`, touch: `當潛艇碰到${KIND_NAME[h.arg] || ""}`, bump: "當潛艇撞到岩石", score: `當分數達到 ${h.arg}`,
    timeup: "當倒數時間到", lives0: "當生命用完", button: "當按下按鈕 A", msg: `當收到訊息 ${h.arg}` }[h.ev] || h.ev;
}
function showErr(t) { const el = $("errs"); el.textContent = t; el.hidden = false; clearTimeout(errShown); errShown = setTimeout(() => (el.hidden = true), 4000); }
function setScore(v) {
  const old = S.score; S.score = Math.round(v * 100) / 100; hud();
  if (S.score > old) for (const h of H) if (h.ev === "score" && old < h.arg && S.score >= h.arg) fireOne(h);
}
function setLives(v) {
  const old = S.livesOn ? S.lives : Infinity;
  S.lives = clamp(Math.round(v), 0, 99); S.livesOn = true; hud();
  if (S.lives <= 0 && old > 0 && S.running) { if (!fire("lives0")) endGame(false, "生命用完了"); }
}
function nearest(kind) {
  let best = null, bd = Infinity;
  for (const e of E) if (e.kind === kind && !e.dead) { const d = Math.hypot(e.x - S.sub.x, e.y - S.sub.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function waterY(x, y) { return clamp(y, SURFACE + 50, floorY(x) - 40); }
function makeEntity(kind, where) {
  const s = S.sub; let x = 0, y = 0;
  for (let k = 0; k < 25; k++) {
    if (where === "near") { const a = rnd(0, 6.28), d = rnd(280, 520); x = s.x + Math.cos(a) * d; y = s.y + Math.sin(a) * d * 0.6; }
    else if (where === "far") { x = rnd(250, WW - 150); if (Math.abs(x - s.x) < 1100 && k < 20) continue; y = rnd(SURFACE + 100, floorY(x) - 80); }
    else { x = rnd(250, WW - 150); y = where === "surface" ? rnd(SURFACE + 70, 260) : rnd(SURFACE + 100, floorY(x) - 80); }
    x = clamp(x, 120, WW - 120);
    if (where === "floor" || kind === "treasure") y = floorY(x) - (kind === "treasure" ? 26 : kind === "pearl" ? 32 : 70);
    y = kind === "treasure" ? y : waterY(x, y);
    if (Math.hypot(x - s.x, y - s.y) < 200 && where !== "near" && k < 24) continue;
    if (!rocks.some((r) => Math.hypot(r.x - x, (r.y - y) * 1.3) < r.r + R[kind] + 20)) break;
  }
  return { kind, x, y, vx: 0, vy: 0, bx: x, by: y, ph: rnd(0, 6), dir: Math.random() < 0.5 ? -1 : 1, cool: 0, r: R[kind], dead: false,
    clam: kind === "pearl" && (where === "floor" || y > floorY(x) - 40), hue: Math.floor(rnd(0, 3)) };
}
const COL = { fish: "#ff9f43", jelly: "#ff8ad8", shark: "#a8b8c4", pearl: "#fff3c4", treasure: "#ffd84a", mine: "#ff5a3c", oxygen: "#9be8ff" };

// ---------------- 藍牙 ----------------
let device = null, rxChar = null, inbox = "", sending = Promise.resolve();
function setStatus(st, name) {
  for (const [d, s] of [["dot", "status"], ["dot2", "status2"]]) {
    $(d).className = "dot" + (st === "on" ? " on" : st === "wait" ? " wait" : "");
    $(s).textContent = st === "on" ? `已連接 ${name || ""}` : st === "wait" ? "連接中…" : "未連接";
  }
  $("connectBtn").textContent = st === "on" ? "中斷連接" : "連接 micro:bit";
}
async function connect() {
  if (!navigator.bluetooth) { info("這個瀏覽器不支援藍牙：電腦請用 Chrome 或 Edge，iPad 用 Bluefy。也可以用方向鍵試玩。", true); return; }
  try {
    setStatus("wait");
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }], optionalServices: [NUS] });
    device.addEventListener("gattserverdisconnected", () => { rxChar = null; setStatus("off"); log("已中斷連接", "e"); });
    const svc = await (await device.gatt.connect()).getPrimaryService(NUS);
    rxChar = await svc.getCharacteristic(NUS_RX);
    const tx = await svc.getCharacteristic(NUS_TX);
    await tx.startNotifications();
    tx.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value)));
    setStatus("on", device.name); log(`已連接 ${device.name || "micro:bit"}`); S.lastSent = -1;
  } catch (err) {
    if (!err || err.name !== "NotFoundError") info(`連接失敗：${(err && err.message) || err}`, true);
    setStatus("off");
  }
}
function send(word) {
  if (!rxChar) { log(`（未連接）${word}#`, "s"); return; }
  const data = new TextEncoder().encode(word + "#");
  sending = sending.then(async () => {
    try {
      if (rxChar.properties && rxChar.properties.writeWithoutResponse) await rxChar.writeValueWithoutResponse(data);
      else await rxChar.writeValue(data);
      log(`送出 ${word}#`, "s");
    } catch (err) { log(`送出失敗 ${err.message || err}`, "e"); }
  });
}
let lastLogIn = 0;
function receive(chunk) {
  inbox += chunk;
  const parts = inbox.split(/[#\r\n]+/); inbox = parts.pop();
  if (inbox.length > 200) inbox = "";
  for (const raw of parts) {
    const msg = raw.trim(); if (!msg) continue;
    const m = msg.match(/^([a-zA-Z]+)\s*:\s*(-?[\d.]+)$/), now = performance.now();
    if (m) {
      const k = m[1].toLowerCase(), v = parseFloat(m[2]);
      if (k === "x") { S.input.rx = v; S.input.last = now; } else if (k === "y") { S.input.ry = v; S.input.last = now; }
      else if (k === "p") button();
      if (now - lastLogIn > 600) { lastLogIn = now; log(`收到 x:${Math.round(S.input.rx)} y:${Math.round(S.input.ry)}`, "r"); }
    } else {
      const c = msg.toLowerCase(); log(`收到 ${msg}#`, "r");
      if (c === "p") button();
      else if ("lrud".includes(c) && c.length === 1) {
        S.input.rx = c === "l" ? -700 : c === "r" ? 700 : 0; S.input.ry = c === "u" ? 700 : c === "d" ? -700 : 0; S.input.last = now; S.input.pulse = now + 400;
      }
      if (S.running) for (const h of H) if (h.ev === "msg" && String(h.arg).toLowerCase() === c) fireOne(h);
    }
  }
}
function button() { if (S.running) fire("button"); }
function log(t, cls) {
  const el = $("log"), d = document.createElement("div");
  if (cls) d.className = cls; d.textContent = t; el.appendChild(d);
  while (el.childNodes.length > 6) el.removeChild(el.firstChild);
}

// ---------------- 音效 ----------------
let ac = null;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
function tone(f1, f2, dur, type = "sine", vol = 0.18, delay = 0) {
  const a = audio(); if (!a || !S.sound) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol) {
  const a = audio(); if (!a || !S.sound) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "lowpass"; f.frequency.value = 700; g.gain.value = vol; src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
}
const sfx = {
  ding() { tone(880, 1320, 0.18, "triangle", 0.16); tone(1320, 1760, 0.22, "triangle", 0.14, 0.09); },
  eat() { tone(300, 900, 0.14, "sine", 0.2); },
  beep() { tone(660, 660, 0.12, "square", 0.08); },
  sonar() { tone(1400, 380, 0.9, "sine", 0.22); tone(1400, 380, 0.9, "sine", 0.07, 0.35); },
  bump() { tone(120, 50, 0.35, "sawtooth", 0.12); },
  boom() { noise(0.7, 0.5); tone(90, 35, 0.6, "sine", 0.3); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, 0.3, "triangle", 0.16, i * 0.11)); },
  lose() { [523, 440, 349, 262].forEach((f, i) => tone(f, f * 0.98, 0.35, "triangle", 0.14, i * 0.16)); },
};

// ---------------- 流程 ----------------
function showView(name) {
  $("editor").hidden = name !== "editor"; $("game").hidden = name !== "game";
  if (name === "editor") setTimeout(() => Blockly.svgResize(ws), 0); else resize();
}
function startGame() {
  audio();
  let code;
  try { code = compileRules(); H = []; new Function("api", '"use strict";\n' + code)(api); }
  catch (err) { info(`規則有問題：${err.message || err}`, true); return; }
  if (!H.length) info("還沒有任何事件積木，先拖一個「當遊戲開始」吧", true);
  Object.assign(S, { running: true, ended: false, score: 0, left: 0, timeOn: false, lives: 0, livesOn: false, reveal: 0, ripple: -9, flash: 0,
    light: "auto", cur: { x: 0, y: 0 }, kspd: {}, radar: false, lastSent: -1, crowd: false });
  S.stats = new Map();
  Object.assign(S.sub, { x: 260, y: 300, vx: 0, vy: 0, face: 1, faceS: 1, hit: 0, spd: 1, sz: 1 });
  S.cam.x = 0; S.cam.y = 0; E = []; bubbles.length = sparks.length = 0;
  $("endOv").hidden = true; $("errs").hidden = true; $("gameTitle").textContent = S.title || "深海探險";
  showView("game"); hud();
  fire("start");
  if (S.running && !E.length && !S.stats.size && H.length === 1 && H[0].ev === "start") toast("先自由駕駛看看吧");
}
function endGame(win, text) {
  if (!S.running) return;
  S.running = false; S.ended = true; send("e"); (win ? sfx.win : sfx.lose)();
  setTimeout(() => {
    $("endTitle").textContent = win ? "任務成功" : "任務失敗"; $("endTitle").className = win ? "win" : "lose";
    $("endText").textContent = text; $("endScore").textContent = `${fmt(S.score)} 分`;
    $("endOv").hidden = false;
  }, 700);
}
function backToEditor() { S.running = false; $("endOv").hidden = true; if (S.radar) send("0"); showView("editor"); }
function hud() {
  $("score").textContent = fmt(S.score);
  $("timeBox").hidden = !S.timeOn; $("time").textContent = Math.ceil(S.left);
  $("timeBox").classList.toggle("warn", S.timeOn && S.left <= 10);
  $("livesBox").hidden = !S.livesOn; $("lives").textContent = S.lives;
  $("livesBox").classList.toggle("warn", S.livesOn && S.lives <= 1);
  const box = $("stats");
  box.querySelectorAll(".custom").forEach((el) => { if (!S.stats.has(el.dataset.k)) el.remove(); });
  for (const [k, v] of S.stats) {
    let el = box.querySelector(`.custom[data-k="${CSS.escape(k)}"]`);
    if (!el) { el = document.createElement("div"); el.className = "stat custom"; el.dataset.k = k; el.innerHTML = "<small></small><span></span>"; el.firstChild.textContent = k; box.insertBefore(el, $("depth").parentNode); }
    el.lastChild.textContent = fmt(v);
  }
}
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1600); }
function signal() {
  const t = nearest("treasure"); if (!t) return 0;
  const d = Math.hypot(S.sub.x - t.x, S.sub.y - t.y);
  return d < 200 ? 4 : d < 450 ? 3 : d < 780 ? 2 : d < 1180 ? 1 : 0;
}

// ---------------- 物理 ----------------
function update(dt, now) {
  const I = S.input, s = S.sub;
  let tx = 0, ty = 0;
  if (now - I.last < 1500) { tx = I.rx; ty = I.ry; }
  if (I.pulse && now > I.pulse && now - I.last > 300) { tx = 0; ty = 0; }
  if (I.key.x || I.key.y) { tx = I.key.x * 750; ty = I.key.y * 750; }
  const nx = clamp(tx / 750, -1, 1), ny = clamp(ty / 750, -1, 1);
  const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
  const k = 1 - Math.exp(-dt * 2.4);
  I.sx += (dz(nx) - I.sx) * k; I.sy += (dz(ny) - I.sy) * k;
  if (!S.running) { I.sx *= 0.9; I.sy *= 0.9; }
  const dive = (S.invertY ? 1 : -1) * I.sy;
  s.vx += I.sx * 260 * s.spd * dt + S.cur.x * dt; s.vy += dive * 190 * s.spd * dt + S.cur.y * dt;
  s.vx -= s.vx * 0.85 * dt; s.vy -= s.vy * 1.25 * dt;
  s.vy += Math.sin(now / 900) * 6 * dt;
  const vmax = 300 * s.spd, sp = Math.hypot(s.vx, s.vy); if (sp > vmax) { s.vx *= vmax / sp; s.vy *= vmax / sp; }
  s.x += s.vx * dt; s.y += s.vy * dt;
  if (s.vx > 18) s.face = 1; else if (s.vx < -18) s.face = -1;
  s.faceS += (s.face - s.faceS) * (1 - Math.exp(-dt * 4));
  s.prop += (Math.abs(I.sx) * 18 + 2) * dt;
  const hw = 66 * s.sz, hh = 30 * s.sz;
  if (s.y < SURFACE + hh) { s.y = SURFACE + hh; s.vy = Math.abs(s.vy) * 0.3; }
  if (s.x < 80) { s.x = 80; s.vx = Math.abs(s.vx) * 0.4; }
  if (s.x > WW - 80) { s.x = WW - 80; s.vx = -Math.abs(s.vx) * 0.4; }
  let bumped = false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, px = s.x + Math.cos(a) * hw, py = s.y + Math.sin(a) * hh, fy = floorY(px);
    if (py > fy) { s.y -= py - fy; if (s.vy > 0) { if (s.vy > 60) bumped = true; s.vy = -s.vy * 0.35; } }
  }
  for (const r of rocks) {
    const dx = s.x - r.x, dy = (s.y - r.y) * 1.8, d = Math.hypot(dx, dy), min = r.r + 40 * s.sz;
    if (d < min && d > 0.01) {
      const ux = dx / d, uy = dy / d; s.x += ux * (min - d); s.y += (uy * (min - d)) / 1.8;
      const vn = s.vx * ux + s.vy * uy;
      if (vn < 0) { if (vn < -60) bumped = true; s.vx -= 1.4 * vn * ux; s.vy -= 1.4 * vn * uy; }
    }
  }
  if (bumped && now - s.hit > 600) { s.hit = now; S.cam.shake = Math.max(S.cam.shake, 10); sfx.bump(); if (S.running) fire("bump"); }
  depthNow = Math.max(0, Math.round((s.y - SURFACE) / 10));

  if (S.running) {
    // 計時
    if (S.timeOn) {
      const before = Math.ceil(S.left); S.left -= dt;
      if (Math.ceil(S.left) !== before) hud();
      if (S.left <= 0) { S.left = 0; S.timeOn = false; hud(); if (!fire("timeup")) endGame(true, "時間到！"); }
    }
    // 每隔幾秒
    for (const h of H) if (h.ev === "every" && !h.off && S.running) {
      const iv = Math.max(0.5, num(h.arg) || 1); h.acc += dt;
      if (h.acc >= iv) { h.acc -= iv; fireOne(h); }
    }
    // 雷達
    if (S.radar) { const v = signal(); if (v !== S.lastSent) { S.lastSent = v; send(String(v)); } }
  }
  // 生物
  for (const e of E) {
    if (e.dead) continue;
    const m = S.kspd[e.kind] ?? 1; e.ph += dt * (2 + m * 3);
    const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy);
    if (e.kind === "fish") {
      e.x += e.dir * 75 * m * dt; e.y = lerp(e.y, e.by + Math.sin(e.ph * 0.5) * 25, dt);
      if (d < 220 && m > 0) { e.x += Math.sign(dx) * 70 * m * dt; e.by += Math.sign(dy) * 50 * m * dt; }
      if (e.x < 60 || e.x > WW - 60) e.dir *= -1;
      e.x += S.cur.x * 0.5 * dt; e.by += S.cur.y * 0.4 * dt;
    } else if (e.kind === "jelly") {
      e.y += Math.sin(e.ph * 0.6) * 34 * m * dt; e.x += e.dir * 14 * m * dt + S.cur.x * 0.6 * dt; e.y += S.cur.y * 0.5 * dt;
      if (e.x < 80 || e.x > WW - 80) e.dir *= -1;
    } else if (e.kind === "shark") {
      let wx = e.dir * 60 * m, wy = 0;
      if (d < 750 && S.running) { wx = (-dx / d) * 115 * m; wy = (-dy / d) * 95 * m; }
      e.vx += (wx - e.vx) * (1 - Math.exp(-dt * 1.4)); e.vy += (wy - e.vy) * (1 - Math.exp(-dt * 1.4));
      e.x += e.vx * dt + S.cur.x * 0.3 * dt; e.y += e.vy * dt;
      if (e.x < 100) e.dir = 1; if (e.x > WW - 100) e.dir = -1;
    } else if (e.kind === "mine") {
      e.y = e.by + Math.sin(e.ph * 0.35) * 14;
    } else if (e.kind === "oxygen") {
      e.y -= 30 * Math.max(0.2, m) * dt; e.x = e.bx + Math.sin(e.ph * 0.5) * 16 + S.cur.x * 0.5 * dt; e.bx += S.cur.x * 0.5 * dt;
      if (e.y < SURFACE + 30) { e.dead = true; for (let i = 0; i < 6; i++) bubbles.push({ x: e.x, y: e.y, vx: rnd(-30, 30), vy: rnd(-40, -10), r: rnd(2, 5), life: 0.6 }); }
    }
    if (e.kind !== "treasure" && e.kind !== "oxygen") {
      e.x = clamp(e.x, 40, WW - 40);
      const fy = floorY(e.x) - (e.kind === "pearl" && e.clam ? 26 : 30);
      if (e.y > fy) e.y = fy; if (e.y < SURFACE + 40) e.y = SURFACE + 40;
      if (e.kind === "fish") e.by = clamp(e.by, SURFACE + 60, floorY(e.x) - 60);
    }
    // 碰到潛艇
    if (S.running && now > e.cool) {
      const a = hw + e.r * 0.8, b = hh + e.r * 0.8;
      if ((dx / a) ** 2 + (dy / b) ** 2 < 1) {
        e.cool = now + (e.kind === "shark" || e.kind === "jelly" || e.kind === "mine" ? 1200 : 400);
        fire("touch", e.kind, e);
      }
    }
  }
  if (E.some((e) => e.dead)) E = E.filter((e) => !e.dead);
  if (S.crowd && E.length < MAXE - 10) S.crowd = false;
  // 鏡頭
  const vw = cv.width / scale(), vh = VIEW_H;
  S.cam.x += (clamp(s.x - vw * 0.42 + s.vx * 0.6, 0, Math.max(0, WW - vw)) - S.cam.x) * (1 - Math.exp(-dt * 2.5));
  S.cam.y += (clamp(s.y - vh * 0.45, 0, 1400 - vh) - S.cam.y) * (1 - Math.exp(-dt * 2.5));
  S.cam.shake *= Math.exp(-dt * 6);
  // 粒子
  if (Math.random() < Math.abs(I.sx) * 0.9 + 0.05) bubbles.push({ x: s.x - s.faceS * 78 * s.sz, y: s.y + rnd(-6, 6), vx: -s.faceS * rnd(20, 60), vy: rnd(-30, -10), r: rnd(2, 6), life: 1 });
  for (const b of bubbles) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 40 * dt; b.vx *= 0.97; b.life -= dt * 0.5; }
  for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].life <= 0 || bubbles[i].y < SURFACE) bubbles.splice(i, 1);
  if (bubbles.length > 400) bubbles.splice(0, bubbles.length - 400);
  for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt * 1.4; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  for (const f of school) {
    f.x += f.dir * f.sp * dt; f.ph += dt * 6;
    const d = Math.hypot(f.x - s.x, f.y - s.y); if (d < 220) { f.y += Math.sign(f.y - s.y) * 60 * dt; f.x += Math.sign(f.x - s.x) * 50 * dt; }
    if (f.x < -100) f.x = WW + 100; if (f.x > WW + 100) f.x = -100;
  }
}
function burst(x, y, col, n = 26) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(60, 220); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col }); } if (sparks.length > 600) sparks.splice(0, sparks.length - 600); }

// ---------------- 繪圖 ----------------
let dpr = 1;
function scale() { return cv.height / VIEW_H; }
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  light.width = cv.width; light.height = cv.height;
}
function W2S(x, y) { const k = scale(); return [(x - S.cam.x) * k, (y - S.cam.y) * k]; }
const onScreen = (x, pad) => x > -pad && x < cv.width + pad;

function drawSub(now) {
  const s = S.sub, k = scale(), [sx, sy] = W2S(s.x, s.y + Math.sin(now / 700) * 3);
  const pitch = clamp(s.vy / 320, -0.32, 0.32) * Math.sign(s.faceS || 1);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(pitch); ctx.scale(k * s.faceS * s.sz, k * s.sz);
  const lw = 3.5;
  ctx.fillStyle = "#e8932c"; ctx.strokeStyle = "#2b2420"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(-58, -4); ctx.lineTo(-86, -30); ctx.lineTo(-80, 0); ctx.lineTo(-86, 28); ctx.lineTo(-58, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  const pr = Math.sin(s.prop * 6);
  ctx.fillStyle = "#c9d6df"; ctx.beginPath(); ctx.ellipse(-92, 0, 5, 22 * Math.abs(pr) + 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, "#ffe27a"); g.addColorStop(0.55, "#ffc433"); g.addColorStop(1, "#d7951c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 70, 32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-14, -54, 34, 26, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#2b2420"; ctx.beginPath(); ctx.moveTo(10, -54); ctx.lineTo(10, -70); ctx.lineTo(22, -70); ctx.stroke();
  ctx.strokeStyle = "rgba(120,70,10,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-46, -20); ctx.quadraticCurveTo(0, -30, 46, -20); ctx.stroke();
  ctx.fillStyle = "rgba(120,70,10,.5)"; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 14, 18, 2, 0, 6.3); ctx.fill(); }
  for (const [px, pr2, fox] of [[-26, 11, false], [4, 11, false], [36, 15, true]]) {
    ctx.fillStyle = "#11364f"; ctx.strokeStyle = "#2b2420"; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(px, -2, pr2, 0, 6.3); ctx.fill(); ctx.stroke();
    if (fox) {
      ctx.fillStyle = "#e9792e"; ctx.beginPath(); ctx.moveTo(px - 9, 6); ctx.lineTo(px - 10, -12); ctx.lineTo(px - 3, -5); ctx.lineTo(px + 3, -5); ctx.lineTo(px + 10, -12); ctx.lineTo(px + 9, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff4e6"; ctx.beginPath(); ctx.moveTo(px - 6, 4); ctx.lineTo(px, 10); ctx.lineTo(px + 6, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(px - 4, -1, 1.6, 0, 6.3); ctx.arc(px + 4, -1, 1.6, 0, 6.3); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(px - pr2 * 0.35, -2 - pr2 * 0.35, pr2 * 0.3, 0, 6.3); ctx.fill();
  }
  ctx.fillStyle = "#fffbe0"; ctx.beginPath(); ctx.arc(68, 8, 6, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawRock(r, k) {
  const [x, y] = W2S(r.x, r.y), R2 = r.r * k; if (!onScreen(x, R2 + 20)) return;
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(-R2 * 0.3, -R2 * 0.4, R2 * 0.1, 0, 0, R2 * 1.1);
  g.addColorStop(0, "#3d5566"); g.addColorStop(1, "#16232d");
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, rr = R2 * (0.82 + 0.18 * Math.sin(a * 3 + r.seed * 9)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); }
  ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(140,200,230,.18)"; ctx.lineWidth = 3 * k; ctx.stroke(); ctx.restore();
}
function drawChest(t, k, alpha, glow) {
  const [x, y] = W2S(t.x, t.y); if (!onScreen(x, 140 * k)) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(k, k);
  if (glow) { ctx.save(); ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(0, -10, 0, 0, -10, 120); g.addColorStop(0, "rgba(255,210,80,.5)"); g.addColorStop(1, "rgba(255,210,80,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -10, 120, 0, 6.3); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = "#8a4f22"; ctx.strokeStyle = "#2b1606"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(-44, -22, 88, 46, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a0622d"; ctx.beginPath(); ctx.moveTo(-44, -22); ctx.quadraticCurveTo(0, -62, 44, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffd84a"; ctx.fillRect(-46, -6, 92, 7); ctx.fillRect(-8, -16, 16, 22);
  ctx.restore();
}
// 在黑暗「之前」畫的：會被黑暗蓋住，只有探照燈照得到
function drawBody(e, k, now) {
  const [x, y] = W2S(e.x, e.y); if (!onScreen(x, 160 * k)) return;
  ctx.save(); ctx.translate(x, y);
  if (e.kind === "fish") {
    const dir = (S.kspd.fish ?? 1) === 0 ? e.dir : e.dir; ctx.scale(dir * k, k);
    const w = Math.sin(e.ph * 2) * 4;
    ctx.fillStyle = ["#ff8c2e", "#ffd23f", "#7ce0ff"][e.hue]; ctx.strokeStyle = "#3a1d06"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-30, -12 + w); ctx.lineTo(-30, 12 + w); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(-4, -12, 5, 24);
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(12, -3, 2.6, 0, 6.3); ctx.fill();
  } else if (e.kind === "shark") {
    const f = e.vx < 0 ? -1 : 1, sw = Math.sin(e.ph * 1.6) * 8; ctx.scale(f * k, k);
    ctx.fillStyle = "#6f8796"; ctx.strokeStyle = "#1d2b33"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(-88, -26 + sw); ctx.lineTo(-80, 0); ctx.lineTo(-90, 22 + sw); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(4, -48); ctx.lineTo(22, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 66, 22, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#d7e2e8"; ctx.beginPath(); ctx.ellipse(8, 9, 50, 10, 0, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(-14, 34); ctx.lineTo(16, 18); ctx.fillStyle = "#6f8796"; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#1d2b33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(34, 8); ctx.quadraticCurveTo(48, 12, 58, 6); ctx.stroke();
    ctx.fillStyle = "#fff"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(38 + i * 5, 8); ctx.lineTo(40 + i * 5, 13); ctx.lineTo(42 + i * 5, 8); ctx.fill(); }
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(40, -6, 3.2, 0, 6.3); ctx.fill();
    ctx.strokeStyle = "rgba(29,43,51,.6)"; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(18 - i * 6, -6); ctx.lineTo(16 - i * 6, 6); } ctx.stroke();
  } else if (e.kind === "mine") {
    ctx.scale(k, k);
    const fy = (floorY(e.x) - e.y);
    ctx.strokeStyle = "rgba(120,130,140,.7)"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(0, fy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#3b434b"; ctx.strokeStyle = "#11161a"; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.lineWidth = 5; ctx.stroke(); }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.arc(-8, -8, 7, 0, 6.3); ctx.fill();
  } else if (e.kind === "pearl" && e.clam) {
    ctx.scale(k, k);
    ctx.fillStyle = "#c58bbd"; ctx.beginPath(); ctx.ellipse(0, 26, 30, 12, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#a96aa2"; ctx.beginPath(); ctx.ellipse(0, 22, 30, 10, 0, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
  if (e.kind === "treasure") drawChest(e, k, 1);
}
// 在黑暗「之後」畫的：自己會發光
function drawGlow(e, k, now) {
  const [x, y0] = W2S(e.x, e.y); if (!onScreen(x, 120 * k)) return;
  if (e.kind === "pearl") {
    const y = y0 + (e.clam ? 0 : Math.sin(now / 600 + e.ph) * 8 * k);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 0, x, y, 46 * k); g.addColorStop(0, "rgba(255,250,220,.9)"); g.addColorStop(0.3, "rgba(255,230,160,.35)"); g.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 46 * k, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, 6.3); ctx.fill();
  } else if (e.kind === "jelly") {
    const p = 1 + Math.sin(e.ph * 1.2) * 0.12, y = y0;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 0, x, y, 70 * k); g.addColorStop(0, "rgba(255,120,220,.35)"); g.addColorStop(1, "rgba(255,120,220,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 70 * k, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.strokeStyle = "rgba(255,170,235,.75)"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 6); for (let j = 1; j <= 5; j++) ctx.lineTo(i * 8 + Math.sin(e.ph * 1.5 + j + i) * 5, 6 + j * 9); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,150,225,.78)"; ctx.strokeStyle = "rgba(255,220,245,.9)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 28 * p, 22 / p, 0, Math.PI, 0); ctx.quadraticCurveTo(0, 12, -28 * p, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.ellipse(-9, -9, 7, 4, -0.5, 0, 6.3); ctx.fill();
    ctx.restore();
  } else if (e.kind === "oxygen") {
    ctx.save(); ctx.translate(x, y0); ctx.scale(k, k);
    ctx.fillStyle = "rgba(120,220,255,.18)"; ctx.strokeStyle = "rgba(200,245,255,.9)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(-8, -8, 5, 0, 6.3); ctx.fill();
    ctx.fillStyle = "#e9fbff"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("O2", 1, 2);
    ctx.restore();
  } else if (e.kind === "mine") {
    if (Math.sin(now / 220 + e.ph) > 0.2) { ctx.save(); ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(x, y0 - 14 * k, 0, x, y0 - 14 * k, 26 * k); g.addColorStop(0, "rgba(255,60,40,.95)"); g.addColorStop(1, "rgba(255,60,40,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y0 - 14 * k, 26 * k, 0, 6.3); ctx.fill(); ctx.restore(); }
  } else if (e.kind === "shark") {
    const f = e.vx < 0 ? -1 : 1; ctx.fillStyle = "rgba(255,240,200,.55)"; ctx.beginPath(); ctx.arc(x + f * 40 * k, y0 - 6 * k, 2.5 * k, 0, 6.3); ctx.fill();
  }
}
function darkness(sy) {
  const auto = clamp((sy - 250) / 900, 0, 1) * 0.86;
  return S.light === "bright" ? 0 : S.light === "dim" ? Math.max(auto, 0.6) : S.light === "dark" ? 0.93 : auto;
}
function draw(now) {
  const k = scale(), w = cv.width, h = cv.height, cam = S.cam;
  const shx = (Math.random() - 0.5) * cam.shake * k, shy = (Math.random() - 0.5) * cam.shake * k;
  ctx.save(); ctx.translate(shx, shy);
  const top = cam.y, bot = cam.y + VIEW_H;
  const col = (d) => { const t = clamp(d / 1400, 0, 1); return `rgb(${Math.round(lerp(22, 2, t))},${Math.round(lerp(120, 18, t))},${Math.round(lerp(170, 38, t))})`; };
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, col(top)); bg.addColorStop(1, col(bot));
  ctx.fillStyle = bg; ctx.fillRect(-20, -20, w + 40, h + 40);
  if (top < SURFACE + 40) {
    const [, sy] = W2S(0, SURFACE);
    ctx.fillStyle = "rgba(170,230,255,.25)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sy);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, sy + Math.sin(x / 60 + now / 500) * 5 * k);
    ctx.lineTo(w, 0); ctx.fill();
  }
  const rayA = clamp(1 - top / 700, 0, 1) * 0.12;
  if (rayA > 0.005) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const bx = ((i * 337 - cam.x * 0.3) % (w / k + 400) + (w / k + 400)) % (w / k + 400) - 200, sw = 40 + (i % 3) * 30, sway = Math.sin(now / 2500 + i) * 60;
      const gx = ctx.createLinearGradient(0, 0, 0, h); gx.addColorStop(0, `rgba(200,240,255,${rayA})`); gx.addColorStop(1, "rgba(200,240,255,0)");
      ctx.fillStyle = gx; ctx.beginPath(); ctx.moveTo(bx * k, 0); ctx.lineTo((bx + sw) * k, 0); ctx.lineTo((bx + sw + 220 + sway) * k, h); ctx.lineTo((bx + 160 + sway) * k, h); ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = "rgba(4,30,50,.55)";
  for (const r of farRocks) {
    const x = (r.x - cam.x * 0.45) * k, y = (1300 - cam.y * 0.7) * k;
    ctx.beginPath(); ctx.moveTo(x - r.w * k / 2, y); ctx.quadraticCurveTo(x - r.w * k / 4, y - r.h * k, x, y - r.h * k * 0.9); ctx.quadraticCurveTo(x + r.w * k / 4, y - r.h * k * 1.1, x + r.w * k / 2, y); ctx.fill();
  }
  ctx.fillStyle = "rgba(160,220,240,.45)";
  for (const f of school) {
    const [x, y] = W2S(f.x, f.y + Math.sin(f.ph) * 6); if (!onScreen(x, 40)) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(f.dir * k, k);
    ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-f.size * 0.8, 0); ctx.lineTo(-f.size * 1.5, -f.size * 0.45); ctx.lineTo(-f.size * 1.5, f.size * 0.45); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let sx = 0; sx <= w + 10; sx += 10) { const wx = cam.x + sx / k; ctx.lineTo(sx, (floorY(wx) - cam.y) * k); }
  ctx.lineTo(w, h); ctx.closePath();
  const fg = ctx.createLinearGradient(0, (1150 - cam.y) * k, 0, h); fg.addColorStop(0, "#4a3f2c"); fg.addColorStop(1, "#1d170f");
  ctx.fillStyle = fg; ctx.fill();
  for (const wd of weeds) {
    const [x, y] = W2S(wd.x, floorY(wd.x)); if (!onScreen(x, 30)) continue;
    const sway = Math.sin(now / 1100 + wd.ph) * 18 * k + S.cur.x * 0.12 * k;
    ctx.strokeStyle = wd.hue > 0.5 ? "#2fa66a" : "#4cc28a"; ctx.lineWidth = 6 * k; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway, y - wd.h * k * 0.5, x + sway * 1.6, y - wd.h * k); ctx.stroke();
  }
  for (const r of rocks) drawRock(r, k);
  for (const e of E) drawBody(e, k, now);
  ctx.strokeStyle = "rgba(220,245,255,.6)"; ctx.lineWidth = 1.5 * k;
  for (const b of bubbles) { const [x, y] = W2S(b.x, b.y); ctx.globalAlpha = clamp(b.life, 0, 1); ctx.beginPath(); ctx.arc(x, y, b.r * k, 0, 6.3); ctx.stroke(); }
  ctx.globalAlpha = 1;
  drawSub(now);
  // ---- 黑暗與探照燈 ----
  const s = S.sub, [sx, sy] = W2S(s.x, s.y), dark = darkness(s.y);
  if (dark > 0.02) {
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = "source-over"; lctx.clearRect(0, 0, w, h);
    lctx.fillStyle = `rgba(0,6,14,${dark})`; lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = "destination-out";
    const dir = Math.sign(s.faceS) || 1, cx = sx + dir * 60 * k * s.sz, len = 520 * k;
    const g1 = lctx.createRadialGradient(cx, sy, 10 * k, cx, sy, len);
    g1.addColorStop(0, "rgba(0,0,0,1)"); g1.addColorStop(0.6, "rgba(0,0,0,.75)"); g1.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g1; lctx.beginPath(); lctx.moveTo(cx, sy);
    const pitch = clamp(s.vy / 320, -0.32, 0.32), a0 = (dir > 0 ? 0 : Math.PI) + pitch * dir;
    lctx.arc(cx, sy, len, a0 - 0.42, a0 + 0.42); lctx.closePath(); lctx.fill();
    const g2 = lctx.createRadialGradient(sx, sy, 0, sx, sy, 170 * k); g2.addColorStop(0, "rgba(0,0,0,.95)"); g2.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g2; lctx.beginPath(); lctx.arc(sx, sy, 170 * k, 0, 6.3); lctx.fill();
    const pr = (now - S.ripple) / 1400;
    if (pr >= 0 && pr < 1) {
      const RR = pr * 1400 * k, g3 = lctx.createRadialGradient(sx, sy, Math.max(0, RR - 90 * k), sx, sy, RR + 10);
      g3.addColorStop(0, "rgba(0,0,0,0)"); g3.addColorStop(0.7, `rgba(0,0,0,${0.7 * (1 - pr)})`); g3.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g3; lctx.beginPath(); lctx.arc(sx, sy, RR + 10, 0, 6.3); lctx.fill();
    }
    ctx.drawImage(light, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g4 = ctx.createRadialGradient(cx, sy, 0, cx, sy, len * 0.8); g4.addColorStop(0, "rgba(255,240,180,.10)"); g4.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = g4; ctx.beginPath(); ctx.moveTo(cx, sy); ctx.arc(cx, sy, len * 0.8, a0 - 0.38, a0 + 0.38); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = "rgba(220,240,255,.45)";
  for (const p of snow) {
    p.y += (p.v / VIEW_H) * 0.016; if (p.y > 1) { p.y = 0; p.x = Math.random(); }
    const x = ((p.x * w - cam.x * k * p.z * 0.6) % w + w) % w, y = ((p.y * h - cam.y * k * p.z * 0.6) % h + h) % h;
    ctx.globalAlpha = 0.25 + p.z * 0.4; ctx.beginPath(); ctx.arc(x, y, p.z * 1.8 * dpr, 0, 6.3); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const e of E) drawGlow(e, k, now);
  // 聲納現形：寶箱和水雷
  if (now < S.reveal) {
    const a = clamp((S.reveal - now) / 500, 0, 1);
    for (const e of E) {
      if (e.kind === "treasure") drawChest(e, k, a, true);
      else if (e.kind === "mine") { const [x, y] = W2S(e.x, e.y); ctx.strokeStyle = `rgba(255,90,60,${a})`; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(x, y, 44 * k, 0, 6.3); ctx.stroke(); }
    }
  }
  const pr = (now - S.ripple) / 1400;
  if (pr >= 0 && pr < 1) {
    ctx.strokeStyle = `rgba(110,240,255,${0.8 * (1 - pr)})`; ctx.lineWidth = 4 * k;
    for (const off of [0, 0.12]) { const RR = Math.max(0, pr - off) * 1400 * k; ctx.beginPath(); ctx.arc(sx, sy, RR, 0, 6.3); ctx.stroke(); }
  }
  for (const p of sparks) { const [x, y] = W2S(p.x, p.y); ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, 4 * k, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  const fl = (now - S.flash) / 350;
  if (fl >= 0 && fl < 1) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - fl)})`; ctx.fillRect(0, 0, w, h); }
  drawInstruments(w, h);
}
function drawInstruments(w, h) {
  const r = 58 * dpr, cx = w - r - 22 * dpr, cy = h - r - 22 * dpr, I = S.input;
  ctx.save();
  ctx.fillStyle = "rgba(6,28,46,.62)"; ctx.strokeStyle = "rgba(160,210,255,.25)"; ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(160,210,255,.15)"; ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  const tx = clamp((I.key.x ? I.key.x * 750 : I.rx) / 750, -1, 1), ty = clamp((I.key.y ? I.key.y * 750 : I.ry) / 750, -1, 1), inv = S.invertY ? -1 : 1;
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(cx + tx * r * 0.8, cy - ty * r * 0.8 * inv, 6 * dpr, 0, 6.3); ctx.fill();
  ctx.fillStyle = "#ffc94a"; ctx.beginPath(); ctx.arc(cx + I.sx * r * 0.8, cy - I.sy * r * 0.8 * inv, 9 * dpr, 0, 6.3); ctx.fill();
  ctx.fillStyle = "rgba(233,244,255,.8)"; ctx.font = `${12 * dpr}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("傾斜", cx, cy - r - 8 * dpr);
  if (S.radar) {
    const v = S.running ? signal() : 0, bx = cx - r * 2.9, by = cy + r * 0.6;
    ctx.fillText("雷達", bx + 50 * dpr, cy - r - 8 * dpr);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i < v + (v ? 1 : 0) ? "#ff5a5a" : "rgba(255,90,90,.18)"; ctx.fillRect(bx + i * 22 * dpr, by - (i + 1) * 18 * dpr, 16 * dpr, (i + 1) * 18 * dpr); }
  }
  ctx.restore();
  $("depth").textContent = depthNow;
}

// ---------------- 主迴圈 ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!$("game").hidden) {
    try { update(dt, now); draw(now); } catch (err) { console.error(err); }
  }
  requestAnimationFrame(frame);
}
function init() {
  buildWorld(); initEditor(); setStatus("off");
  addEventListener("resize", () => { if (!$("game").hidden) resize(); else Blockly.svgResize(ws); });
  $("connectBtn").onclick = () => (device && device.gatt.connected ? device.gatt.disconnect() : connect());
  $("backBtn").onclick = backToEditor; $("editBtn").onclick = backToEditor; $("againBtn").onclick = startGame;
  $("soundBtn").onclick = () => { S.sound = !S.sound; $("soundBtn").textContent = S.sound ? "音效 開" : "音效 關"; };
  $("invertY").onchange = (e) => { S.invertY = e.target.checked; };
  const keys = {};
  const upd = () => { S.input.key.x = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); S.input.key.y = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0); };
  addEventListener("keydown", (e) => {
    if ($("game").hidden) return;
    if (e.key === " ") { e.preventDefault(); if (!e.repeat) button(); return; }
    if (e.key === "Escape") { backToEditor(); return; }
    if (e.key.startsWith("Arrow")) { e.preventDefault(); keys[e.key] = true; upd(); }
  });
  addEventListener("keyup", (e) => { if (e.key.startsWith("Arrow")) { keys[e.key] = false; upd(); } });
  addEventListener("blur", () => { for (const k in keys) keys[k] = false; upd(); });
  hud(); requestAnimationFrame(frame);
}
window.LAB = { S, api, get E() { return E; }, get H() { return H; }, get ws() { return ws; }, TEMPLATES, loadTemplate, startGame, backToEditor, compileRules };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
