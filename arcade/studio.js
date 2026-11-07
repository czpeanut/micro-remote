"use strict";
/*
 * studio.js — 遊戲工坊的編輯畫面：左邊拼積木，右邊即時玩
 *  網址：studio.html?c=low|mid|high　（&answer=1 載入參考解答，老師用）
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const P = new URLSearchParams(location.search);
  const GAME = window.ARC_GAMES[P.get("c")] || window.ARC_GAMES.low;
  const E = window.ArcEngine, ST = window.ArcStore;
  let ses = ST.session();
  if (ses && ses.course !== GAME.id) ses = null;
  const VIEW = !!(ses && ses.view);
  const STUDENT = !!(ses && !ses.view);
  const DRAFT = (STUDENT ? ses.sid : "guest") + "." + GAME.id;
  let ws = null, dirty = false, lastSaved = "", running = false, saveT = 0, runT = 0;

  document.title = GAME.name + "｜酷丁狐遊戲工坊";
  $("gName").textContent = GAME.name;
  $("gGrade").textContent = GAME.grade + "・寒訓";
  $("hint").innerHTML = GAME.desc + "<br>鍵盤：<kbd>方向鍵</kbd> 移動　<kbd>空白鍵</kbd> = A　<kbd>X</kbd> = B　（這個遊戲：" + GAME.keys + "）";

  const status = (t, cls) => { const s = $("status"); s.textContent = t || ""; s.className = "status " + (cls || ""); };
  function modal(title, text, btns) {
    $("mTitle").textContent = title; $("mText").innerHTML = text; const box = $("mBtns"); box.innerHTML = "";
    for (const [label, cls, fn] of btns) { const b = document.createElement("button"); b.className = "btn " + (cls || ""); b.textContent = label; b.onclick = () => { $("modal").hidden = true; if (fn) fn(); }; box.appendChild(b); }
    $("modal").hidden = false;
  }

  // ---- 身分 ----
  if (STUDENT) {
    $("who").innerHTML = `<span>同學：</span><b></b><span></span><button class="btn ghost" id="outBtn">登出</button>`;
    $("who").children[1].textContent = ses.name || "同學"; $("who").children[2].textContent = "（" + ses.sid + "）";
    $("outBtn").onclick = () => leave(() => { ST.setSession(null); location.href = "index.html"; });
  } else if (VIEW) {
    $("who").innerHTML = `<span>家長檢視：</span><b></b><span>的作品</span>`;
    $("who").children[1].textContent = (ses.name || ses.sid);
    $("saveBtn").hidden = true; $("autoRun").parentElement.hidden = true;
    document.body.classList.add("ro");
  } else {
    $("who").innerHTML = `<span>訪客（作品只存在這台電腦）</span><a class="btn" href="index.html?c=${GAME.id}">登入</a>`;
  }

  // ---- 積木 ----
  window.ArcBlocks.init();
  ws = Blockly.inject("blockly", {
    toolbox: VIEW ? null : GAME.toolbox, readOnly: VIEW, renderer: "zelos", trashcan: !VIEW, sounds: false, media: "../vendor/blockly/media/",
    zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 1.6, minScale: 0.3 },
    grid: VIEW ? undefined : { spacing: 28, length: 2, colour: "#d9e2ea", snap: true },
    move: { scrollbars: true, drag: true, wheel: false },
  });
  if (!VIEW) ws.addChangeListener(Blockly.Events.disableOrphans);

  const dump = () => JSON.stringify({ v: 1, blocks: Blockly.serialization.workspaces.save(ws) });
  function load(json) {
    try {
      const d = typeof json === "string" ? JSON.parse(json) : json;
      Blockly.Events.disable();
      try { ws.clear(); Blockly.serialization.workspaces.load(d.v ? d.blocks : d, ws); } finally { Blockly.Events.enable(); }
      return true;
    } catch (e) { console.warn(e); return false; }
  }
  // 把最上層的積木排成兩欄，不要疊在一起
  function arrange() {
    const tops = ws.getTopBlocks(true); if (tops.length < 2) return;
    const sizes = tops.map((b) => b.getHeightWidth());
    const total = sizes.reduce((a, s) => a + s.height + 30, 0);
    let x = 30, y = 30, colW = 0, col = 0;
    tops.sort((a, b) => (a.type === "a_start" ? -1 : b.type === "a_start" ? 1 : 0));
    tops.forEach((b, i) => {
      const sz = b.getHeightWidth();
      if (col === 0 && y > 30 && y + sz.height / 2 > total / 2 + 30) { x += colW + 60; y = 30; colW = 0; col = 1; }
      const xy = b.getRelativeToSurfaceXY(); b.moveBy(x - xy.x, y - xy.y);
      y += sz.height + 30; colW = Math.max(colW, sz.width);
    });
  }
  let initial = null;
  if (P.get("answer") === "1") initial = GAME.answer;
  else if (ses && ses.data) initial = ses.data;
  else if (STUDENT || !VIEW) initial = ST.draft.get(DRAFT);
  if (!initial || !load(initial)) load(window.ARC_GAMES.start);
  else if (P.get("answer") === "1") arrange();
  lastSaved = STUDENT && ses.data ? ses.data : "";
  if (VIEW) { setTimeout(() => { ws.zoomToFit && ws.zoomToFit(); }, 50); }
  else ws.scroll(0, 0);

  ws.addChangeListener((e) => {
    if (e.isUiEvent || VIEW) return;
    if (e.type === Blockly.Events.FINISHED_LOADING) return;
    dirty = true;
    clearTimeout(saveT); saveT = setTimeout(autosave, 4000);
    ST.draft.set(DRAFT, dump());
    if (STUDENT) status("尚未存檔");
    if ($("autoRun").checked && running) { clearTimeout(runT); runT = setTimeout(run, 700); }
  });

  // ---- 存檔 ----
  async function save(manual) {
    const data = dump();
    if (!STUDENT) {
      ST.draft.set(DRAFT, data);
      if (manual) modal("先登入才能存到雲端", "現在是訪客模式，作品只存在這台電腦的瀏覽器裡。<br>用學號登入後，換一台電腦也能打開自己的遊戲，家長也看得到。", [["去登入", "amber", () => leave(() => (location.href = "index.html?c=" + GAME.id))], ["繼續玩", ""]]);
      return true;
    }
    if (data === lastSaved && !manual) { dirty = false; status("已存檔", "ok"); return true; }
    status("存檔中…");
    const r = await ST.save(ses, data);
    if (r && r.ok) {
      lastSaved = data; dirty = false; ses.data = data; ST.setSession(ses);
      const t = new Date(); status(`已存檔 ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`, "ok"); return true;
    }
    status((r && r.err) || "存檔失敗", "err");
    if (manual) modal("存檔失敗", ((r && r.err) || "請再試一次") + "<br>作品還在這台電腦裡，網路恢復後再按一次「存檔」。", [["好", "amber"]]);
    return false;
  }
  const autosave = () => { if (STUDENT && dirty) save(false); };
  $("saveBtn").onclick = () => save(true);
  function leave(go) {
    if (STUDENT && dirty) { save(false).then((ok) => (ok ? go() : modal("還沒存好", "作品還沒存到雲端，確定要離開嗎？", [["離開", "", go], ["留下來", "amber"]]))); }
    else go();
  }
  window.addEventListener("beforeunload", (e) => { if (STUDENT && dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---- 遊戲 ----
  E.attach($("cv"), 4);
  E.stop();
  E.setStatus((s) => {
    if (s.type === "error") { $("err").textContent = s.msg; $("err").hidden = false; }
  });
  function run() {
    $("err").hidden = true; $("cover").hidden = true; running = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    Blockly.hideChaff && Blockly.hideChaff();
    const code = window.ArcBlocks.code(ws);
    window.__lastCode = code;
    E.run(code);
    $("pauseBtn").textContent = "❚❚ 暫停";
    if (matchMedia("(max-width: 860px)").matches) tab("game");
  }
  function stop() {
    running = false; E.stop(); $("cover").hidden = false; $("cTitle").textContent = "遊戲停止了"; $("cText").textContent = "按「執行」重新開始"; $("coverRun").textContent = "▶ 執行";
  }
  $("runBtn").onclick = run; $("coverRun").onclick = run; $("stopBtn").onclick = stop;
  $("pauseBtn").onclick = () => { if (!running) return; const p = !E.isPaused(); E.pause(p); $("pauseBtn").textContent = p ? "▶ 繼續" : "❚❚ 暫停"; };
  if (VIEW) { $("cTitle").textContent = (ses.name || "同學") + " 做的「" + GAME.name + "」"; $("cText").textContent = "按「執行」開始玩，左邊是他拼的積木"; }
  else { $("cTitle").textContent = GAME.name; $("cText").textContent = GAME.desc; }

  // 螢幕按鈕（滑鼠、觸控都可以）
  document.querySelectorAll("#pad button").forEach((b) => {
    const k = b.dataset.k; let down = false;
    const on = (e) => { e.preventDefault(); if (down) return; down = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (_) {} E.press(k, true); };
    const off = () => { if (!down) return; down = false; b.classList.remove("on"); E.press(k, false); };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  // ---- 手機：積木／遊戲 分頁 ----
  function tab(which) {
    $("main").className = "main show-" + (which === "game" ? "game" : "blocks");
    $("tabBlocks").classList.toggle("amber", which !== "game"); $("tabGame").classList.toggle("amber", which === "game");
    setTimeout(() => Blockly.svgResize(ws), 30);
  }
  $("tabBlocks").onclick = () => tab("blocks"); $("tabGame").onclick = () => tab("game");
  tab(VIEW ? "game" : "blocks");
  window.addEventListener("resize", () => Blockly.svgResize(ws));
  if (STUDENT) status(lastSaved ? "已載入雲端作品" : "新作品", "ok");

  window.__studio = { ws, run, stop, save, dump, load };
})();
