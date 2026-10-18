"use strict";
/* 體感指揮家 — 規則實驗室（積木規則）。需要先載入 rulelab.js 和 maestro.js */
const { hat, act, val, dd, vin } = RuleLab.helpers;
const CM = "#b8432f";
const SECS = [["弦樂", "str"], ["木管", "wood"], ["銅管", "brass"], ["打擊", "drum"]];
function labSongEnd() {
  if (!LAB.fire("songend")) { LAB.api.win("演奏完畢！掌聲鼓勵！"); SFX.noise(2.5, 0.25, 2000, 0.2, "bandpass"); }
  else if (S.pos >= BEATS + 1) { S.running = false; if (LAB.running) LAB.api.win("演奏完畢！"); }
}
function fireworks(n) {
  const cols = ["#ffc94a", "#ff6f6f", "#5fe1ff", "#3ee69a", "#fff", "#ff8ad8"];
  for (let k = 0; k < n; k++) { const cx = rnd(W * 0.2, W * 0.8), cy = rnd(H * 0.15, H * 0.4), col = cols[k % cols.length];
    for (let i = 0; i < 40; i++) { const a = rnd(0, 6.28), v = rnd(40, 180); S.fw.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.8, 1.6), col }); } }
  SFX.noise(0.4, 0.3, 600);
}
const LAB = RuleLab.create({
  id: "maestro", title: "音樂會規則實驗室",
  tip: "<b>怎麼玩</b><br>1. 用「當進入第幾小節」改目標速度或燈光。<br>2. 用「當揮一拍」和「目前速度」判斷有沒有跟上。<br>3. 「當樂曲結束」決定成功或再演奏一次。<br><b>操作</b>：micro:bit 往下揮一下＝一拍，左右傾斜；或空白鍵、← →。",
  blocks: [
    hat("ms_beat", "當揮一拍", [], "每揮一下（或按空白鍵）執行"),
    hat("ms_everybar", "當每一小節開始", [], "樂曲每進入新的一小節執行"),
    hat("ms_bar", "當進入第 %1 小節", [{ type: "field_number", name: "N", value: 5, min: 1, max: 16, precision: 1 }], "《歡樂頌》一共 16 小節"),
    hat("ms_tilt", "當指揮棒傾向 %1", [dd("SIDE", [["左邊", "left"], ["右邊", "right"], ["中間", "mid"]])], "左右傾斜超過一半時執行"),
    hat("ms_songend", "當樂曲結束", [], "沒有這個積木時，演奏完就成功"),
    act("ms_target", "目標速度 %1 BPM", [vin("N", "Number")], CM, "速度錶上會出現綠色的目標範圍；設 0 就不顯示"),
    act("ms_vol", "%1 音量 %2", [dd("SEC", SECS), dd("V", [["普通", "1"], ["大聲", "1.6"], ["小聲", "0.5"], ["靜音", "0"]])], CM),
    act("ms_light", "舞台燈光 %1", [dd("L", [["溫暖", "warm"], ["藍色", "blue"], ["紅色", "red"], ["綠色", "green"], ["彩虹", "rainbow"], ["關燈", "dark"]])], CM),
    act("ms_fw", "放煙火 %1 顆", [vin("N", "Number")], CM),
    act("ms_clap", "觀眾鼓掌", [], CM),
    act("ms_restart", "從頭再演奏一次", [], CM, "放在「當樂曲結束」裡面可以一直演奏下去"),
    val("ms_bpm", "目前速度（BPM）", [], CM),
    val("ms_diff", "和目標差幾 BPM", [], CM, "目前速度減掉目標速度的絕對值"),
    val("ms_barno", "第幾小節", [], CM),
    val("ms_tiltv", "左右傾斜（-100～100）", [], CM),
  ],
  hats: ["ms_beat", "ms_everybar", "ms_bar", "ms_tilt", "ms_songend"],
  evNames: { beat: "當揮一拍", everybar: "當每一小節開始", bar: (a) => `當進入第 ${a} 小節`, tilt: "當指揮棒傾斜", songend: "當樂曲結束" },
  gens(F, h) {
    const { q, v, call, hatGen, O, num } = h;
    F.ms_beat = hatGen("beat"); F.ms_everybar = hatGen("everybar"); F.ms_songend = hatGen("songend");
    F.ms_bar = hatGen("bar", (b) => num(b.getFieldValue("N")));
    F.ms_tilt = hatGen("tilt", (b) => q(b.getFieldValue("SIDE")));
    F.ms_target = (b) => call("target", v(b, "N", "100"));
    F.ms_vol = (b) => call("vol", q(b.getFieldValue("SEC")), num(b.getFieldValue("V")));
    F.ms_light = (b) => call("light", q(b.getFieldValue("L")));
    F.ms_fw = (b) => call("fw", v(b, "N", "3"));
    F.ms_clap = () => call("clap");
    F.ms_restart = () => call("restart");
    for (const [t, f] of [["ms_bpm", "bpm"], ["ms_diff", "diff"], ["ms_barno", "barNo"], ["ms_tiltv", "tilt"]]) F[t] = () => [`api.${f}()`, O.FUNCTION_CALL];
  },
  toolbox: ({ n, b }) => [{ name: "音樂會", colour: CM, contents: [
    b("ms_target", { N: n(100) }), b("ms_vol"), b("ms_light"), b("ms_fw", { N: n(3) }), b("ms_clap"), b("ms_restart"),
    b("ms_bpm"), b("ms_diff"), b("ms_barno"), b("ms_tiltv")] }],
  api: {
    target(n) { S.labTarget = clamp(Math.round(Number(n) || 0), 0, 240); },
    vol(sec, v) { if (sec in S.vol) S.vol[sec] = clamp(Number(v), 0, 2); },
    light(l) { S.light = l; },
    fw(n) { fireworks(clamp(Math.round(Number(n) || 0), 0, 8)); },
    clap() { SFX.noise(2, 0.25, 2200, 0, "bandpass"); },
    restart() { S.pos = 0; S.next = 0; S.bar = -1; S.running = true; S.waiting = true; },
    bpm() { return Math.round(S.bpm || 0); },
    diff() { return S.labTarget ? Math.abs(Math.round((S.bpm || 0) - S.labTarget)) : 0; },
    barNo() { return Math.min(BARS, Math.floor(S.pos / 4) + 1); },
    tilt() { return Math.round(S.tilt * 100); },
  },
  templates: (x) => {
    const B = x.B, N = x.N;
    const tgt = (n) => B("ms_target", {}, { N: N(n) }), light = (l) => B("ms_light", { L: l }), vol = (sc, v) => B("ms_vol", { SEC: sc, V: v });
    const scoreRule = x.H("ms_beat", {}, [x.ifThen(x.cmp(B("ms_diff"), "LT", x.num(15)), [x.score(1)]), x.stat("速度", B("ms_bpm"))]);
    return [
      { id: "c8", name: "第八堂｜速度挑戰", xml: x.xml([
        x.H("rl_start", {}, [tgt(100), x.say("中板：每分鐘 100 拍")]),
        x.H("ms_bar", { N: 5 }, [tgt(72), x.say("慢板：每分鐘 72 拍"), light("blue")]),
        x.H("ms_bar", { N: 9 }, [tgt(140), x.say("快板：每分鐘 140 拍"), light("red")]),
        x.H("ms_bar", { N: 13 }, [tgt(100), x.say("回到中板"), light("warm")]),
        scoreRule,
        x.H("ms_everybar", {}, [x.send("bar")]),
        x.H("ms_songend", {}, [x.send("end"), B("ms_fw", {}, { N: N(5) }), x.win("演奏完畢！")]),
      ]) },
      { id: "c8b", name: "第八堂進階｜聲部輪流獨奏", xml: x.xml([
        x.H("rl_start", {}, [vol("wood", "0"), vol("brass", "0"), vol("drum", "0"), x.say("先聽弦樂獨奏")]),
        x.H("ms_bar", { N: 5 }, [vol("wood", "1.6"), vol("str", "0.5"), x.say("木管加入！")]),
        x.H("ms_bar", { N: 9 }, [vol("brass", "1.6"), vol("drum", "1"), x.say("銅管和鼓加入！"), light("rainbow")]),
        x.H("ms_bar", { N: 13 }, [vol("str", "1.6"), vol("wood", "1.6"), x.say("全體大合奏！")]),
        x.H("ms_songend", {}, [B("ms_clap"), B("ms_fw", {}, { N: N(6) }), x.win("全體謝幕！")]),
      ]) },
      { id: "c8c", name: "第八堂進階｜傾斜控制燈光", xml: x.xml([
        x.H("rl_start", {}, [x.say("往左傾斜變藍燈，往右傾斜變紅燈")]),
        x.H("ms_tilt", { SIDE: "left" }, [light("blue"), vol("str", "1.6")]),
        x.H("ms_tilt", { SIDE: "right" }, [light("red"), vol("brass", "1.6")]),
        x.H("ms_tilt", { SIDE: "mid" }, [light("warm"), vol("str", "1"), vol("brass", "1")]),
        x.H("ms_songend", {}, [x.win("精彩的燈光秀！")]),
      ]) },
      { id: "c8d", name: "第八堂進階｜安可三次", xml: x.xml([
        x.H("rl_start", {}, [x.set("安可", x.num(0)), tgt(90)]),
        scoreRule,
        x.H("ms_songend", {}, [x.change("安可", 1), x.stat("安可", x.vget("安可")),
          x.ifThen(x.cmp(x.vget("安可"), "LT", x.num(3)), [B("ms_clap"), x.say("安可！再快一點！"), tgt(110), B("ms_restart")],
            [B("ms_fw", {}, { N: N(8) }), x.win("三次安可完成！")])]),
        x.H("rl_score", { N: 40 }, [tgt(120)]),
      ]) },
    ];
  },
  onPlay() {
    Object.assign(S, { vol: { str: 1, wood: 1, brass: 1, drum: 1 }, labTarget: 0, light: "warm", fw: [], side: "mid" });
    start("lab"); $("tgtBox").hidden = $("accBox").hidden = true;
  },
  onEnd() { S.running = false; },
  onStop() { S.running = false; S.mode = null; S.vol = { str: 1, wood: 1, brass: 1, drum: 1 }; S.light = "warm"; S.labTarget = 0; },
  onMenu() { $("menu").hidden = false; },
});
$("labCard").onclick = () => { $("menu").hidden = true; LAB.open(); };
(function hookTick() { let last = performance.now(); (function t(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (S.mode === "lab" && S.running) LAB.tick(dt); requestAnimationFrame(t); })(last); })();
if (location.hash === "#lab") { $("menu").hidden = true; LAB.open(); }
