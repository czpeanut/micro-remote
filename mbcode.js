"use strict";
/*
 * mbcode.js — 主題1 第七、八堂：在網頁上寫 micro:bit 程式（不用 MakeCode、不用下載）
 *  積木長得和 MakeCode 中文版＋深海探險擴展一樣；程式在平板上跑，
 *  LED 和按鈕透過「接收端」（mbrun.js）控制真的 micro:bit，遊戲（聲納尋寶／深海探險）放在右邊。
 *  沒連 micro:bit 也能用畫面上的 LED 和 A、B 鈕試。
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const LESSON = /[?&]l=8/.test(location.search) ? 8 : 7;
  const C = { basic: "#1E90FF", input: "#D400D4", led: "#5C2D91", sea: "#0E7C86", logic: "#00A4A6", loops: "#00AA00", vars: "#DC143C", math: "#9400D3" };

  // ---------------- 圖示（和 MakeCode 一樣的 5×5） ----------------
  const R = (...rows) => rows.join("");
  const ICON = {
    Heart: R(".#.#.", "#####", "#####", ".###.", "..#.."), SmallHeart: R(".....", ".#.#.", ".###.", "..#..", "....."),
    Yes: R(".....", "....#", "...#.", "#.#..", ".#..."), No: R("#...#", ".#.#.", "..#..", ".#.#.", "#...#"),
    Happy: R(".....", ".#.#.", ".....", "#...#", ".###."), Sad: R(".....", ".#.#.", ".....", ".###.", "#...#"),
    Diamond: R("..#..", ".#.#.", "#...#", ".#.#.", "..#.."), SmallDiamond: R(".....", "..#..", ".#.#.", "..#..", "....."),
    Square: R("#####", "#...#", "#...#", "#...#", "#####"), SmallSquare: R(".....", ".###.", ".#.#.", ".###.", "....."),
    Skull: R(".###.", "#.#.#", "#####", ".###.", ".###."),
  };
  const ARROW = { North: R("..#..", ".###.", "#.#.#", "..#..", "..#.."), East: R("..#..", "...#.", "#####", "...#.", "..#.."),
    South: R("..#..", "..#..", "#.#.#", ".###.", "..#.."), West: R("..#..", ".#...", "#####", ".#...", "..#..") };
  const ICONS = [["愛心", "Heart"], ["小愛心", "SmallHeart"], ["打勾", "Yes"], ["打叉", "No"], ["笑臉", "Happy"], ["哭臉", "Sad"], ["鑽石", "Diamond"], ["小鑽石", "SmallDiamond"], ["正方形", "Square"], ["小正方形", "SmallSquare"], ["骷髏", "Skull"]];
  const fix = (s) => (s.length > 25 ? s.slice(0, 25) : s.padEnd(25, "."));
  const ICON_IMG = {}; // 下拉選單的小圖
  function iconThumb(pat) {
    if (ICON_IMG[pat]) return ICON_IMG[pat];
    const cv = document.createElement("canvas"); cv.width = cv.height = 30; const g = cv.getContext("2d");
    g.fillStyle = "#1b2b3a"; g.fillRect(0, 0, 30, 30);
    for (let i = 0; i < 25; i++) { g.fillStyle = fix(pat)[i] === "#" ? "#ff4d4d" : "#33485c"; g.fillRect(2 + (i % 5) * 5.4, 2 + Math.floor(i / 5) * 5.4, 4.4, 4.4); }
    return (ICON_IMG[pat] = cv.toDataURL());
  }

  // ---------------- 積木 ----------------
  const st = (type, msg, args, colour, tip) => ({ type, message0: msg, args0: args || [], previousStatement: null, nextStatement: null, inputsInline: true, colour, tooltip: tip || "" });
  const hat = (type, msg, args, colour, tip) => ({ type, message0: msg, args0: args || [], message1: "%1", args1: [{ type: "input_statement", name: "DO" }], colour, tooltip: tip || "" });
  const rep = (type, msg, args, colour, out, tip) => ({ type, message0: msg, args0: args || [], output: out || "Number", inputsInline: true, colour, tooltip: tip || "" });
  const num = (name) => ({ type: "input_value", name, check: "Number" });
  function defs() {
    return [
      hat("mb_start", "當啟動時", [], C.basic),
      hat("mb_forever", "重複無限次", [], C.basic),
      st("mb_icon", "顯示 圖示 %1", [{ type: "field_dropdown", name: "I", options: () => ICONS.map(([n, k]) => [{ src: iconThumb(ICON[k]), width: 30, height: 30, alt: n }, k]) }], C.basic),
      st("mb_arrow", "顯示 箭頭 %1", [{ type: "field_dropdown", name: "A", options: [["北 ↑", "North"], ["東 →", "East"], ["南 ↓", "South"], ["西 ←", "West"]] }], C.basic),
      st("mb_number", "顯示 數字 %1", [num("N")], C.basic),
      st("mb_string", "顯示 文字 %1", [{ type: "input_value", name: "T" }], C.basic),
      st("mb_clear", "清空 畫面", [], C.basic),
      st("mb_pause", "暫停 %1 毫秒", [num("MS")], C.basic),
      hat("mb_button", "當按鈕 %1 被按下", [{ type: "field_dropdown", name: "B", options: [["A", "A"], ["B", "B"], ["A+B", "AB"]] }], C.input),
      hat("mb_shake", "當 搖晃", [], C.input),
      rep("mb_accel", "加速度（mg） %1", [{ type: "field_dropdown", name: "D", options: [["x", "x"], ["y", "y"]] }], C.input),
      st("mb_plot", "點亮 x %1 y %2", [num("X"), num("Y")], C.led),
      st("mb_unplot", "熄滅 x %1 y %2", [num("X"), num("Y")], C.led),
      st("mb_plotb", "點亮 x %1 y %2 亮度 %3", [num("X"), num("Y"), num("V")], C.led),
      st("mb_bar", "顯示長條圖 %1 最大值 %2", [num("V"), num("H")], C.led),
      // 深海探險（和 MakeCode 擴展同一個名字）
      st("ds_start", "啟動潛艇遙控", [], C.sea),
      st("ds_tilt", "把傾斜傳給網頁", [], C.sea, "每 0.1 秒把傾斜的 x、y 傳給網頁"),
      st("ds_sea", "開進 10×10 大海（平板按鈕開）", [], C.sea),
      st("ds_hide", "把寶藏藏起來", [], C.sea),
      rep("ds_dist", "離寶藏的距離", [], C.sea),
      st("ds_radar", "顯示雷達", [], C.sea, "LED 變成雷達長條圖：越近越滿"),
      st("ds_beep", "開啟雷達嗶嗶聲（電腦發聲）", [], C.sea),
      hat("ds_found", "當找到寶藏", [], C.sea),
      hat("ds_onradar", "當收到網頁的雷達強度", [], C.sea),
      rep("ds_strength", "雷達強度", [], C.sea),
      st("ds_draw", "畫雷達 強度 %1", [num("N")], C.sea),
      hat("ds_onweb", "當網頁說 %1", [{ type: "field_dropdown", name: "M", options: [["找到寶藏", "g"], ["時間到", "e"]] }], C.sea),
      st("ds_ping", "發射聲納", [], C.sea),
    ];
  }
  function generators(G, O) {
    const f = G.forBlock, v = (b, n, d) => G.valueToCode(b, n, O.NONE) || d || "0", body = (b) => G.statementToCode(b, "DO");
    const ev = (name, arg) => (b) => `api.on(${JSON.stringify(name)}, ${arg ? JSON.stringify(arg) + ", " : ""}async () => {\n${body(b)}});\n`;
    f.mb_start = (b) => `api.on("start", async () => {\n${body(b)}});\n`;
    f.mb_forever = (b) => `api.forever(async () => {\n${body(b)}});\n`;
    f.mb_button = (b) => ev("btn", b.getFieldValue("B"))(b);
    f.mb_shake = ev("shake");
    f.ds_found = ev("found");
    f.ds_onradar = ev("radar");
    f.ds_onweb = (b) => ev("web", b.getFieldValue("M"))(b);
    f.mb_icon = (b) => `await api.icon(${JSON.stringify(b.getFieldValue("I"))});\n`;
    f.mb_arrow = (b) => `await api.arrow(${JSON.stringify(b.getFieldValue("A"))});\n`;
    f.mb_number = (b) => `await api.show(${v(b, "N")});\n`;
    f.mb_string = (b) => `await api.show(${v(b, "T", '""')});\n`;
    f.mb_clear = () => `api.clear();\n`;
    f.mb_pause = (b) => `await api.pause(${v(b, "MS")});\n`;
    f.mb_accel = (b) => [`api.accel(${JSON.stringify(b.getFieldValue("D"))})`, O.FUNCTION_CALL];
    f.mb_plot = (b) => `api.plot(${v(b, "X")}, ${v(b, "Y")}, 255);\n`;
    f.mb_unplot = (b) => `api.plot(${v(b, "X")}, ${v(b, "Y")}, 0);\n`;
    f.mb_plotb = (b) => `api.plot(${v(b, "X")}, ${v(b, "Y")}, ${v(b, "V")});\n`;
    f.mb_bar = (b) => `api.bar(${v(b, "V")}, ${v(b, "H")});\n`;
    f.ds_start = () => `api.dsStart();\n`;
    f.ds_tilt = () => `api.sendTilt();\n`;
    f.ds_sea = () => `api.buttonSea();\n`;
    f.ds_hide = () => `api.hideTreasure();\n`;
    f.ds_dist = () => [`api.distance()`, O.FUNCTION_CALL];
    f.ds_radar = () => `api.showRadar();\n`;
    f.ds_beep = () => `api.radarBeep();\n`;
    f.ds_strength = () => [`api.strength()`, O.FUNCTION_CALL];
    f.ds_draw = (b) => `api.drawRadar(${v(b, "N")});\n`;
    f.ds_ping = () => `api.ping();\n`;
    f.math_random_int = (b) => [`api.randint(${v(b, "FROM")}, ${v(b, "TO")})`, O.FUNCTION_CALL];
    G.INFINITE_LOOP_TRAP = "await api.tick();\n";
    G.addReservedWords("api");
  }
  function code(ws) {
    const G = javascript.javascriptGenerator; G.init(ws); const parts = [];
    for (const b of ws.getTopBlocks(true)) {
      if (!b.isEnabled() || b.isInsertionMarker()) continue;
      if (b.getInput("DO") && /^(mb_|ds_)/.test(b.type)) parts.push(G.blockToCode(b));
    }
    return G.finish(parts.join("\n"));
  }

  // ---------------- 工具箱 ----------------
  const B = (type, inputs) => ({ kind: "block", type, inputs });
  const N = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
  const SEA = LESSON === 7
    ? [B("ds_start"), B("ds_sea"), B("ds_hide"), B("ds_dist"), B("ds_beep"), B("ds_found")]
    : [B("ds_start"), B("ds_tilt"), B("ds_onradar"), B("ds_strength"), B("ds_draw", { N: N(2) }), B("ds_onweb"), B("ds_ping")];
  const TOOLBOX = { kind: "categoryToolbox", contents: [
    { kind: "category", name: "基本", colour: C.basic, contents: [B("mb_start"), B("mb_forever"), B("mb_icon"), B("mb_arrow"), B("mb_number", { N: N(0) }), B("mb_string", { T: { shadow: { type: "text", fields: { TEXT: "Hi" } } } }), B("mb_clear"), B("mb_pause", { MS: N(100) })] },
    { kind: "category", name: "輸入", colour: C.input, contents: [B("mb_button"), B("mb_shake"), B("mb_accel")] },
    { kind: "category", name: "LED", colour: C.led, contents: [B("mb_plot", { X: N(0), Y: N(0) }), B("mb_unplot", { X: N(0), Y: N(0) }), B("mb_plotb", { X: N(0), Y: N(0), V: N(255) }), B("mb_bar", { V: N(0), H: N(10) })] },
    { kind: "category", name: "深海探險", colour: C.sea, contents: SEA },
    { kind: "category", name: "邏輯", colour: C.logic, contents: [B("controls_if"), { kind: "block", type: "controls_if", extraState: { hasElse: true } }, { kind: "block", type: "controls_if", extraState: { elseIfCount: 1, hasElse: true } }, B("logic_compare", { A: N(0), B: N(0) }), B("logic_operation"), B("logic_negate"), B("logic_boolean")] },
    { kind: "category", name: "迴圈", colour: C.loops, contents: [B("controls_repeat_ext", { TIMES: N(4) }), B("controls_whileUntil")] },
    { kind: "category", name: "變數", colour: C.vars, custom: "VARIABLE" },
    { kind: "category", name: "數學", colour: C.math, contents: [B("math_number"), B("math_arithmetic", { A: N(0), B: N(0) }), B("math_random_int", { FROM: N(0), TO: N(10) }), B("math_constrain", { VALUE: N(0), LOW: N(0), HIGH: N(10) }), { kind: "block", type: "math_single", fields: { OP: "ABS" }, inputs: { NUM: N(0) } }] },
  ] };

  // ---------------- 參考解答 ----------------
  const cmp = (op, n) => `<block type="logic_compare"><field name="OP">${op}</field><value name="A"><shadow type="math_number"><field name="NUM">0</field></shadow><block type="ds_dist"></block></value><value name="B"><shadow type="math_number"><field name="NUM">${n}</field></shadow></value></block>`;
  const ANSWER = LESSON === 7 ? `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="mb_start" x="20" y="20"><statement name="DO"><block type="ds_start"><next><block type="ds_sea"><next><block type="ds_hide"><next><block type="ds_beep"></block></next></block></next></block></next></block></statement></block>
  <block type="mb_forever" x="20" y="250"><statement name="DO"><block type="controls_if"><mutation elseif="1" else="1"></mutation><value name="IF0">${cmp("LT", 3)}</value><statement name="DO0"><block type="mb_icon"><field name="I">Heart</field></block></statement><value name="IF1">${cmp("LT", 6)}</value><statement name="DO1"><block type="mb_icon"><field name="I">SmallHeart</field></block></statement><statement name="ELSE"><block type="mb_clear"></block></statement></block></statement></block>
  <block type="ds_found" x="20" y="560"><statement name="DO"><block type="mb_icon"><field name="I">Diamond</field></block></statement></block>
</xml>` : `<xml xmlns="https://developers.google.com/blockly/xml">
  <variables><variable id="score">分數</variable></variables>
  <block type="mb_start" x="20" y="20"><statement name="DO"><block type="ds_start"><next><block type="ds_tilt"></block></next></block></statement></block>
  <block type="ds_onradar" x="20" y="210"><statement name="DO"><block type="ds_draw"><value name="N"><shadow type="math_number"><field name="NUM">2</field></shadow><block type="ds_strength"></block></value></block></statement></block>
  <block type="ds_onweb" x="20" y="340"><field name="M">g</field><statement name="DO"><block type="math_change"><field name="VAR" id="score">分數</field><value name="DELTA"><shadow type="math_number"><field name="NUM">1</field></shadow></value><next><block type="mb_icon"><field name="I">Diamond</field></block></next></block></statement></block>
  <block type="ds_onweb" x="20" y="520"><field name="M">e</field><statement name="DO"><block type="mb_number"><value name="N"><shadow type="math_number"><field name="NUM">0</field></shadow><block type="variables_get"><field name="VAR" id="score">分數</field></block></value></block></statement></block>
  <block type="mb_button" x="20" y="660"><field name="B">A</field><statement name="DO"><block type="ds_ping"></block></statement></block>
</xml>`;

  // ---------------- 執行 ----------------
  class Stop extends Error {}
  const run = { id: 0, handlers: {}, loops: [], err: null };
  const sea = { on: false, size: 5, x: 0, y: 0, tx: 0, ty: 0, busy: false, radar: false, beep: null, strength: 0, tiltOn: false };
  const leds = new Array(25).fill(0);
  let tilt = { x: 0, y: 0 }, showing = 0;
  function draw() { MBRun.setLeds(leds); renderLeds(); }
  function setPat(p) { p = fix(p); for (let i = 0; i < 25; i++) leds[i] = p[i] === "#" ? 255 : 0; draw(); }
  function toGame(text) { const fr = $("game"); if (fr && fr.contentWindow) fr.contentWindow.postMessage({ kd: "fromMb", text }, "*"); }
  const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));

  function makeApi(id) {
    const alive = () => { if (id !== run.id) throw new Stop(); };
    const sleep = (ms) => new Promise((res, rej) => setTimeout(() => (id === run.id ? res() : rej(new Stop())), Math.max(0, ms)));
    const call = (fn) => fn().catch((e) => { if (!(e instanceof Stop)) fail(e); });
    const api = {
      on(kind, a, b) { const fn = b || a, key = b ? kind + ":" + a : kind; (run.handlers[key] = run.handlers[key] || []).push(() => call(fn)); },
      forever(fn) { run.loops.push(async () => { while (true) { alive(); await fn(); await sleep(20); } }); },
      async tick() { alive(); await sleep(0); },
      async pause(ms) { alive(); await sleep(Number(ms) || 0); },
      async icon(k) { alive(); setPat(ICON[k] || ""); await sleep(400); },
      async arrow(k) { alive(); setPat(ARROW[k] || ""); await sleep(400); },
      async show(t) {
        alive(); const s = String(t); if (s.length === 1 && /\d/.test(s)) { setPat(DIGIT[s]); await sleep(400); return; }
        const ms = (s.length + 1) * 900; MBRun.scroll(s, ms); showing = performance.now() + ms; scrollLocal(s, ms); await sleep(ms); },
      clear() { leds.fill(0); draw(); },
      plot(x, y, b) { x = Math.round(x); y = Math.round(y); if (x < 0 || x > 4 || y < 0 || y > 4) return; leds[y * 5 + x] = clampI(b, 0, 255); draw(); },
      bar(v, h) { bar(Math.abs(Number(v) || 0), Number(h) || 1); },
      accel: (d) => (d === "x" ? tilt.x : tilt.y),
      randint: (a, b) => { a = Math.round(a); b = Math.round(b); if (a > b) [a, b] = [b, a]; return a + Math.floor(Math.random() * (b - a + 1)); },
      // 深海探險
      dsStart() {},
      sendTilt() { sea.tiltOn = true; MBRun.tilt(true); },
      buttonSea() { sea.on = true; sea.size = 10; sea.x = 5; sea.y = 5; toGame(`x:${sea.x}#y:${sea.y}#`); },
      hideTreasure() { sea.tx = api.randint(0, 9); sea.ty = api.randint(0, 9); },
      distance: () => Math.abs(sea.x - sea.tx) + Math.abs(sea.y - sea.ty),
      showRadar() { sea.radar = true; },
      radarBeep() { sea.beep = true; },
      strength: () => sea.strength,
      drawRadar(n) { sea.radar = false; bar(Math.abs(Number(n) || 0), 4); },
      ping() { toGame("p#"); },
    };
    return api;
  }
  const DIGIT = { 0: R(".##..", "#..#.", "#..#.", "#..#.", ".##.."), 1: R("..#..", ".##..", "..#..", "..#..", ".###."), 2: R("###..", "...#.", ".##..", "#....", "####."),
    3: R("####.", "...#.", "..#..", "#..#.", ".##.."), 4: R("..##.", ".#.#.", "#..#.", "####.", "...#."), 5: R("####.", "#....", "###..", "...#.", "###.."),
    6: R("...#.", "..#..", ".###.", "#...#", ".###."), 7: R("#####", "...#.", "..#..", ".#...", "#...."), 8: R(".###.", "#...#", ".###.", "#...#", ".###."), 9: R(".###.", "#...#", ".###.", "..#..", ".#...") };
  function bar(v, h) {  // 和 MakeCode 的長條圖一樣：從下面一列一列亮上去
    const n = Math.round(Math.min(1, v / (h || 1)) * 25); leds.fill(0);
    for (let k = 0; k < n; k++) { const row = 4 - Math.floor(k / 5), col = k % 5; leds[row * 5 + col] = 255; }
    draw();
  }
  function scrollLocal(s, ms) { $("ledText").textContent = s; $("ledText").hidden = false; clearTimeout(scrollLocal.t); scrollLocal.t = setTimeout(() => ($("ledText").hidden = true), ms); }
  function fire(key) { (run.handlers[key] || []).forEach((h) => h()); }
  function fail(e) { run.err = e; $("err").hidden = false; $("err").textContent = "程式出錯了：" + (e && e.message || e); console.error(e); }

  // 遊戲（iframe）傳來的訊息
  let seaTimer = 0;
  window.addEventListener("message", (e) => {
    const d = e.data; if (!d || d.kd !== "toMb") return;
    const w = String(d.word).trim(); if (!w) return;
    if (LESSON === 7 && sea.on && "fblr".includes(w) && w.length === 1) {
      if (w === "f") sea.y--; else if (w === "b") sea.y++; else if (w === "l") sea.x--; else sea.x++;
      sea.x = clampI(sea.x, 0, sea.size - 1); sea.y = clampI(sea.y, 0, sea.size - 1);
      toGame(`x:${sea.x}#y:${sea.y}#`);
      if (api0 && api0.distance() === 0 && !sea.busy) {
        sea.busy = true; toGame("found#"); fire("found");
        setTimeout(() => { api0.hideTreasure(); sea.busy = false; }, 900);
      }
    } else if (LESSON === 8) {
      if (w === "g") fire("web:g"); else if (w === "e") fire("web:e");
      else if (/^-?[\d.]+$/.test(w)) { sea.strength = Number(w); fire("radar"); }
    }
  });
  let api0 = null;
  function start() {
    stop(); $("err").hidden = true;
    const id = ++run.id; run.handlers = {}; run.loops = []; run.err = null;
    Object.assign(sea, { on: false, size: 5, x: 0, y: 0, busy: false, radar: false, beep: null, strength: 0, tiltOn: false });
    leds.fill(0); draw(); MBRun.tilt(false);
    const api = (api0 = makeApi(id));
    let src;
    try { src = code(ws); } catch (e) { fail(e); return; }
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
    let fn; try { fn = new AsyncFn("api", src); } catch (e) { fail(e); return; }
    fn(api).then(async () => {
      for (const h of run.handlers.start || []) await h();
      run.loops.forEach((L) => L().catch((e) => { if (!(e instanceof Stop)) fail(e); }));
    }).catch((e) => { if (!(e instanceof Stop)) fail(e); });
    $("runBtn").textContent = "↻ 重新執行"; $("cover").hidden = true;
    clearInterval(seaTimer);
    seaTimer = setInterval(() => {   // 雷達長條圖、雷達嗶嗶聲（和擴展一樣每 0.3 秒）
      if (id !== run.id) return;
      if (sea.radar && !sea.busy && performance.now() > showing) bar(Math.max(0, Math.min(10, 10 - api.distance())), 10);
      if (sea.beep && !sea.busy) toGame(`d:${api.distance()}#`);
    }, 300);
  }
  function stop() { run.id++; clearInterval(seaTimer); MBRun.tilt(false); }

  // ---------------- 畫面上的 micro:bit ----------------
  function renderLeds() {
    const cells = $("leds").children;
    for (let i = 0; i < 25; i++) { const v = leds[i] / 255; cells[i].style.background = v > 0 ? `rgba(255,${60 + 40 * (1 - v)},${60},${0.25 + 0.75 * v})` : "#33485c"; cells[i].style.boxShadow = v > 0.3 ? `0 0 ${6 * v}px #ff5252` : "none"; }
  }
  MBRun.on("event", (k, x, y) => {
    if (k === "T") { tilt = { x, y }; if (sea.tiltOn) toGame(`x:${x}#y:${y}#`); return; }
    if (k === "A" || k === "B" || k === "AB") fire("btn:" + k);
    else if (k === "G") fire("shake");
  });
  const STEPS = { off: 1, wait: 1, old: 1, switching: 2, reconnect: 2, ready: 3 };
  MBRun.on("state", (s, note, name) => {
    $("mbState").textContent = s === "ready" ? `已就緒（${name || "micro:bit"}）` : note || "未連接";
    $("mbState").className = "mbstate " + (s === "ready" ? "ok" : s === "old" ? "bad" : s === "off" ? "" : "wait");
    $("connBtn").textContent = s === "ready" ? "中斷連接" : "連接 micro:bit";
    $("byeBtn").hidden = s !== "ready";
    document.querySelectorAll(".steps li").forEach((li, i) => { li.className = i + 1 < STEPS[s] ? "done" : i + 1 === STEPS[s] && s !== "off" ? "now" : ""; });
    if (s === "ready") $("steps").querySelectorAll("li").forEach((li) => (li.className = "done"));
  });

  // ---------------- 介面 ----------------
  let ws;
  const KEY = `kd_mbcode_l${LESSON}`;
  function init() {
    Object.assign(Blockly.Msg, {
      LOGIC_OPERATION_AND: "且", LOGIC_OPERATION_OR: "或", VARIABLES_SET: "變數 %1 設為 %2", MATH_CHANGE_TITLE: "變數 %1 改變 %2",
      CONTROLS_IF_MSG_THEN: "那麼", CONTROLS_IF_MSG_ELSE: "否則", CONTROLS_IF_MSG_ELSEIF: "否則如果", CONTROLS_REPEAT_TITLE: "重複 %1 次",
      CONTROLS_REPEAT_INPUT_DO: "執行", MATH_RANDOM_INT_TITLE: "隨機取數 %1 到 %2", MATH_CONSTRAIN_TITLE: "制限 %1 最低 %2 最高 %3", NEW_VARIABLE: "建立變數…",
    });
    Blockly.common.defineBlocksWithJsonArray(defs());
    generators(javascript.javascriptGenerator, javascript.Order);
    // 內建積木的顏色和 MakeCode 一樣（Blockly 11 用主題設定）
    const theme = Blockly.Theme.defineTheme("kdmb", { base: Blockly.Themes.Classic, blockStyles: {
      logic_blocks: { colourPrimary: C.logic }, loop_blocks: { colourPrimary: C.loops }, math_blocks: { colourPrimary: C.math },
      variable_blocks: { colourPrimary: C.vars }, variable_dynamic_blocks: { colourPrimary: C.vars }, text_blocks: { colourPrimary: "#B8860B" } } });
    ws = Blockly.inject("blockly", { theme, toolbox: TOOLBOX, renderer: "zelos", trashcan: true, sounds: false, media: "vendor/blockly/media/", zoom: { controls: true, startScale: 0.8, wheel: true }, move: { scrollbars: true, drag: true, wheel: true } });
    const answer = /[?&]answer=1/.test(location.search);
    let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    const load = (xml) => Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws);
    if (answer) { load(ANSWER); ws.cleanUp(); }
    else if (saved) { try { Blockly.serialization.workspaces.load(JSON.parse(saved), ws); } catch (e) { load('<xml><block type="mb_start" x="20" y="20"></block></xml>'); } }
    else load('<xml><block type="mb_start" x="20" y="20"></block></xml>');
    let t = 0;
    ws.addChangeListener((e) => {
      if (e.isUiEvent) return;
      clearTimeout(t); t = setTimeout(() => {
        try { localStorage.setItem(KEY, JSON.stringify(Blockly.serialization.workspaces.save(ws))); } catch (er) {}
        if ($("autoRun").checked && $("cover").hidden) start();
      }, 700);
    });
    const ledBox = $("leds"); for (let i = 0; i < 25; i++) ledBox.appendChild(document.createElement("i"));
    renderLeds();
    $("runBtn").onclick = start; $("coverRun").onclick = start;
    $("stopBtn").onclick = () => { stop(); leds.fill(0); draw(); $("runBtn").textContent = "▶ 執行"; };
    $("connBtn").onclick = () => MBRun.connect();
    $("byeBtn").onclick = () => MBRun.release();
    document.querySelectorAll("[data-btn]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); fire(b.dataset.btn === "G" ? "shake" : "btn:" + b.dataset.btn); }));
    $("resetBtn").onclick = () => { if (confirm("清掉現在的積木，重新開始？")) { ws.clear(); load('<xml><block type="mb_start" x="20" y="20"></block></xml>'); } };
    $("game").src = (LESSON === 7 ? "sonar.html" : "sub.html") + "?bridge=1";
    $("title").textContent = LESSON === 7 ? "第七堂 聲納雷達" : "第八堂 雙屏尋寶";
    // 遊戲用 1024×768 的大小畫，再縮小放進右邊的框（字和按鈕的比例才不會擠在一起）
    const fit = () => { const box = $("game").parentElement, k = box.clientWidth / 1024; $("game").style.transform = `scale(${k})`; };
    fit(); window.addEventListener("resize", () => { Blockly.svgResize(ws); fit(); });
    $("bigBtn").onclick = () => { document.body.classList.toggle("big"); $("bigBtn").textContent = document.body.classList.contains("big") ? "縮小遊戲" : "放大遊戲"; setTimeout(() => { Blockly.svgResize(ws); fit(); }, 50); };
  }
  window.MBCode = { start, stop, get ws() { return ws; }, code: () => code(ws), leds, sea, fire, LESSON };
  init();
})();
