// 一鍵加到主畫面：Android／電腦 Chrome 直接安裝；iPad、iPhone 顯示步驟說明
(function () {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isBluefy = /Bluefy/i.test(ua);
  let deferred = null;

  const css = `
  .kd-install-btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;border:3px solid var(--kd-ink,#2B1D14);background:var(--kd-mustard,#F5C547);color:var(--kd-ink,#2B1D14);
    box-shadow:5px 5px 0 var(--kd-ink,#2B1D14);font:900 16px/1 var(--kd-font,sans-serif);padding:12px 16px;text-decoration:none}
  .kd-install-btn img{width:26px;height:26px;border:2px solid var(--kd-ink,#2B1D14)}
  .kd-install-btn:active{transform:translate(3px,3px);box-shadow:2px 2px 0 var(--kd-ink,#2B1D14)}
  .kd-install-ov{position:fixed;inset:0;z-index:9999;background:rgba(43,29,20,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  .kd-install-card{max-width:440px;width:100%;background:var(--kd-paper-2,#FFF9EC);color:var(--kd-ink,#2B1D14);border:3px solid var(--kd-ink,#2B1D14);box-shadow:8px 8px 0 var(--kd-ink,#2B1D14);padding:20px;font-family:var(--kd-font,sans-serif)}
  .kd-install-card h3{margin:0 0 10px;font-size:22px;font-weight:900;display:flex;align-items:center;gap:10px}
  .kd-install-card h3 img{width:40px;height:40px;border:2px solid var(--kd-ink,#2B1D14)}
  .kd-install-card ol{margin:8px 0 12px;padding-left:22px;font-size:16px;line-height:1.9}
  .kd-install-card .note{font-size:13px;line-height:1.7;background:var(--kd-cream,#FFE9C7);border:2px solid var(--kd-ink,#2B1D14);padding:8px 10px;margin-bottom:12px}
  .kd-install-card .share{display:inline-block;width:20px;height:20px;vertical-align:-4px}
  .kd-install-card button{cursor:pointer;border:2px solid var(--kd-ink,#2B1D14);background:var(--kd-orange,#C4521A);color:#fff;font:900 15px/1 var(--kd-font,sans-serif);padding:10px 16px;box-shadow:3px 3px 0 var(--kd-ink,#2B1D14)}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const SHARE = '<svg class="share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>';
  function guide() {
    let title = "加到主畫面", steps, note = "";
    if (isIOS && isBluefy) {
      steps = ["點 Bluefy 下方的 <b>⋯</b> 或分享按鈕", "選「<b>加入主畫面</b>」或「加入書籤」", "名稱用「酷丁狐實驗室」，按<b>新增</b>"];
      note = "iPad、iPhone 只有 Bluefy 能連 micro:bit。如果 Bluefy 沒有「加入主畫面」，就把這一頁加入書籤，每次打開 Bluefy 點書籤就好。";
    } else if (isIOS) {
      steps = [`點網址列旁的分享按鈕 ${SHARE}`, "往下滑，點「<b>加入主畫面</b>」", "按右上角<b>新增</b>，主畫面就會出現酷丁狐"];
      note = "從主畫面打開可以看課程、玩不用藍牙的遊戲。要連 micro:bit 時，iPad 請用 <b>Bluefy</b> 瀏覽器打開實驗室。";
    } else {
      steps = ["點 Chrome 右上角的 <b>⋮</b>", "選「<b>加到主畫面</b>」或「<b>安裝應用程式</b>」", "按<b>安裝</b>，主畫面就會出現酷丁狐"];
    }
    const ov = document.createElement("div"); ov.className = "kd-install-ov";
    ov.innerHTML = `<div class="kd-install-card" role="dialog" aria-modal="true"><h3><img src="icon-192.png" alt="">${title}</h3><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>${note ? `<div class="note">${note}</div>` : ""}<button type="button">知道了</button></div>`;
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.tagName === "BUTTON") ov.remove(); });
    document.body.appendChild(ov);
  }
  async function install() {
    if (deferred) {
      deferred.prompt();
      const r = await deferred.userChoice.catch(() => null);
      deferred = null;
      if (r && r.outcome === "accepted") hideAll();
      return;
    }
    guide();
  }
  function hideAll() { document.querySelectorAll("[data-kd-install]").forEach((b) => (b.hidden = true)); }
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
  addEventListener("appinstalled", hideAll);
  function wire() {
    document.querySelectorAll("[data-kd-install]").forEach((b) => {
      if (standalone) { b.hidden = true; return; }
      b.addEventListener("click", (e) => { e.preventDefault(); install(); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
  window.KD_INSTALL = install;
})();
