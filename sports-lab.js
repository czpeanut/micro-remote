"use strict";
/* micro:bit 運動會 — 規則實驗室（積木規則）。需要先載入 rulelab.js 和 sports.js */
const { hat, act, val, dd, vin } = RuleLab.helpers;
const CG = "#2f8f4e";
const GAME_OPTS = [["保齡球", "bowl"], ["網球", "tennis"], ["棒球", "base"]];
const ONOFF = [["開", "1"], ["關", "0"]];
function labSetGame(name) {
  if (!GAMES[name]) return;
  S.game = name; $("gameName").textContent = GAMES[name].name; GAMES[name].init();
}
const LAB = RuleLab.create({
  id: "sports", title: "運動會規則實驗室",
  tip: "<b>怎麼玩</b><br>1. 在「當遊戲開始」裡選比賽項目。<br>2. 用「當保齡球停下來」「當擊中球」決定怎麼計分。<br>3. 自己決定幾球結束、誰贏。<br><b>操作</b>：micro:bit 左右傾斜瞄準、揮一下出手；或 ← →、按住空白鍵蓄力。",
  blocks: [
    hat("sg_swing", "當揮動", [], "micro:bit 揮一下（或放開空白鍵）時執行"),
    hat("sg_bowl", "當保齡球停下來", [], "每一球數完倒瓶後執行；用「倒了幾支」看結果"),
    hat("sg_hit", "當擊中球", [], "網球或棒球打到球時執行"),
    hat("sg_miss", "當沒打到球", [], "網球沒接到、棒球揮空或沒揮"),
    hat("sg_point", "當 %1 得分", [dd("WHO", [["我", "me"], ["電腦", "cpu"]])], "網球每一分結束時執行"),
    act("sg_game", "比賽項目 %1", [dd("G", GAME_OPTS)], CG, "換成這個比賽，並重新開始"),
    act("sg_pins", "保齡球瓶 %1", [dd("N", [["10 支", "10"], ["6 支", "6"], ["3 支", "3"], ["1 支", "1"]])], CG, "下一球開始生效"),
    act("sg_bumper", "保齡球護欄 %1", [dd("ON", ONOFF)], CG, "開啟後球不會掉進水溝，會反彈回來"),
    act("sg_aim", "瞄準輔助線 %1", [dd("ON", ONOFF)], CG),
    act("sg_speed", "球速 %1", [dd("V", [["普通", "1"], ["慢", "0.7"], ["快", "1.35"], ["超快", "1.7"]])], CG, "網球和棒球的球速"),
    act("sg_cpu", "電腦對手 %1", [dd("V", [["普通", "1"], ["弱", "0.6"], ["強", "1.5"]])], CG, "網球電腦跑得多快"),
    act("sg_curve", "棒球變化球 %1", [dd("ON", ONOFF)], CG),
    act("sg_fx", "放彩帶", [], CG),
    val("sg_power", "揮動力道（0～100）", [], CG),
    val("sg_tilt", "左右傾斜（-100～100）", [], CG),
    val("sg_down", "倒了幾支", [], CG, "上一球保齡球打倒的瓶數"),
    val("sg_dist", "擊球距離（公尺）", [], CG, "棒球打出去的距離，界外是 0"),
    val("sg_timing", "時機誤差（毫秒）", [], CG, "擊中時離完美時機差多少，越小越準"),
  ],
  hats: ["sg_swing", "sg_bowl", "sg_hit", "sg_miss", "sg_point"],
  evNames: { swing: "當揮動", bowl: "當保齡球停下來", hit: "當擊中球", miss: "當沒打到球", point: (a) => `當${a === "me" ? "我" : "電腦"}得分` },
  gens(F, h) {
    const { q, call, hatGen, O, num } = h;
    F.sg_swing = hatGen("swing"); F.sg_bowl = hatGen("bowl"); F.sg_hit = hatGen("hit"); F.sg_miss = hatGen("miss");
    F.sg_point = hatGen("point", (b) => q(b.getFieldValue("WHO")));
    F.sg_game = (b) => call("game", q(b.getFieldValue("G")));
    F.sg_pins = (b) => call("pins", num(b.getFieldValue("N")));
    F.sg_bumper = (b) => call("bumper", num(b.getFieldValue("ON")));
    F.sg_aim = (b) => call("aim", num(b.getFieldValue("ON")));
    F.sg_speed = (b) => call("speed", num(b.getFieldValue("V")));
    F.sg_cpu = (b) => call("cpu", num(b.getFieldValue("V")));
    F.sg_curve = (b) => call("curve", num(b.getFieldValue("ON")));
    F.sg_fx = () => call("fx");
    for (const [t, f] of [["sg_power", "power"], ["sg_tilt", "tilt"], ["sg_down", "down"], ["sg_dist", "dist"], ["sg_timing", "timing"]]) F[t] = () => [`api.${f}()`, O.FUNCTION_CALL];
  },
  toolbox: ({ b }) => [{ name: "運動會", colour: CG, contents: [
    b("sg_game"), b("sg_pins"), b("sg_bumper"), b("sg_aim"), b("sg_speed"), b("sg_cpu"), b("sg_curve"), b("sg_fx"),
    b("sg_power"), b("sg_tilt"), b("sg_down"), b("sg_dist"), b("sg_timing")] }],
  api: {
    game: labSetGame,
    pins(n) { S.npins = clamp(Number(n) || 10, 1, 10); if (S.game === "bowl") GAMES.bowl.rerack(); },
    bumper(on) { S.bumper = !!Number(on); },
    aim(on) { S.aim = !!Number(on); },
    speed(v) { S.ballSpd = clamp(Number(v) || 1, 0.4, 2); },
    cpu(v) { S.cpu = clamp(Number(v) || 1, 0.3, 2); },
    curve(on) { S.curve = !!Number(on); },
    fx() { const cols = ["#ffc94a", "#ff6f6f", "#5fe1ff", "#3ee69a", "#fff"]; for (let i = 0; i < 80; i++) S.parts.push({ x: rnd(0, W), y: rnd(-40, 0), vx: rnd(-40, 40), vy: rnd(80, 220), life: rnd(1, 2.2), col: cols[i % 5] }); },
    power() { return S.power; },
    tilt() { return Math.round(S.tilt * 100); },
    down() { return S.res; },
    dist() { return S.dist; },
    timing() { return S.timing; },
  },
  templates: (x) => {
    const B = x.B;
    const game = (gm) => B("sg_game", { G: gm });
    return [
      { id: "c6", name: "第六堂｜保齡球 5 球", xml: x.xml([
        x.H("rl_start", {}, [game("bowl"), x.set("第幾球", x.num(0)), x.stat("第幾球", x.vget("第幾球")), x.say("左右傾斜瞄準，揮一下丟球！")]),
        x.H("sg_bowl", {}, [x.change("第幾球", 1), x.stat("第幾球", x.vget("第幾球")), x.scoreV(B("sg_down")),
          x.ifThen(x.cmp(B("sg_down"), "EQ", x.num(10)), [x.say("全倒！加 5 分"), x.score(5), x.send("good"), B("sg_fx")], [x.ifThen(x.cmp(B("sg_down"), "GT", x.num(0)), [x.send("good")], [x.send("miss")])]),
          x.ifThen(x.cmp(x.vget("第幾球"), "GTE", x.num(5)), [x.win("5 球打完了！")])]),
      ]) },
      { id: "c6b", name: "第六堂進階｜護欄練習場", xml: x.xml([
        x.H("rl_start", {}, [game("bowl"), B("sg_bumper", { ON: "1" }), B("sg_pins", { N: "3" }), x.time(60), x.say("有護欄，不會洗溝！60 秒打倒最多瓶")]),
        x.H("sg_bowl", {}, [x.scoreV(B("sg_down")), x.ifThen(x.cmp(B("sg_down"), "EQ", x.num(3)), [x.say("全倒！"), x.sound("cheer")])]),
        x.H("rl_score", { N: 15 }, [B("sg_pins", { N: "10" }), B("sg_bumper", { ON: "0" }), x.say("升級！10 支瓶，拿掉護欄")]),
      ]) },
      { id: "c6c", name: "第六堂進階｜網球計分", xml: x.xml([
        x.H("rl_start", {}, [game("tennis"), x.set("電腦", x.num(0)), x.stat("電腦", x.vget("電腦")), x.say("先得 3 分獲勝！")]),
        x.H("sg_point", { WHO: "me" }, [x.score(1), x.send("good"), B("sg_cpu", { V: "1.5" })]),
        x.H("sg_point", { WHO: "cpu" }, [x.change("電腦", 1), x.stat("電腦", x.vget("電腦")), x.send("miss"), x.ifThen(x.cmp(x.vget("電腦"), "GTE", x.num(3)), [x.lose("電腦贏了")])]),
        x.H("sg_hit", {}, [x.ifThen(x.cmp(B("sg_timing"), "LT", x.num(60)), [x.say("完美！"), x.sound("ding")])]),
        x.H("rl_score", { N: 3 }, [x.win("你贏了！")]),
      ]) },
      { id: "c6d", name: "第六堂進階｜全壘打大賽", xml: x.xml([
        x.H("rl_start", {}, [game("base"), x.lives(3), B("sg_curve", { ON: "0" }), x.say("三個好球就出局！打越遠分數越高")]),
        x.H("sg_hit", {}, [x.stat("距離", B("sg_dist")), x.ifThen(x.cmp(B("sg_dist"), "GTE", x.num(100)), [x.score(3), x.say("全壘打！加 3 分"), B("sg_fx"), x.send("good")], [x.ifThen(x.cmp(B("sg_dist"), "GT", x.num(0)), [x.score(1)])])]),
        x.H("sg_miss", {}, [x.livesC(-1), x.send("miss")]),
        x.H("rl_score", { N: 6 }, [B("sg_speed", { V: "1.35" }), B("sg_curve", { ON: "1" }), x.say("投手認真了！球變快又會轉彎")]),
        x.H("rl_lives0", {}, [x.lose("三振出局！")]),
      ]) },
    ];
  },
  onPlay() {
    Object.assign(S, { lab: true, npins: 10, bumper: false, aim: true, ballSpd: 1, cpu: 1, curve: true, power: 0, res: 0, dist: 0, timing: 0, parts: [] });
    S.running = true; $("menu").hidden = true; $("endOv").hidden = true; labSetGame("bowl");
  },
  onEnd() { S.running = false; },
  onStop() { S.running = false; S.lab = false; Object.assign(S, { npins: 10, bumper: false, aim: true, ballSpd: 1, cpu: 1, curve: true }); },
  onMenu() { $("menu").hidden = false; },
});
$("labCard").onclick = () => { $("menu").hidden = true; LAB.open(); };
// 讓「每隔幾秒」「倒數」在運動會裡也會走
(function hookTick() { let last = performance.now(); (function t(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (S.lab) LAB.tick(dt); requestAnimationFrame(t); })(last); })();
if (location.hash === "#lab") { $("menu").hidden = true; LAB.open(); }
