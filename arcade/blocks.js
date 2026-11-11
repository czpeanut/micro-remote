"use strict";
/*
 * blocks.js — 酷丁狐遊戲工坊的積木（名稱盡量和 MakeCode Arcade 中文版一樣，課本可以通用）
 *  產生的程式只呼叫 api.xxx（engine.js）。
 */
window.ArcBlocks = (function () {
  const AS = window.ARC_ASSETS, E = window.ArcEngine;
  const C = { ev: "#20bf6b", sp: "#4b7bec", ctl: "#d54322", game: "#8854d0", scene: "#4b6584", info: "#cf6a87", anim: "#03aa74" };
  const TH = {};
  const th = (k, w, h) => { const id = k + "@" + (w || 28); if (!TH[id]) TH[id] = E.thumb(k, 64); return { src: TH[id], width: w || 28, height: h || w || 28, alt: (AS.img[k] && AS.img[k].n) || k }; };
  const imgOpts = (cats) => () => cats.flatMap((c) => AS.cat[c] || []).map((k) => [th(k), k]);
  const bgOpts = () => AS.cat.bg.map((k) => [{ ...th(k, 44, 33), alt: AS.img[k].n }, k]);
  const tileOpts = () => [[{ src: transparentThumb(), width: 24, height: 24, alt: "透明" }, "none"], ...AS.cat.tile.filter((k) => !/^cp\d/.test(k)).map((k) => [th(k, 24), k])];
  const animOpts = () => Object.entries(AS.anim).map(([k, a]) => [{ ...th(a.f[0], 28), alt: a.n }, k]);
  const COLOR_NAMES = ["透明", "白色", "紅色", "粉紅色", "橘色", "黃色", "藍綠色", "綠色", "深藍色", "淺藍色", "紫色", "灰紫色", "深紫色", "米色", "咖啡色", "黑色"];
  const colorOpts = () => E.PAL.map((c, i) => [{ src: swatch(i ? c : null), width: 22, height: 22, alt: COLOR_NAMES[i] }, String(i)]).slice(1);
  const mapOpts = () => Object.entries(AS.maps).map(([k, m]) => [m.n + `（${m.w}×${m.h}）`, k]);
  function swatch(c) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 22; const g = cv.getContext("2d");
    g.fillStyle = c || "#fff"; g.fillRect(0, 0, 22, 22); g.strokeStyle = "#333"; g.strokeRect(0.5, 0.5, 21, 21);
    return cv.toDataURL();
  }
  let TT = null;
  function transparentThumb() {
    if (TT) return TT;
    const cv = document.createElement("canvas"); cv.width = cv.height = 24; const g = cv.getContext("2d");
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#ddd" : "#fff"; g.fillRect(x * 6, y * 6, 6, 6); }
    return (TT = cv.toDataURL());
  }
  const KIND = () => ({ type: "field_dropdown", name: "KIND", options: E.KINDS.map((k) => [k, k]) });
  const KIND2 = () => ({ type: "field_dropdown", name: "KIND2", options: E.KINDS.map((k) => [k, k]) });
  const BTN = [["A", "A"], ["B", "B"], ["上", "up"], ["下", "down"], ["左", "left"], ["右", "right"]];
  const PROP = [["x", "x"], ["y", "y"], ["速度 x (vx)", "vx"], ["速度 y (vy)", "vy"], ["加速度 x (ax)", "ax"], ["加速度 y (ay)", "ay"], ["左邊", "left"], ["右邊", "right"], ["上面", "top"], ["下面", "bottom"]];
  const PROP_GET = [...PROP, ["寬度", "width"], ["高度", "height"]];
  const SOUND = [["叮咚 baDing", "baDing"], ["升級 power up", "powerUp"], ["降級 power down", "powerDown"], ["跳 jump up", "jumpUp"], ["哇哇哇 wawawa", "wawawa"], ["魔法棒 magic wand", "magicWand"], ["受傷 hit", "hit"]];
  const EFFECT = [["沒有效果", "none"], ["瓦解效果", "disintegrate"], ["火焰", "fire"], ["泡泡", "bubbles"]];

  const vin = (name, check) => ({ type: "input_value", name, check: check === undefined ? null : check });
  const hat = (type, msg, args, tip) => ({ type, message0: msg, args0: args, message1: "%1", args1: [{ type: "input_statement", name: "DO" }], colour: C.ev, tooltip: tip || "", hat: "cap" });
  const act = (type, msg, args, colour, tip) => ({ type, message0: msg, args0: args, previousStatement: null, nextStatement: null, inputsInline: true, colour, tooltip: tip || "" });
  const val = (type, msg, args, colour, out, tip) => ({ type, message0: msg, args0: args, output: out === undefined ? "Number" : out, inputsInline: true, colour, tooltip: tip || "" });

  function defs() {
    return [
      // ---- 事件 ----
      hat("a_start", "當啟動時", [], "按「執行」時，先做這裡面的事"),
      hat("a_button", "當 %1 鍵 %2", [{ type: "field_dropdown", name: "BTN", options: BTN }, { type: "field_dropdown", name: "EV", options: [["被按住", "pressed"], ["被放開", "released"]] }], "鍵盤：方向鍵移動、空白鍵＝A、X＝B"),
      hat("a_interval", "當遊戲更新 間隔 %1 毫秒", [{ type: "field_number", name: "MS", value: 500, min: 20 }], "1000 毫秒＝1 秒"),
      hat("a_update", "當遊戲更新", [], "每一格畫面（一秒 60 次）都做一次"),
      hat("a_overlap", "當 sprite 類別 %1 重疊 otherSprite 類別 %2", [KIND(), KIND2()], "兩個角色碰在一起的時候；sprite 和 otherSprite 可以在「角色」裡拿到"),
      hat("a_destroyed", "當摧毀的是角色 sprite 類別 %1", [KIND()], "角色被摧毀，或飛出畫面自動消失的時候"),
      hat("a_tile", "當角色 sprite 類別 %1 重疊貼圖 %2 於 location", [KIND(), { type: "field_dropdown", name: "TILE", options: tileOpts() }], "角色碰到這種貼圖的時候；location 是那一格的位置"),
      hat("a_cd_end", "當倒數結束", [], "沒有這個積木的話，倒數結束就輸了"),
      hat("a_life_zero", "當生命歸零", [], "沒有這個積木的話，生命歸零就輸了"),
      // ---- 角色 ----
      act("a_create", "變數 %1 設為 角色 %2 類別 %3", [{ type: "field_variable", name: "VAR", variable: "mySprite" }, { type: "field_dropdown", name: "IMG", options: imgOpts(["char", "enemy", "thing"])() }, KIND()], C.sp, "做出一個新角色，放在畫面正中間"),
      act("a_proj", "變數 %1 設為 發射物 %2 來自側邊 vx %3 vy %4", [{ type: "field_variable", name: "VAR", variable: "projectile" }, { type: "field_dropdown", name: "IMG", options: imgOpts(["thing", "enemy", "char"])() }, vin("VX", "Number"), vin("VY", "Number")], C.sp, "從畫面邊邊飛進來；vx 是正的就從左邊來，負的就從右邊來；飛出畫面會自動消失"),
      act("a_set_img", "%1 圖像設為 %2", [vin("S"), { type: "field_dropdown", name: "IMG", options: imgOpts(["char", "enemy", "thing"])() }], C.sp),
      act("a_pos", "%1 位置設為 x %2 y %3", [vin("S"), vin("X", "Number"), vin("Y", "Number")], C.sp, "畫面寬 160、高 120；x 越大越右邊，y 越大越下面"),
      act("a_set", "將 %1 的 %2 設為 %3", [vin("S"), { type: "field_dropdown", name: "P", options: PROP }, vin("V", "Number")], C.sp),
      act("a_change", "將 %1 的 %2 改變 %3", [vin("S"), { type: "field_dropdown", name: "P", options: PROP }, vin("V", "Number")], C.sp),
      val("a_get", "%1 的 %2", [vin("S"), { type: "field_dropdown", name: "P", options: PROP_GET }], C.sp),
      act("a_vel", "%1 速度設為 vx %2 vy %3", [vin("S"), vin("VX", "Number"), vin("VY", "Number")], C.sp),
      act("a_flag", "%1 %2 %3", [vin("S"), { type: "field_dropdown", name: "F", options: [["stay in screen（停在螢幕裡）", "stay"], ["bounce on wall（碰牆反彈）", "bounce"], ["ghost（穿過牆）", "ghost"], ["auto destroy（飛出畫面消失）", "auto"]] }, { type: "field_checkbox", name: "ON", checked: true }], C.sp, "打勾＝開，不打勾＝關"),
      act("a_kind", "%1 類別設為 %2", [vin("S"), KIND()], C.sp),
      act("a_destroy", "摧毀 %1 %2", [vin("S"), { type: "field_dropdown", name: "FX", options: EFFECT }], C.sp),
      act("a_say", "%1 說 %2 持續 %3 毫秒", [vin("S"), vin("T"), vin("MS", "Number")], C.sp),
      val("a_ev_sprite", "sprite", [], C.sp, null, "事件裡的角色（只能放在有 sprite 的事件裡）"),
      val("a_ev_other", "otherSprite", [], C.sp, null, "被碰到的另一個角色（只能放在「當…重疊」裡）"),
      // ---- 控制器 ----
      act("a_move", "使用按鍵移動 %1 vx %2 vy %3", [vin("S"), vin("VX", "Number"), vin("VY", "Number")], C.ctl, "方向鍵控制角色；vy 設 0 就只能左右走"),
      val("a_pressed", "%1 鍵被按住？", [{ type: "field_dropdown", name: "BTN", options: BTN }], C.ctl, "Boolean"),
      // ---- 動畫 ----
      act("a_anim", "動畫 %1 圖幀 %2 間隔 %3 毫秒 循環 %4", [vin("S"), { type: "field_dropdown", name: "ANIM", options: animOpts() }, { type: "field_number", name: "MS", value: 100, min: 20 }, { type: "field_checkbox", name: "LOOP", checked: true }], C.anim, "一張一張輪流換圖；循環打勾就會一直重複"),
      act("a_anim_stop", "停止 %1 的動畫", [vin("S")], C.anim),
      // ---- 場景 ----
      act("a_bg_img", "背景圖像設為 %1", [{ type: "field_dropdown", name: "BG", options: bgOpts() }], C.scene),
      act("a_bg_color", "背景顏色設為 %1", [{ type: "field_dropdown", name: "COLOR", options: colorOpts() }], C.scene),
      act("a_scroll", "Scroller 背景捲動 vx %1 vy %2", [vin("VX", "Number"), vin("VY", "Number")], C.scene, "背景一直移動；vx 正的往右捲"),
      act("a_tilemap", "貼圖地圖設為 %1", [{ type: "field_dropdown", name: "MAP", options: mapOpts() }], C.scene),
      act("a_camera", "鏡頭跟隨角色 %1", [vin("S")], C.scene),
      act("a_shake", "鏡頭搖晃", [], C.scene),
      act("a_place", "%1 放置到 %2 上面", [vin("S"), vin("LOC", "Location")], C.scene),
      val("a_loc", "貼圖地圖 直欄 %1 橫列 %2", [vin("C", "Number"), vin("R", "Number")], C.scene, "Location", "直欄＝第幾格（左右，從 0 開始）；橫列＝第幾排（上下，從 0 開始）"),
      val("a_ev_loc", "location", [], C.scene, "Location", "「當角色重疊貼圖」裡碰到的那一格"),
      act("a_set_tile", "貼圖定位到 %1 設為 %2", [vin("LOC", "Location"), { type: "field_dropdown", name: "TILE", options: tileOpts() }], C.scene, "把那一格換成別的貼圖；選透明就是拿掉"),
      act("a_set_wall", "%1 設為牆 %2", [vin("LOC", "Location"), { type: "field_checkbox", name: "ON", checked: true }], C.scene),
      val("a_tiles_of", "貼圖的位置陣列 %1", [{ type: "field_dropdown", name: "TILE", options: tileOpts().slice(1) }], C.scene, "Array", "地圖上所有這種貼圖的位置"),
      val("a_hitting", "%1 碰撞到 %2 方的牆？", [vin("S"), { type: "field_dropdown", name: "DIR", options: [["左", "left"], ["右", "right"], ["上", "top"], ["下", "bottom"]] }], C.scene, "Boolean", "「下」＝腳踩在地上"),
      // ---- 資訊 ----
      act("a_score_set", "得分設為 %1", [vin("V", "Number")], C.info),
      act("a_score_change", "得分改變 %1", [vin("V", "Number")], C.info),
      val("a_score", "得分", [], C.info),
      act("a_life_set", "生命設為 %1", [vin("V", "Number")], C.info),
      act("a_life_change", "生命改變 %1", [vin("V", "Number")], C.info),
      val("a_life", "生命", [], C.info),
      act("a_countdown", "開始倒數 %1 秒", [vin("V", "Number")], C.info),
      act("a_cd_change", "倒數改變 %1 秒", [vin("V", "Number")], C.info),
      // ---- 遊戲 ----
      act("a_gameover", "game over 贏了 %1", [{ type: "field_checkbox", name: "WIN", checked: false }], C.game, "打勾＝贏了，不打勾＝輸了"),
      act("a_sound", "播放音效 %1", [{ type: "field_dropdown", name: "SND", options: SOUND }], C.game),
    ];
  }

  function generators(G, O) {
    const f = G.forBlock;
    const v = (b, n, d) => G.valueToCode(b, n, O.NONE) || (d === undefined ? "0" : d);
    const s = (b, n) => G.valueToCode(b, n, O.NONE) || "null";
    const body = (b) => G.statementToCode(b, "DO");
    const q = (x) => JSON.stringify(String(x));
    const tile = (x) => q(x === "none" ? "" : x);
    const vname = (b) => G.getVariableName(b.getFieldValue("VAR"));
    f.a_start = (b) => `api.onStart(function () {\n${body(b)}});\n`;
    f.a_button = (b) => `api.onButton(${q(b.getFieldValue("BTN"))}, ${q(b.getFieldValue("EV"))}, function () {\n${body(b)}});\n`;
    f.a_interval = (b) => `api.onInterval(${Number(b.getFieldValue("MS"))}, function () {\n${body(b)}});\n`;
    f.a_update = (b) => `api.onUpdate(function () {\n${body(b)}});\n`;
    f.a_overlap = (b) => `api.onOverlap(${q(b.getFieldValue("KIND"))}, ${q(b.getFieldValue("KIND2"))}, function (sprite, otherSprite) {\n${body(b)}});\n`;
    f.a_destroyed = (b) => `api.onDestroyed(${q(b.getFieldValue("KIND"))}, function (sprite) {\n${body(b)}});\n`;
    f.a_tile = (b) => `api.onOverlapTile(${q(b.getFieldValue("KIND"))}, ${tile(b.getFieldValue("TILE"))}, function (sprite, tileLoc) {\n${body(b)}});\n`;
    f.a_cd_end = (b) => `api.onCountdownEnd(function () {\n${body(b)}});\n`;
    f.a_life_zero = (b) => `api.onLifeZero(function () {\n${body(b)}});\n`;
    f.a_create = (b) => `${vname(b)} = api.create(${q(b.getFieldValue("IMG"))}, ${q(b.getFieldValue("KIND"))});\n`;
    f.a_proj = (b) => `${vname(b)} = api.projectileFromSide(${q(b.getFieldValue("IMG"))}, ${v(b, "VX")}, ${v(b, "VY")});\n`;
    f.a_set_img = (b) => `api.setImage(${s(b, "S")}, ${q(b.getFieldValue("IMG"))});\n`;
    f.a_pos = (b) => `api.setPos(${s(b, "S")}, ${v(b, "X")}, ${v(b, "Y")});\n`;
    f.a_set = (b) => `api.setProp(${s(b, "S")}, ${q(b.getFieldValue("P"))}, ${v(b, "V")});\n`;
    f.a_change = (b) => `api.changeProp(${s(b, "S")}, ${q(b.getFieldValue("P"))}, ${v(b, "V")});\n`;
    f.a_get = (b) => [`api.getProp(${s(b, "S")}, ${q(b.getFieldValue("P"))})`, O.FUNCTION_CALL];
    f.a_vel = (b) => `api.setVel(${s(b, "S")}, ${v(b, "VX")}, ${v(b, "VY")});\n`;
    f.a_flag = (b) => `api.setFlag(${s(b, "S")}, ${q(b.getFieldValue("F"))}, ${b.getFieldValue("ON") === "TRUE"});\n`;
    f.a_kind = (b) => `api.setKind(${s(b, "S")}, ${q(b.getFieldValue("KIND"))});\n`;
    f.a_destroy = (b) => { const fx = b.getFieldValue("FX"); return `api.destroy(${s(b, "S")}${fx === "none" ? "" : ", " + q(fx)});\n`; };
    f.a_say = (b) => `api.say(${s(b, "S")}, ${v(b, "T", '""')}, ${v(b, "MS")});\n`;
    f.a_ev_sprite = () => ["(typeof sprite === 'undefined' ? null : sprite)", O.CONDITIONAL];
    f.a_ev_other = () => ["(typeof otherSprite === 'undefined' ? null : otherSprite)", O.CONDITIONAL];
    f.a_move = (b) => `api.move(${s(b, "S")}, ${v(b, "VX")}, ${v(b, "VY")});\n`;
    f.a_pressed = (b) => [`api.pressed(${q(b.getFieldValue("BTN"))})`, O.FUNCTION_CALL];
    f.a_anim = (b) => `api.animate(${s(b, "S")}, ${q(b.getFieldValue("ANIM"))}, ${Number(b.getFieldValue("MS"))}, ${b.getFieldValue("LOOP") === "TRUE"});\n`;
    f.a_anim_stop = (b) => `api.stopAnim(${s(b, "S")});\n`;
    f.a_bg_img = (b) => `api.bgImage(${q(b.getFieldValue("BG"))});\n`;
    f.a_bg_color = (b) => `api.bgColor(${Number(b.getFieldValue("COLOR"))});\n`;
    f.a_scroll = (b) => `api.scroll(${v(b, "VX")}, ${v(b, "VY")});\n`;
    f.a_tilemap = (b) => `api.tilemap(${q(b.getFieldValue("MAP"))});\n`;
    f.a_camera = (b) => `api.camera(${s(b, "S")});\n`;
    f.a_shake = () => `api.shake();\n`;
    f.a_place = (b) => `api.place(${s(b, "S")}, ${v(b, "LOC", "null")});\n`;
    f.a_loc = (b) => [`api.loc(${v(b, "C")}, ${v(b, "R")})`, O.FUNCTION_CALL];
    f.a_ev_loc = () => ["(typeof tileLoc === 'undefined' ? null : tileLoc)", O.CONDITIONAL];
    f.a_set_tile = (b) => `api.setTile(${v(b, "LOC", "null")}, ${tile(b.getFieldValue("TILE"))});\n`;
    f.a_set_wall = (b) => `api.setWall(${v(b, "LOC", "null")}, ${b.getFieldValue("ON") === "TRUE"});\n`;
    f.a_tiles_of = (b) => [`api.tilesOf(${tile(b.getFieldValue("TILE"))})`, O.FUNCTION_CALL];
    f.a_hitting = (b) => [`api.hitting(${s(b, "S")}, ${q(b.getFieldValue("DIR"))})`, O.FUNCTION_CALL];
    f.a_score_set = (b) => `api.setScore(${v(b, "V")});\n`;
    f.a_score_change = (b) => `api.changeScore(${v(b, "V")});\n`;
    f.a_score = () => ["api.score()", O.FUNCTION_CALL];
    f.a_life_set = (b) => `api.setLife(${v(b, "V")});\n`;
    f.a_life_change = (b) => `api.changeLife(${v(b, "V")});\n`;
    f.a_life = () => ["api.life()", O.FUNCTION_CALL];
    f.a_countdown = (b) => `api.countdown(${v(b, "V")});\n`;
    f.a_cd_change = (b) => `api.changeCountdown(${v(b, "V")});\n`;
    f.a_gameover = (b) => `api.gameOver(${b.getFieldValue("WIN") === "TRUE"});\n`;
    f.a_sound = (b) => `api.sound(${q(b.getFieldValue("SND"))});\n`;
    // 數學的隨機整數用引擎的版本（比較短，也比較好讀）
    f.math_random_int = (b) => [`api.randint(${v(b, "FROM")}, ${v(b, "TO")})`, O.FUNCTION_CALL];
    G.addReservedWords("api,sprite,otherSprite,tileLoc,location");
    G.INFINITE_LOOP_TRAP = "api.loop();\n";
  }

  let ready = false;
  function init() {
    if (ready) return; ready = true;
    // 小朋友比較好懂的說法（和 MakeCode 中文版接近）
    Object.assign(Blockly.Msg, {
      LOGIC_OPERATION_AND: "且", LOGIC_OPERATION_OR: "或", VARIABLES_SET: "變數 %1 設為 %2", MATH_CHANGE_TITLE: "變數 %1 改變 %2",
      CONTROLS_FOREACH_TITLE: "對於 %2 中的每個 %1", PROCEDURES_DEFNORETURN_TITLE: "函式", PROCEDURES_DEFNORETURN_PROCEDURE: "做點什麼",
      CONTROLS_IF_MSG_THEN: "那麼", CONTROLS_REPEAT_INPUT_DO: "執行", MATH_RANDOM_INT_TITLE: "隨機取數 %1 到 %2",
      NEW_VARIABLE: "建立變數…", PROCEDURES_CALLNORETURN_HELPURL: "",
    });
    Blockly.common.defineBlocksWithJsonArray(defs());
    generators(javascript.javascriptGenerator, javascript.Order);
  }
  // 只產生事件（帽子積木）和函式；沒接上的積木不會執行
  function code(ws) {
    const G = javascript.javascriptGenerator;
    G.init(ws);
    const parts = [];
    for (const b of ws.getTopBlocks(true)) {
      if (!b.isEnabled() || b.isInsertionMarker()) continue;
      if (b.type.startsWith("a_") && b.getInput("DO")) parts.push(G.blockToCode(b));
      else if (b.type.startsWith("procedures_def")) G.blockToCode(b);
    }
    return G.finish(parts.join("\n"));
  }
  return { init, code, C };
})();
