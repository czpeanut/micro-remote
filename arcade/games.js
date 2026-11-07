"use strict";
/*
 * games.js — 寒訓三個遊戲的設定：積木工具箱、預設積木、參考解答（老師用 ?answer=1 才會載入）
 */
window.ARC_GAMES = (function () {
  /* ---------- 小工具：寫工具箱和解答 ---------- */
  const num = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
  const txt = (t) => ({ shadow: { type: "text", fields: { TEXT: t } } });
  const sv = (name) => ({ block: { type: "variables_get", fields: { VAR: { name } } } });
  const ev = (type) => ({ block: { type } });
  // 工具箱裡的一塊積木
  const t = (type, o) => { o = o || {}; const b = { kind: "block", type }; if (o.f) b.fields = o.f; if (o.i) b.inputs = o.i; return b; };
  const lbl = (text) => ({ kind: "label", text });
  const cat = (name, colour, contents) => ({ kind: "category", name, colour, contents });
  // 解答用：一塊積木（i 裡可以放 num()/sv()/{block}）
  const b = (type, f, i, extra) => Object.assign({ type, fields: f || {}, inputs: i || {} }, extra || {});
  const seq = (list) => { for (let k = list.length - 2; k >= 0; k--) list[k].next = { block: list[k + 1] }; return list[0]; };
  const hat = (type, f, body, xy) => Object.assign(b(type, f, body && body.length ? { DO: { block: seq(body) } } : {}), { x: xy[0], y: xy[1] });
  const nb = (n) => ({ block: { type: "math_number", fields: { NUM: n } } });
  const rnd = (a, c) => ({ block: b("math_random_int", {}, { FROM: num(a), TO: num(c) }) });
  const ws = (blocks) => ({ blocks: { languageVersion: 0, blocks } });

  const C = window.ArcBlocks.C;
  const LOGIC = cat("邏輯", "#5b80a5", [t("controls_if"), t("controls_if", { extraState: { hasElse: true } }), t("logic_compare", { i: { A: num(0), B: num(0) } }), t("logic_operation"), t("logic_negate"), t("logic_boolean")]);
  LOGIC.contents[1].extraState = { hasElse: true };
  const MATH = cat("數學", "#5b67a5", [t("math_number"), t("math_arithmetic", { i: { A: num(1), B: num(1) } }), t("math_random_int", { i: { FROM: num(1), TO: num(10) } })]);
  const LOOPS = cat("迴圈", "#5ba55b", [t("controls_repeat_ext", { i: { TIMES: num(4) } }), t("controls_forEach"), t("controls_whileUntil")]);
  const VARS = { kind: "category", name: "變數", colour: "#a55b80", custom: "VARIABLE" };
  const FUNCS = { kind: "category", name: "函式", colour: "#995ba5", custom: "PROCEDURE" };
  const spriteIn = (name) => ({ S: sv(name || "mySprite") });

  /* ===================== 低年級：小猴跑酷 ===================== */
  const low = {
    id: "low", name: "小猴跑酷", grade: "低年級", color: "#ff8135", hero: "monkey",
    desc: "小猴一直往前跑，按 A 鍵跳過小樹，撐過 30 秒就贏了！",
    keys: "A 鍵（空白鍵）跳",
    toolbox: {
      kind: "categoryToolbox", contents: [
        cat("角色", C.sp, [
          t("a_create", { f: { VAR: { name: "mySprite" }, IMG: "monkey", KIND: "Player" } }),
          t("a_pos", { i: { ...spriteIn(), X: num(130), Y: num(70) } }),
          t("a_set", { f: { P: "ay" }, i: { ...spriteIn(), V: num(130) } }),
          t("a_set", { f: { P: "vy" }, i: { ...spriteIn(), V: num(-100) } }),
          t("a_flag", { f: { F: "stay" }, i: spriteIn() }),
          lbl("發射物"),
          t("a_proj", { f: { VAR: { name: "projectile" }, IMG: "tree" }, i: { VX: num(50), VY: num(0) } }),
          t("a_set", { f: { P: "bottom" }, i: { ...spriteIn("projectile"), V: num(120) } }),
          lbl("事件"),
          t("a_overlap", { f: { KIND: "Player", KIND2: "Projectile" } }),
          t("a_destroyed", { f: { KIND: "Projectile" } }),
          t("a_get", { f: { P: "y" }, i: spriteIn() }),
        ]),
        cat("控制器", C.ctl, [t("a_button", { f: { BTN: "A", EV: "pressed" } }), t("a_pressed")]),
        cat("動畫", C.anim, [t("a_anim", { f: { ANIM: "monkeyRun" }, i: spriteIn() })]),
        cat("場景", C.scene, [t("a_bg_img", { f: { BG: "city" } }), t("a_bg_color", { f: { COLOR: "9" } }), t("a_scroll", { i: { VX: num(50), VY: num(0) } })]),
        cat("遊戲", C.game, [t("a_start"), t("a_interval", { f: { MS: 2000 } }), t("a_gameover"), t("a_gameover", { f: { WIN: true } }), t("a_sound")]),
        cat("資訊", C.info, [t("a_score_change", { i: { V: num(1) } }), t("a_score_set", { i: { V: num(0) } }), t("a_countdown", { i: { V: num(30) } }), t("a_cd_end")]),
        LOGIC, MATH,
      ],
    },
    answer: ws([
      hat("a_start", {}, [
        b("a_create", { VAR: { name: "mySprite" }, IMG: "monkey", KIND: "Player" }),
        b("a_pos", {}, { S: sv("mySprite"), X: num(130), Y: num(70) }),
        b("a_anim", { ANIM: "monkeyRun", MS: 100, LOOP: true }, { S: sv("mySprite") }),
        b("a_bg_img", { BG: "city" }),
        b("a_scroll", {}, { VX: num(50), VY: num(0) }),
        b("a_set", { P: "ay" }, { S: sv("mySprite"), V: num(130) }),
        b("a_flag", { F: "stay", ON: true }, { S: sv("mySprite") }),
        b("a_countdown", {}, { V: num(30) }),
      ], [30, 30]),
      hat("a_button", { BTN: "A", EV: "pressed" }, [
        b("controls_if", {}, {
          IF0: { block: b("logic_compare", { OP: "GTE" }, { A: { block: b("a_get", { P: "y" }, { S: sv("mySprite") }) }, B: num(110) }) },
          DO0: { block: b("a_set", { P: "vy" }, { S: sv("mySprite"), V: num(-100) }) },
        }),
      ], [470, 30]),
      hat("a_interval", { MS: 2000 }, [
        b("a_proj", { VAR: { name: "projectile" }, IMG: "tree" }, { VX: num(50), VY: num(0) }),
        b("a_set", { P: "bottom" }, { S: sv("projectile"), V: num(120) }),
      ], [470, 200]),
      hat("a_overlap", { KIND: "Player", KIND2: "Projectile" }, [b("a_gameover", { WIN: false })], [470, 360]),
      hat("a_destroyed", { KIND: "Projectile" }, [b("a_score_change", {}, { V: num(1) })], [470, 470]),
      hat("a_cd_end", {}, [b("a_gameover", { WIN: true })], [470, 580]),
    ]),
  };

  /* ===================== 中年級：怪物捕手 ===================== */
  const walk = (btn, anim, xy) => hat("a_button", { BTN: btn, EV: "pressed" }, [b("a_anim", { ANIM: anim, MS: 100, LOOP: true }, { S: sv("mySprite") })], xy);
  const mid = {
    id: "mid", name: "怪物捕手", grade: "中年級", color: "#249ca3", hero: "hero",
    desc: "在城堡房間裡追著亂跑的小石怪，30 秒內抓到越多越好！",
    keys: "方向鍵移動",
    toolbox: {
      kind: "categoryToolbox", contents: [
        cat("角色", C.sp, [
          t("a_create", { f: { VAR: { name: "mySprite" }, IMG: "hero", KIND: "Player" } }),
          t("a_create", { f: { VAR: { name: "myEnemy" }, IMG: "rock", KIND: "Enemy" } }),
          t("a_vel", { i: { ...spriteIn("myEnemy"), VX: num(40), VY: num(40) } }),
          t("a_flag", { f: { F: "bounce" }, i: spriteIn("myEnemy") }),
          t("a_set", { f: { P: "vx" }, i: { ...spriteIn(), V: num(0) } }),
          lbl("事件"),
          t("a_overlap", { f: { KIND: "Player", KIND2: "Enemy" } }),
          t("a_ev_other"), t("a_ev_sprite"),
          t("a_say", { i: { ...spriteIn(), T: txt("抓到了！"), MS: num(500) } }),
        ]),
        cat("控制器", C.ctl, [t("a_move", { i: { ...spriteIn(), VX: num(100), VY: num(100) } }), t("a_button", { f: { BTN: "up", EV: "pressed" } }), t("a_pressed")]),
        cat("動畫", C.anim, [t("a_anim", { f: { ANIM: "heroBack" }, i: spriteIn() }), t("a_anim_stop", { i: spriteIn() })]),
        cat("場景", C.scene, [
          t("a_tilemap", { f: { MAP: "room" } }), t("a_camera", { i: spriteIn() }),
          t("a_place", { i: { S: sv("myEnemy"), LOC: { block: t("a_loc", { i: { C: num(8), R: num(8) } }) } } }),
          t("a_loc", { i: { C: num(1), R: num(1) } }), t("a_shake"),
        ]),
        cat("遊戲", C.game, [t("a_start"), t("a_interval", { f: { MS: 1000 } }), t("a_update"), t("a_sound"), t("a_gameover", { f: { WIN: true } })]),
        cat("資訊", C.info, [t("a_score_set", { i: { V: num(0) } }), t("a_score_change", { i: { V: num(1) } }), t("a_score"), t("a_countdown", { i: { V: num(30) } }), t("a_cd_end")]),
        LOGIC, MATH, VARS,
      ],
    },
    answer: ws([
      hat("a_start", {}, [
        b("a_tilemap", { MAP: "room" }),
        b("a_create", { VAR: { name: "mySprite" }, IMG: "hero", KIND: "Player" }),
        b("a_move", {}, { S: sv("mySprite"), VX: num(100), VY: num(100) }),
        b("a_camera", {}, { S: sv("mySprite") }),
        b("a_create", { VAR: { name: "myEnemy" }, IMG: "rock", KIND: "Enemy" }),
        b("a_place", {}, { S: sv("myEnemy"), LOC: { block: b("a_loc", {}, { C: num(8), R: num(8) }) } }),
        b("a_flag", { F: "bounce", ON: true }, { S: sv("myEnemy") }),
        b("a_score_set", {}, { V: num(0) }),
        b("a_countdown", {}, { V: num(30) }),
      ], [30, 30]),
      walk("up", "heroBack", [520, 30]), walk("left", "heroLeft", [520, 130]), walk("right", "heroRight", [520, 230]), walk("down", "heroFront", [520, 330]),
      hat("a_interval", { MS: 1000 }, [b("a_vel", {}, { S: sv("myEnemy"), VX: rnd(-40, 40), VY: rnd(-40, 40) })], [30, 420]),
      hat("a_overlap", { KIND: "Player", KIND2: "Enemy" }, [
        b("a_score_change", {}, { V: num(1) }),
        b("a_sound", { SND: "baDing" }),
        b("a_place", {}, { S: ev("a_ev_other"), LOC: { block: b("a_loc", {}, { C: rnd(1, 8), R: rnd(1, 8) }) } }),
      ], [30, 540]),
      hat("a_cd_end", {}, [b("a_gameover", { WIN: true })], [520, 440]),
    ]),
  };

  /* ===================== 高年級：跳台大冒險 ===================== */
  const call = () => b("procedures_callnoreturn", {}, {}, { extraState: { name: "受傷" } });
  const high = {
    id: "high", name: "跳台大冒險", grade: "高年級", color: "#8e2ec4", hero: "jumper",
    desc: "左右走、按 A 跳，撿寶石、踩扁史萊姆、躲開尖刺和岩漿，走到寶箱就過關！",
    keys: "◀ ▶ 移動、A 鍵（空白鍵）跳",
    toolbox: {
      kind: "categoryToolbox", contents: [
        cat("角色", C.sp, [
          t("a_create", { f: { VAR: { name: "mySprite" }, IMG: "jumper", KIND: "Player" } }),
          t("a_create", { f: { VAR: { name: "myEnemy" }, IMG: "slime", KIND: "Enemy" } }),
          t("a_set", { f: { P: "ay" }, i: { ...spriteIn(), V: num(350) } }),
          t("a_set", { f: { P: "vy" }, i: { ...spriteIn(), V: num(-200) } }),
          t("a_set", { f: { P: "vx" }, i: { ...spriteIn("myEnemy"), V: num(-30) } }),
          t("a_get", { f: { P: "vy" }, i: spriteIn() }),
          t("a_get", { f: { P: "y" }, i: { S: ev("a_ev_other") } }),
          t("a_flag", { f: { F: "bounce" }, i: spriteIn("myEnemy") }),
          lbl("事件"),
          t("a_overlap", { f: { KIND: "Player", KIND2: "Enemy" } }),
          t("a_ev_other"), t("a_ev_sprite"),
          t("a_destroy", { f: { FX: "disintegrate" }, i: { S: ev("a_ev_other") } }),
        ]),
        cat("控制器", C.ctl, [t("a_move", { i: { ...spriteIn(), VX: num(80), VY: num(0) } }), t("a_button", { f: { BTN: "A", EV: "pressed" } }), t("a_pressed")]),
        cat("場景", C.scene, [
          t("a_bg_color", { f: { COLOR: "9" } }), t("a_tilemap", { f: { MAP: "level1" } }), t("a_camera", { i: spriteIn() }),
          t("a_place", { i: { ...spriteIn(), LOC: { block: t("a_loc", { i: { C: num(1), R: num(5) } }) } } }),
          t("a_loc", { i: { C: num(1), R: num(5) } }),
          t("a_hitting", { f: { DIR: "bottom" }, i: spriteIn() }),
          lbl("貼圖"),
          t("a_tile", { f: { KIND: "Player", TILE: "gemT" } }), t("a_ev_loc"),
          t("a_set_tile", { f: { TILE: "none" }, i: { LOC: ev("a_ev_loc") } }),
          t("a_tiles_of", { f: { TILE: "stone" } }),
        ]),
        cat("遊戲", C.game, [t("a_start"), t("a_gameover", { f: { WIN: true } }), t("a_sound"), t("a_update"), t("a_interval", { f: { MS: 1000 } })]),
        cat("資訊", C.info, [t("a_life_set", { i: { V: num(3) } }), t("a_life_change", { i: { V: num(-1) } }), t("a_score_set", { i: { V: num(0) } }), t("a_score_change", { i: { V: num(1) } }), t("a_score")]),
        LOGIC, LOOPS, MATH, VARS, FUNCS,
      ],
    },
    answer: ws([
      hat("a_start", {}, [
        b("a_bg_color", { COLOR: "9" }),
        b("a_tilemap", { MAP: "level1" }),
        b("a_create", { VAR: { name: "mySprite" }, IMG: "jumper", KIND: "Player" }),
        b("a_move", {}, { S: sv("mySprite"), VX: num(80), VY: num(0) }),
        b("a_place", {}, { S: sv("mySprite"), LOC: { block: b("a_loc", {}, { C: num(1), R: num(5) }) } }),
        b("a_camera", {}, { S: sv("mySprite") }),
        b("a_set", { P: "ay" }, { S: sv("mySprite"), V: num(350) }),
        b("a_life_set", {}, { V: num(3) }),
        b("a_score_set", {}, { V: num(0) }),
        b("controls_forEach", { VAR: { name: "位置" } }, {
          LIST: { block: b("a_tiles_of", { TILE: "stone" }) },
          DO: { block: seq([
            b("a_create", { VAR: { name: "myEnemy" }, IMG: "slime", KIND: "Enemy" }),
            b("a_place", {}, { S: sv("myEnemy"), LOC: sv("位置") }),
            b("a_set_tile", { TILE: "none" }, { LOC: sv("位置") }),
            b("a_set", { P: "vx" }, { S: sv("myEnemy"), V: num(-30) }),
            b("a_flag", { F: "bounce", ON: true }, { S: sv("myEnemy") }),
          ]) },
        }),
      ], [30, 30]),
      hat("a_button", { BTN: "A", EV: "pressed" }, [
        b("controls_if", {}, {
          IF0: { block: b("a_hitting", { DIR: "bottom" }, { S: sv("mySprite") }) },
          DO0: { block: b("a_set", { P: "vy" }, { S: sv("mySprite"), V: num(-200) }) },
        }),
      ], [560, 30]),
      hat("a_tile", { KIND: "Player", TILE: "gemT" }, [b("a_score_change", {}, { V: num(1) }), b("a_set_tile", { TILE: "none" }, { LOC: ev("a_ev_loc") })], [560, 170]),
      Object.assign(b("procedures_defnoreturn", { NAME: "受傷" }, { STACK: { block: seq([
        b("a_life_change", {}, { V: num(-1) }),
        b("a_place", {}, { S: sv("mySprite"), LOC: { block: b("a_loc", {}, { C: num(1), R: num(5) }) } }),
        b("a_set", { P: "vy" }, { S: sv("mySprite"), V: num(0) }),
      ]) } }), { x: 560, y: 320 }),
      hat("a_tile", { KIND: "Player", TILE: "spike" }, [call()], [560, 490]),
      hat("a_tile", { KIND: "Player", TILE: "lava" }, [call()], [560, 580]),
      hat("a_tile", { KIND: "Player", TILE: "chest" }, [b("a_gameover", { WIN: true })], [560, 670]),
      hat("a_overlap", { KIND: "Player", KIND2: "Enemy" }, [
        b("a_destroy", { FX: "disintegrate" }, { S: ev("a_ev_other") }),
        b("controls_if", {}, {
          IF0: { block: b("logic_operation", { OP: "AND" }, {
            A: { block: b("logic_compare", { OP: "GT" }, { A: { block: b("a_get", { P: "vy" }, { S: sv("mySprite") }) }, B: num(0) }) },
            B: { block: b("logic_compare", { OP: "LT" }, { A: { block: b("a_get", { P: "y" }, { S: sv("mySprite") }) }, B: { block: b("a_get", { P: "y" }, { S: ev("a_ev_other") }) } }) },
          }) },
          DO0: { block: seq([b("a_set", { P: "vy" }, { S: sv("mySprite"), V: num(-120) }), b("a_score_change", {}, { V: num(3) })]) },
          ELSE: { block: call() },
        }, { extraState: { hasElse: true } }),
      ], [30, 640]),
    ]),
  };

  const start = ws([hat("a_start", {}, [], [40, 40])]);
  return { low, mid, high, start };
})();
