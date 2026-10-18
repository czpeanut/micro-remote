"use strict";
/*
 * rulelab.js — 主題2 遊戲共用的「規則積木」機制
 *  每個遊戲頁面呼叫 RuleLab.create({...}) 就多一個「規則實驗室」：
 *  先用積木寫規則 → 按「開始遊戲」→ 遊戲照著規則跑。
 *  Blockly 只有在打開規則實驗室時才載入，一般玩法完全不受影響。
 *  （深海規則實驗室 lab.html 是獨立的舊頁面，不使用這個檔案。）
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
  const fmt = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v));
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  /* ---------- 共用積木 ---------- */
  const C = { ev: "#8a5cf6", game: "#e5624e", fx: "#2fa66a" };
  const hat = (type, msg, args, tip, colour) => ({ type, message0: msg + " %" + (args.length + 1) + " %" + (args.length + 2),
    args0: [...args, { type: "input_dummy" }, { type: "input_statement", name: "DO" }], colour: colour || C.ev, tooltip: tip || "" });
  const act = (type, msg, args, colour, tip) => ({ type, message0: msg, args0: args, previousStatement: null, nextStatement: null, inputsInline: true, colour, tooltip: tip || "" });
  const val = (type, msg, args, colour, tip, out) => ({ type, message0: msg, args0: args, output: out === undefined ? "Number" : out, colour, tooltip: tip || "" });
  const dd = (name, options) => ({ type: "field_dropdown", name, options });
  const vin = (name, check) => ({ type: "input_value", name, check });
  const fnum = (name, value, min, max, precision) => ({ type: "field_number", name, value, min, max, precision });
  const ftxt = (name, text) => ({ type: "field_input", name, text });
  const SOUNDS = [["叮", "ding"], ["吃到", "eat"], ["嗶", "beep"], ["撞擊", "bump"], ["爆炸", "boom"], ["加油", "cheer"], ["勝利", "win"], ["失敗", "lose"]];
  const COMMON = [
    hat("rl_start", "當遊戲開始", [], "按下「開始遊戲」時執行一次"),
    hat("rl_every", "每隔 %1 秒", [fnum("SEC", 2, 0.5, 600, 0.5)], "遊戲進行中，每隔幾秒執行一次（最少 0.5 秒）"),
    hat("rl_score", "當分數達到 %1", [fnum("N", 10)], "分數第一次到達這個數字時執行"),
    hat("rl_timeup", "當倒數時間到", [], "倒數歸零時執行；沒有這個積木時，時間到就結束遊戲"),
    hat("rl_lives0", "當生命用完", [], "生命變成 0 時執行；沒有這個積木時，就直接遊戲失敗"),
    hat("rl_msg", "當收到 micro:bit 訊息 %1", [ftxt("TEXT", "a")], "micro:bit 用藍牙傳來這個文字（加 #）時執行"),
    act("rl_score_change", "分數改變 %1", [vin("N", "Number")], C.game),
    act("rl_score_set", "分數設為 %1", [vin("N", "Number")], C.game),
    val("rl_score_get", "分數", [], C.game),
    act("rl_time_set", "倒數計時 %1 秒", [vin("N", "Number")], C.game, "開始倒數，畫面上會出現時間"),
    act("rl_time_add", "時間增加 %1 秒", [vin("N", "Number")], C.game),
    val("rl_time_get", "剩下的時間", [], C.game),
    act("rl_lives_set", "生命設為 %1", [vin("N", "Number")], C.game, "畫面上會出現生命"),
    act("rl_lives_change", "生命改變 %1", [vin("N", "Number")], C.game),
    val("rl_lives_get", "生命", [], C.game),
    act("rl_stat", "在畫面顯示 %1 %2", [ftxt("LABEL", "紀錄"), vin("V")], C.game, "在上方多一個數字框（最多 4 個）"),
    act("rl_win", "遊戲成功 顯示 %1", [vin("T")], C.game),
    act("rl_lose", "遊戲失敗 顯示 %1", [vin("T")], C.game),
    act("rl_say", "說 %1", [vin("T")], C.fx),
    act("rl_sound", "播放音效 %1", [dd("S", SOUNDS)], C.fx),
    act("rl_send", "傳送給 micro:bit %1", [vin("T")], C.fx, "會自動在後面加 #"),
    val("rl_mbval", "micro:bit 傳來的 %1", [ftxt("KEY", "d")], C.fx, "micro:bit 用「寫入數值」傳來的最新數字，例如 d、x、k"),
  ];
  const COMMON_HATS = ["rl_start", "rl_every", "rl_score", "rl_timeup", "rl_lives0", "rl_msg"];

  /* ---------- 範例規則 XML 小工具 ---------- */
  const X = (() => {
    const seq = (list) => list.filter(Boolean).reduceRight((acc, b) => (acc ? b.replace(/<\/block>$/, `<next>${acc}</next></block>`) : b), "");
    const B = (type, fields = {}, values = {}, stmts = {}, extra = "") =>
      `<block type="${type}">${extra}` +
      Object.entries(fields).map(([k, x]) => `<field name="${k}">${esc(x)}</field>`).join("") +
      Object.entries(values).map(([k, x]) => `<value name="${k}">${x}</value>`).join("") +
      Object.entries(stmts).map(([k, x]) => `<statement name="${k}">${seq(x)}</statement>`).join("") + `</block>`;
    const N = (v) => `<shadow type="math_number"><field name="NUM">${v}</field></shadow>`;
    const T = (s) => `<shadow type="text"><field name="TEXT">${esc(s)}</field></shadow>`;
    const H = (type, fields, body) => ({ type, fields, body });
    const xml = (hats) => `<xml xmlns="https://developers.google.com/blockly/xml">${hats.map((h, i) =>
      B(h.type, h.fields || {}, {}, { DO: h.body }).replace(`<block type="${h.type}">`, `<block type="${h.type}" x="${20 + i * 30}" y="${20 + i * 60}">`)).join("")}</xml>`;
    const vget = (name) => B("variables_get", { VAR: name });
    const num_ = (n) => B("math_number", { NUM: n });
    return {
      seq, B, N, T, H, xml, vget, num: num_,
      cmp: (a, op, b) => B("logic_compare", { OP: op }, { A: a, B: b }),
      and: (a, b) => B("logic_operation", { OP: "AND" }, { A: a, B: b }),
      arith: (a, op, b) => B("math_arithmetic", { OP: op }, { A: a, B: b }),
      rand: (a, b) => B("math_random_int", {}, { FROM: N(a), TO: N(b) }),
      ifThen: (cond, then, els) => B("controls_if", {}, { IF0: cond }, els ? { DO0: then, ELSE: els } : { DO0: then }, els ? '<mutation else="1"></mutation>' : ""),
      set: (name, value) => B("variables_set", { VAR: name }, { VALUE: value }),
      change: (name, n) => B("math_change", { VAR: name }, { DELTA: N(n) }),
      score: (n) => B("rl_score_change", {}, { N: N(n) }),
      scoreV: (v) => B("rl_score_change", {}, { N: v }),
      scoreGet: () => B("rl_score_get"),
      time: (n) => B("rl_time_set", {}, { N: N(n) }),
      lives: (n) => B("rl_lives_set", {}, { N: N(n) }),
      livesC: (n) => B("rl_lives_change", {}, { N: N(n) }),
      stat: (label, v) => B("rl_stat", { LABEL: label }, { V: v }),
      win: (s) => B("rl_win", {}, { T: T(s) }),
      lose: (s) => B("rl_lose", {}, { T: T(s) }),
      say: (s) => B("rl_say", {}, { T: T(s) }),
      sayV: (v) => B("rl_say", {}, { T: v }),
      join: (a, b) => B("text_join", {}, { ADD0: a, ADD1: b }, {}, '<mutation items="2"></mutation>'),
      text: (s) => B("text", { TEXT: s }),
      sound: (s) => B("rl_sound", { S: s }),
      send: (s) => B("rl_send", {}, { T: T(s) }),
    };
  })();

  /* ---------- Blockly 延遲載入 ---------- */
  let blocklyP = null;
  function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("載入失敗 " + src)); document.head.appendChild(s); }); }
  function loadBlockly() {
    if (window.Blockly && window.javascript) return Promise.resolve();
    if (!blocklyP) blocklyP = ["blockly_compressed.js", "blocks_compressed.js", "javascript_compressed.js", "msg/zh-hant.js"]
      .reduce((p, f) => p.then(() => loadScript("vendor/blockly/" + f)), Promise.resolve());
    return blocklyP;
  }

  /* ---------- 音效 ---------- */
  const T = (...a) => window.SFX && SFX.tone(...a);
  const SND = {
    ding() { T(880, 1320, 0.18, "triangle", 0.16); T(1320, 1760, 0.22, "triangle", 0.14, 0.09); },
    eat() { T(300, 900, 0.14, "sine", 0.2); },
    beep() { T(660, 660, 0.12, "square", 0.08); },
    bump() { T(120, 50, 0.35, "sawtooth", 0.12); },
    boom() { window.SFX && SFX.noise(0.7, 0.5, 700); T(90, 35, 0.6, "sine", 0.3); },
    cheer() { window.SFX && SFX.noise(1.6, 0.22, 2200, 0, "bandpass"); },
    win() { [523, 659, 784, 1046].forEach((f, i) => T(f, f * 1.01, 0.3, "triangle", 0.16, i * 0.11)); },
    lose() { [523, 440, 349, 262].forEach((f, i) => T(f, f * 0.98, 0.35, "triangle", 0.14, i * 0.16)); },
  };

  /* =====================================================================
   * RuleLab.create(cfg)
   *  cfg.id        儲存用代號
   *  cfg.title     例如「太空梭規則實驗室」
   *  cfg.blocks    遊戲專屬積木 JSON
   *  cfg.hats      遊戲專屬事件積木 type
   *  cfg.gens(F,h) 遊戲專屬積木的程式產生器
   *  cfg.toolbox(h) 回傳遊戲專屬分類 [{name, colour, contents}]
   *  cfg.templates(X) 回傳範例 [{id, name, xml}]
   *  cfg.api       遊戲專屬 api 函式（積木只能呼叫 api.xxx）
   *  cfg.evNames   事件名稱（錯誤訊息用）
   *  cfg.tip       編輯畫面右上角說明 HTML
   *  cfg.onPlay()  開始用規則玩：遊戲重設並進入 lab 模式
   *  cfg.onStop()  離開 lab 模式（停止遊戲）
   * ===================================================================== */
  function create(cfg) {
    const STORE = "rulelab." + cfg.id + ".v1";
    const R = { ws: null, G: null, H: [], running: false, score: 0, left: 0, timeOn: false, lives: 0, livesOn: false, stats: new Map(),
      mb: {}, title: cfg.title, depth: 0, errT: 0, ready: false, templates: [] };
    const api = Object.assign({
      _loop: 0, _it: null,
      on(ev, arg, fn) { if (typeof fn === "function" && R.H.length < 200) R.H.push({ ev, arg, fn, acc: 0, err: 0, off: false }); },
      addScore(n) { setScore(R.score + num(n)); },
      setScore(n) { setScore(num(n)); },
      getScore() { return R.score; },
      setTime(n) { R.left = clamp(num(n), 0, 3600); R.timeOn = R.left > 0; hud(); },
      addTime(n) { if (R.timeOn) { R.left = clamp(R.left + num(n), 0, 3600); hud(); } },
      getTime() { return R.timeOn ? Math.ceil(R.left) : 0; },
      setLives(n) { setLives(num(n)); },
      addLives(n) { setLives((R.livesOn ? R.lives : 0) + num(n)); },
      getLives() { return R.lives; },
      stat(label, v) {
        label = String(label).slice(0, 8) || "數值";
        if (!R.stats.has(label) && R.stats.size >= 4) return;
        R.stats.set(label, typeof v === "number" ? Math.round(v * 10) / 10 : String(v).slice(0, 8)); hud();
      },
      win(t) { end(true, String(t || "成功！")); },
      lose(t) { end(false, String(t || "失敗")); },
      say(t) { toast(String(t).slice(0, 40)); },
      sound(n) { (SND[n] || SND.beep)(); },
      send(t) { const s = String(t).replace(/#/g, "").slice(0, 18); if (s && window.MB) MB.send(s); },
      mbval(k) { return num(R.mb[String(k).toLowerCase()]); },
    }, cfg.api || {});

    /* ---------- 介面 ---------- */
    function buildDom() {
      if ($("rlEditor")) return;
      const ed = document.createElement("section"); ed.id = "rlEditor"; ed.hidden = true;
      ed.innerHTML = `
        <div class="bar">
          <a class="kd-home-inline" href="index.html" title="回到酷丁狐的科技實驗室"><span class="kd-logo" aria-hidden="true"></span></a>
          <div class="brand"><b>${esc(cfg.title)}</b><small>先寫規則，再開始遊戲</small></div>
          <select class="btn ghost" id="rlTpl" title="範例規則"></select>
          <button class="btn ghost" id="rlNew">新的</button>
          <button class="btn ghost" id="rlSave">儲存檔案</button>
          <button class="btn ghost" id="rlOpen">開啟檔案</button>
          <input type="file" id="rlFile" accept=".json,application/json" hidden />
          <span class="grow"></span>
          <span class="dot" id="rlDot"></span><span class="status" id="rlStatus">未連接</span>
          <button class="btn" id="rlConnect">連接 micro:bit</button>
          <button class="btn ghost" id="rlMenu">回到選單</button>
          <button class="btn primary" id="rlPlay">開始遊戲</button>
        </div>
        <div class="work"><div id="rlBlockly"></div>
          <div class="tip" id="rlTip"><span class="x" id="rlTipX">×</span>${cfg.tip || ""}<br>規則會自動保存在這台電腦。</div>
          <div class="check" id="rlCheck" hidden></div>
          <div class="rl-loading" id="rlLoading">積木載入中…</div>
        </div>`;
      document.body.appendChild(ed);
      const ov = document.createElement("div"); ov.className = "overlay"; ov.id = "rlEnd"; ov.hidden = true;
      ov.innerHTML = `<div class="card result"><h1 id="rlEndTitle">遊戲結束</h1><p class="sub" id="rlEndText"></p><div class="big" id="rlEndScore">0</div>
        <div class="row"><button class="btn primary" id="rlAgain">再玩一次</button><button class="btn" id="rlEdit">回到規則編輯</button></div></div>`;
      document.body.appendChild(ov);
      const bk = document.createElement("button"); bk.className = "btn rl-back"; bk.id = "rlBack"; bk.textContent = "規則"; bk.title = "回到規則編輯"; bk.hidden = true;
      document.body.appendChild(bk);
      const err = document.createElement("div"); err.className = "rl-errs"; err.id = "rlErrs"; err.hidden = true; document.body.appendChild(err);
      const center = document.querySelector(".hud .center");
      const st = document.createElement("div"); st.className = "stats rl-stats"; st.id = "rlStats";
      if (center) center.appendChild(st); else { st.classList.add("rl-float"); document.body.appendChild(st); }

      $("rlTipX").onclick = () => ($("rlTip").hidden = true);
      $("rlMenu").onclick = () => { closeEditor(); cfg.onMenu && cfg.onMenu(); };
      $("rlPlay").onclick = () => play();
      $("rlAgain").onclick = () => play();
      $("rlEdit").onclick = () => openEditor();
      $("rlBack").onclick = () => openEditor();
      $("rlConnect").onclick = () => { if (window.MB) MB.connect(); };
      $("rlNew").onclick = () => loadTemplate("free");
      $("rlOpen").onclick = () => $("rlFile").click();
      $("rlSave").onclick = () => {
        const data = JSON.stringify({ app: "rulelab-" + cfg.id, title: R.title, blocks: Blockly.serialization.workspaces.save(R.ws) }, null, 1);
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
        a.download = `${cfg.title}-${R.title || "我的規則"}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      $("rlFile").onchange = async (e) => {
        const f = e.target.files[0]; e.target.value = ""; if (!f) return;
        try { const d = JSON.parse(await f.text()); R.ws.clear(); Blockly.serialization.workspaces.load(d.blocks || d, R.ws); R.title = d.title || "我的規則"; arrange(); info(`已開啟：${f.name}`); }
        catch (err) { info("這個檔案打不開，請選擇「儲存檔案」存下來的 .json", true); }
      };
      // 連線狀態同步
      setInterval(() => {
        const on = window.MB && MB.connected && MB.connected();
        $("rlDot").className = "dot" + (on ? " on" : ""); $("rlStatus").textContent = on ? "已連接" : "未連接";
        $("rlConnect").textContent = on ? "中斷連接" : "連接 micro:bit";
      }, 700);
    }
    function info(t, bad) {
      const el = $("rlCheck"); el.textContent = t; el.hidden = false; el.style.background = bad ? "#7a1f2b" : "#0d5b78"; el.style.color = "#fff";
      clearTimeout(info.t); info.t = setTimeout(() => (el.hidden = true), 2600);
    }
    function toast(t) {
      const el = $("toast"); if (!el) return; el.textContent = t; el.classList.add("show");
      clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1700);
    }
    function showErr(t) { const el = $("rlErrs"); el.textContent = t; el.hidden = false; clearTimeout(R.errT); R.errT = setTimeout(() => (el.hidden = true), 4000); }

    /* ---------- 編輯器 ---------- */
    function helpers() {
      const n = (v) => ({ shadow: { type: "math_number", fields: { NUM: v } } });
      const t = (s) => ({ shadow: { type: "text", fields: { TEXT: s } } });
      const b = (type, inputs, extra) => Object.assign({ kind: "block", type }, inputs ? { inputs } : {}, extra || {});
      return { n, t, b };
    }
    function toolbox() {
      const { n, t, b } = helpers();
      const cat = (name, colour, contents) => ({ kind: "category", name, colour, contents });
      const game = (cfg.toolbox ? cfg.toolbox({ n, t, b }) : []).map((c) => cat(c.name, c.colour, c.contents));
      return { kind: "categoryToolbox", contents: [
        cat("事件", C.ev, [...COMMON_HATS.map((x) => b(x)), ...(cfg.hats || []).map((x) => b(x))]),
        ...game,
        cat("遊戲", C.game, [b("rl_score_change", { N: n(1) }), b("rl_score_set", { N: n(0) }), b("rl_score_get"), b("rl_time_set", { N: n(60) }), b("rl_time_add", { N: n(10) }), b("rl_time_get"),
          b("rl_lives_set", { N: n(3) }), b("rl_lives_change", { N: n(-1) }), b("rl_lives_get"), b("rl_stat", { V: n(0) }), b("rl_win", { T: t("成功！") }), b("rl_lose", { T: t("再試一次！") })]),
        cat("效果", C.fx, [b("rl_say", { T: t("出發！") }), b("rl_sound"), b("rl_send", { T: t("g") }), b("rl_mbval")]),
        { kind: "sep" },
        cat("邏輯", "#5b80a5", [b("controls_if"), b("controls_if", null, { extraState: { hasElse: true } }), b("logic_compare", { B: n(0) }), b("logic_operation"), b("logic_negate"), b("logic_boolean")]),
        cat("迴圈", "#5ba55b", [b("controls_repeat_ext", { TIMES: n(3) })]),
        cat("數學", "#5b67a5", [b("math_number"), b("math_arithmetic", { A: n(1), B: n(1) }), b("math_random_int", { FROM: n(1), TO: n(10) }), b("math_round"), b("math_single", { NUM: n(-5) }, { fields: { OP: "ABS" } })]),
        cat("文字", "#5ba58c", [b("text"), b("text_join")]),
        { kind: "category", name: "變數", colour: "#a55b80", custom: "VARIABLE" },
      ] };
    }
    function defineGens() {
      const G = R.G, F = G.forBlock, O = javascript.Order;
      const v = (b, name, def) => G.valueToCode(b, name, O.NONE) || def;
      const q = (s) => JSON.stringify(String(s));
      const hatGen = (ev, argFn) => (b) => `api.on(${q(ev)}, ${argFn ? argFn(b) : "null"}, function () {\n${G.statementToCode(b, "DO")}});\n`;
      const call = (fn, ...args) => `api.${fn}(${args.join(", ")});\n`;
      const h = { G, F, O, v, q, hatGen, call, num };
      F.rl_start = hatGen("start");
      F.rl_every = hatGen("every", (b) => num(b.getFieldValue("SEC")));
      F.rl_score = hatGen("score", (b) => num(b.getFieldValue("N")));
      F.rl_timeup = hatGen("timeup");
      F.rl_lives0 = hatGen("lives0");
      F.rl_msg = hatGen("msg", (b) => q(String(b.getFieldValue("TEXT")).toLowerCase()));
      F.rl_score_change = (b) => call("addScore", v(b, "N", "1"));
      F.rl_score_set = (b) => call("setScore", v(b, "N", "0"));
      F.rl_score_get = () => ["api.getScore()", O.FUNCTION_CALL];
      F.rl_time_set = (b) => call("setTime", v(b, "N", "60"));
      F.rl_time_add = (b) => call("addTime", v(b, "N", "10"));
      F.rl_time_get = () => ["api.getTime()", O.FUNCTION_CALL];
      F.rl_lives_set = (b) => call("setLives", v(b, "N", "3"));
      F.rl_lives_change = (b) => call("addLives", v(b, "N", "-1"));
      F.rl_lives_get = () => ["api.getLives()", O.FUNCTION_CALL];
      F.rl_stat = (b) => call("stat", q(b.getFieldValue("LABEL")), v(b, "V", "0"));
      F.rl_win = (b) => call("win", v(b, "T", "''"));
      F.rl_lose = (b) => call("lose", v(b, "T", "''"));
      F.rl_say = (b) => call("say", v(b, "T", "''"));
      F.rl_sound = (b) => call("sound", q(b.getFieldValue("S")));
      F.rl_send = (b) => call("send", v(b, "T", "''"));
      F.rl_mbval = (b) => [`api.mbval(${q(b.getFieldValue("KEY"))})`, O.FUNCTION_CALL];
      if (cfg.gens) cfg.gens(F, h);
      G.INFINITE_LOOP_TRAP = 'if (--api._loop < 0) throw new Error("LOOP");\n';
    }
    function saveLocal() { try { localStorage.setItem(STORE, JSON.stringify(Blockly.serialization.workspaces.save(R.ws))); localStorage.setItem(STORE + ".title", R.title); } catch (e) {} }
    function arrange() {
      const tops = R.ws.getTopBlocks(true); if (!tops.length) return;
      const sizes = tops.map((b) => b.getHeightWidth());
      const total = sizes.reduce((a, s) => a + s.height + 36, 0);
      let x = 30, y = 30, colW = 0, col = 0;
      tops.forEach((b, i) => {
        if (col === 0 && y > 30 && y + sizes[i].height / 2 > total / 2 + 30) { x += colW + 70; y = 30; colW = 0; col = 1; }
        const xy = b.getRelativeToSurfaceXY(); b.moveBy(x - xy.x, y - xy.y);
        y += sizes[i].height + 36; colW = Math.max(colW, sizes[i].width);
      });
      R.ws.scroll(0, 0);
    }
    function loadTemplate(id) {
      const t = R.templates.find((x) => x.id === id); if (!t) return;
      R.ws.clear(); Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(t.xml), R.ws); arrange();
      R.title = t.name.split("｜").pop(); saveLocal(); info(`已載入：${t.name}（Ctrl+Z 可以復原）`);
    }
    async function initEditor() {
      if (R.ready) return;
      await loadBlockly();
      Blockly.common.defineBlocksWithJsonArray([...COMMON, ...(cfg.blocks || [])]);
      R.G = javascript.javascriptGenerator; defineGens();
      R.templates = [...(cfg.templates ? cfg.templates(X) : []), { id: "free", name: "自由創作", xml: X.xml([X.H("rl_start", {}, [X.say("出發！")])]) }];
      R.ws = Blockly.inject("rlBlockly", {
        toolbox: toolbox(), renderer: "zelos", trashcan: true, sounds: false, media: "vendor/blockly/media/",
        zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 1.6, minScale: 0.35 },
        grid: { spacing: 28, length: 2, colour: "#d9e2ea", snap: true },
        move: { scrollbars: true, drag: true, wheel: false },
      });
      R.ws.addChangeListener(Blockly.Events.disableOrphans);
      let t = 0; R.ws.addChangeListener((e) => { if (e.isUiEvent) return; clearTimeout(t); t = setTimeout(saveLocal, 400); });
      const sel = $("rlTpl");
      sel.innerHTML = `<option value="">範例規則…</option>` + R.templates.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
      sel.onchange = () => { loadTemplate(sel.value); sel.value = ""; };
      let ok = false;
      try { const saved = localStorage.getItem(STORE); if (saved) { Blockly.serialization.workspaces.load(JSON.parse(saved), R.ws); ok = R.ws.getTopBlocks(false).length > 0; }
        R.title = localStorage.getItem(STORE + ".title") || cfg.title; } catch (e) { R.ws.clear(); }
      if (!ok) loadTemplate(R.templates[0].id);
      R.ready = true; $("rlLoading").hidden = true;
    }
    async function openEditor() {
      buildDom(); stop();
      document.querySelectorAll(".overlay").forEach((o) => { if (o.id !== "rlEnd") o.hidden = true; });
      $("rlEnd").hidden = true; $("rlEditor").hidden = false; document.body.classList.add("rl-editing");
      try { await initEditor(); } catch (e) { info("積木載入失敗，請重新整理網頁", true); return; }
      setTimeout(() => Blockly.svgResize(R.ws), 0);
    }
    function closeEditor() { if ($("rlEditor")) $("rlEditor").hidden = true; document.body.classList.remove("rl-editing"); }

    /* ---------- 執行 ---------- */
    function compile() {
      const G = R.G; G.init(R.ws); let code = "";
      const hats = new Set([...COMMON_HATS, ...(cfg.hats || [])]);
      for (const b of R.ws.getTopBlocks(true)) if (hats.has(b.type) && b.isEnabled()) code += G.blockToCode(b);
      return G.finish(code);
    }
    function play() {
      if (window.SFX) SFX.audio();
      let code;
      try { code = compile(); R.H = []; new Function("api", '"use strict";\n' + code)(api); }
      catch (err) { openEditor(); info(`規則有問題：${err.message || err}`, true); return; }
      Object.assign(R, { running: true, score: 0, left: 0, timeOn: false, lives: 0, livesOn: false, stats: new Map() });
      closeEditor(); $("rlEnd").hidden = true; $("rlErrs").hidden = true; $("rlBack").hidden = false;
      document.body.classList.add("rl-run"); hud();
      cfg.onPlay();
      if (!R.H.length) toast("還沒有任何事件積木，先拖一個「當遊戲開始」吧");
      fire("start");
    }
    function stop() {
      const was = R.running || document.body.classList.contains("rl-run");
      R.running = false; document.body.classList.remove("rl-run"); if ($("rlBack")) $("rlBack").hidden = true;
      if (was && cfg.onStop) cfg.onStop();
    }
    function end(win, text) {
      if (!R.running) return;
      R.running = false; if (window.MB) MB.send("end"); (win ? SND.win : SND.lose)();
      if (cfg.onEnd) cfg.onEnd(win);
      setTimeout(() => {
        $("rlEndTitle").textContent = win ? "成功！" : "失敗了"; $("rlEndTitle").className = win ? "win" : "";
        $("rlEndText").textContent = text; $("rlEndScore").textContent = `${fmt(R.score)} 分`; $("rlEnd").hidden = false;
      }, 700);
    }
    function fireOne(h, it) {
      if (h.off || R.depth > 6) return;
      const prevIt = api._it; R.depth++;
      if (R.depth === 1) api._loop = 20000;
      api._it = it === undefined ? null : it;
      try { h.fn(); }
      catch (err) {
        h.err++; if (h.err >= 3 || (err && err.message === "LOOP")) h.off = true;
        showErr(err && err.message === "LOOP" ? `「${evName(h)}」裡的迴圈重複太多次，這條規則先停用` : `「${evName(h)}」出錯：${(err && err.message) || err}`);
      }
      api._it = prevIt; R.depth--;
    }
    function fire(ev, arg, it) {
      let n = 0;
      for (const h of R.H) if (h.ev === ev && (arg === undefined || h.arg === arg)) { n++; if (R.running) fireOne(h, it); }
      return n;
    }
    function fireIf(ev, test, it) { let n = 0; for (const h of R.H) if (h.ev === ev && test(h.arg)) { n++; if (R.running) fireOne(h, it); } return n; }
    function has(ev, arg) { return R.H.some((h) => h.ev === ev && !h.off && (arg === undefined || h.arg === arg)); }
    function evName(h) {
      const own = cfg.evNames && cfg.evNames[h.ev];
      if (own) return typeof own === "function" ? own(h.arg) : own;
      return { start: "當遊戲開始", every: `每隔 ${h.arg} 秒`, score: `當分數達到 ${h.arg}`, timeup: "當倒數時間到", lives0: "當生命用完", msg: `當收到訊息 ${h.arg}` }[h.ev] || h.ev;
    }
    function setScore(v) {
      const old = R.score; R.score = Math.round(v * 100) / 100; hud();
      if (R.score > old) for (const h of R.H) if (h.ev === "score" && old < h.arg && R.score >= h.arg) fireOne(h);
    }
    function setLives(v) {
      const old = R.livesOn ? R.lives : Infinity;
      R.lives = clamp(Math.round(v), 0, 99); R.livesOn = true; hud();
      if (R.lives <= 0 && old > 0 && R.running) { if (!fire("lives0")) end(false, "生命用完了"); }
    }
    function hud() {
      const box = $("rlStats"); if (!box) return;
      const items = [["分數", R.score]];
      if (R.timeOn || R.left > 0) items.push(["時間", Math.ceil(R.left), R.timeOn && R.left <= 10]);
      if (R.livesOn) items.push(["生命", R.lives, R.lives <= 1]);
      for (const [k, v] of R.stats) items.push([k, v, false, true]);
      box.innerHTML = items.map(([k, v, warn, custom]) => `<div class="stat${warn ? " warn" : ""}${custom ? " custom" : ""}"><small>${esc(k)}</small><span>${esc(fmt(v))}</span></div>`).join("");
    }
    /** 遊戲每一格呼叫：處理倒數和「每隔幾秒」 */
    function tick(dt) {
      if (!R.running) return;
      if (R.timeOn) {
        const before = Math.ceil(R.left); R.left -= dt;
        if (Math.ceil(R.left) !== before) hud();
        if (R.left <= 0) { R.left = 0; R.timeOn = false; hud(); if (!fire("timeup")) end(true, "時間到！"); }
      }
      for (const h of R.H) if (h.ev === "every" && !h.off && R.running) {
        const iv = Math.max(0.5, num(h.arg) || 1); h.acc += dt;
        if (h.acc >= iv) { h.acc -= iv; fireOne(h); }
      }
    }
    if (window.MB) MB.on((ev) => {
      if (ev.key) R.mb[ev.key.toLowerCase()] = ev.value;
      else if (ev.word && R.running) fire("msg", String(ev.word).toLowerCase());
    });
    return {
      open: openEditor, stop, play, tick, fire, fireIf, has, toast, api,
      get running() { return R.running; },
      get active() { return document.body.classList.contains("rl-run"); },
      get score() { return R.score; },
    };
  }

  window.RuleLab = { create, X, helpers: { hat, act, val, dd, vin, fnum, ftxt } };
})();
