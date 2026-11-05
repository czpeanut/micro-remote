"use strict";
/*
 * touchpad.js — 遊戲體驗版的觸控按鈕
 *  只有網址有 ?test=1（從遊戲體驗版進來）而且是手機／平板（觸控螢幕）時才出現；?touch=1 可以強制顯示。
 *  按鈕會送出和鍵盤一樣的按鍵事件，遊戲本身不用改。一般上課的網址完全不受影響。
 */
(function () {
  const q = location.search;
  if (!/[?&]test=1/.test(q)) return;
  const touch = /[?&]touch=1/.test(q) || matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (!touch) return;
  const page = (location.pathname.split("/").pop() || "").replace(".html", "");
  // 每個遊戲要哪些按鈕：[按鍵, 顯示文字, 位置]
  const DPAD = [["ArrowUp", "▲", "u"], ["ArrowLeft", "◀", "l"], ["ArrowDown", "▼", "d"], ["ArrowRight", "▶", "r"]];
  const LR = [["ArrowLeft", "◀", "l"], ["ArrowRight", "▶", "r"]];
  const UD = [["ArrowUp", "▲", "u"], ["ArrowDown", "▼", "d"]];
  const CFG = {
    sub: { left: DPAD, right: [[" ", "A", "a", "聲納"]] },
    lab: { left: DPAD, right: [[" ", "A", "a"]], when: () => { const g = document.getElementById("game"); return g && !g.hidden; } },
    space: { left: UD },
    sports: { left: LR, right: [[" ", "揮", "a", "按住蓄力"]] },
    race: { left: LR, right: [["ArrowUp", "油門", "a"], ["ArrowDown", "煞車", "b"], ["d", "D", "c"], ["e", "E", "e"]] },
    flight: { left: DPAD, right: [["w", "加速", "a"], ["s", "減速", "b"]] },
    maestro: { left: LR, right: [[" ", "拍", "a", "打一拍"]] },
  };
  const cfg = CFG[page];
  if (!cfg) return;   // 潛艇出航、聲納尋寶畫面上已經有方向按鈕

  const css = document.createElement("style");
  css.textContent = `
  .tp { position: fixed; bottom: max(14px, env(safe-area-inset-bottom, 0px)); z-index: 6; display: grid; gap: 8px; touch-action: none; user-select: none; -webkit-user-select: none; }
  .tp.l { bottom: calc(max(14px, env(safe-area-inset-bottom, 0px)) + 52px); left: max(14px, env(safe-area-inset-left, 0px)); grid-template-columns: repeat(3, 62px); grid-template-rows: repeat(2, 62px); }
  .tp.r { right: max(14px, env(safe-area-inset-right, 0px)); grid-template-columns: repeat(2, 72px); grid-auto-rows: 72px; }
  .tp.l.two { grid-template-rows: 62px; }
  .tp button { border: 2px solid rgba(255,255,255,.55); background: rgba(10,20,30,.45); color: #fff; border-radius: 16px; font: 900 20px/1 system-ui, sans-serif;
    touch-action: none; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(3px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .tp.r button { border-radius: 50%; background: rgba(217,102,58,.55); font-size: 18px; }
  .tp button small { font-size: 10px; font-weight: 700; opacity: .85; }
  .tp button.on { background: rgba(255,201,74,.75); color: #2b1d00; }
  .tp .u { grid-column: 2; grid-row: 1; } .tp .l { grid-column: 1; grid-row: 2; } .tp .d { grid-column: 2; grid-row: 2; } .tp .r { grid-column: 3; grid-row: 2; }
  .tp.l.two .l { grid-row: 1; grid-column: 1; } .tp.l.two .r { grid-row: 1; grid-column: 3; }
  .tp.l.ud { grid-template-columns: 62px; } .tp.l.ud .u, .tp.l.ud .d { grid-column: 1; }
  `;
  document.head.appendChild(css);

  const fire = (type, key) => {
    const code = key === " " ? "Space" : key.length === 1 ? "Key" + key.toUpperCase() : key;
    document.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));   // 會冒泡到 window
  };
  function pad(list, side, extra) {
    const box = document.createElement("div"); box.className = `tp ${side} ${extra || ""}`;
    for (const [key, label, pos, hint] of list) {
      const b = document.createElement("button"); b.type = "button"; b.className = pos;
      b.innerHTML = label + (hint ? `<small>${hint}</small>` : "");
      let down = false;
      const press = (e) => { e.preventDefault(); if (down) return; down = true; b.classList.add("on"); try { b.setPointerCapture(e.pointerId); } catch (_) {} fire("keydown", key); };
      const release = (e) => { if (!down) return; down = false; b.classList.remove("on"); fire("keyup", key); };
      b.addEventListener("pointerdown", press);
      b.addEventListener("pointerup", release); b.addEventListener("pointercancel", release); b.addEventListener("lostpointercapture", release);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      box.appendChild(b);
    }
    document.body.appendChild(box);
    return box;
  }
  function init() {
    const boxes = [];
    if (cfg.left) boxes.push(pad(cfg.left, "l", cfg.left.length === 2 ? (cfg.left[0][2] === "u" ? "ud" : "two") : ""));
    if (cfg.right) boxes.push(pad(cfg.right, "r"));
    if (cfg.when) { const tick = () => { const on = cfg.when(); boxes.forEach((b) => (b.style.display = on ? "" : "none")); requestAnimationFrame(tick); }; tick(); }
    // 雙擊不要放大畫面
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
