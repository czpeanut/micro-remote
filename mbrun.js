"use strict";
/*
 * mbrun.js — 接收端連線（主題1 第七、八堂）
 *  micro:bit 裡要有第六堂下載的程式（深海探險擴展 0.2.0 起，內含「酷丁狐連線」接收端）。
 *  流程：連接 → 問版本 V? →（遊戲模式 VG1）送 KDWEB，micro:bit 重新開機 → 自動連回 → VW1 已就緒
 *  LED：網頁送 L+25 碼；按鈕／搖晃／傾斜：micro:bit 回 A、B、AB、G、P、Tx,y
 */
window.MBRun = (function () {
  const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let device = null, rx = null, tx = null, inbox = "", q = Promise.resolve();
  let state = "off";              // off | wait | switching | reconnect | ready | old
  let wantTilt = false, waiter = null, manualOff = false;
  const leds = new Array(25).fill(0); let sentFrame = "", frameTimer = 0;
  const listeners = { state: [], event: [], led: [] };
  const emit = (k, ...a) => listeners[k].forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });
  function setState(s, note) { state = s; emit("state", s, note || "", device && device.name); }

  // ---------- 寫入（拆成 20 位元組一段，排隊送出） ----------
  function write(word) {
    if (!rx) return Promise.resolve();
    const data = new TextEncoder().encode(word + "#");
    q = q.then(async () => {
      for (let i = 0; i < data.length; i += 20) {
        const part = data.slice(i, i + 20);
        try {
          if (rx.properties && rx.properties.writeWithoutResponse) await rx.writeValueWithoutResponse(part);
          else await rx.writeValue(part);
        } catch (e) { console.warn("write", e); return; }
      }
    });
    return q;
  }
  function receive(chunk) {
    inbox += chunk;
    const parts = inbox.split("#"); inbox = parts.pop(); if (inbox.length > 120) inbox = "";
    for (const raw of parts) {
      const m = raw.trim(); if (!m) continue;
      if (waiter && /^V[GW]\d+$/.test(m)) { const w = waiter; waiter = null; w(m); continue; }
      if (m === "A" || m === "B" || m === "AB" || m === "G" || m === "P") emit("event", m);
      else if (m[0] === "T") { const [x, y] = m.slice(1).split(",").map(Number); if (!isNaN(x) && !isNaN(y)) emit("event", "T", x, y); }
    }
  }
  function ask(ms) {
    return new Promise((res) => { const t = setTimeout(() => { waiter = null; res(null); }, ms); waiter = (v) => { clearTimeout(t); res(v); }; write("V?"); });
  }
  async function attach() {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
        await sleep(300 + i * 300);
        const svc = await server.getPrimaryService(NUS);
        const a = await svc.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
        const b = await svc.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
        const canWrite = (c) => c.properties.write || c.properties.writeWithoutResponse;
        [rx, tx] = canWrite(a) ? [a, b] : [b, a];
        await tx.startNotifications();
        tx.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value)));
        inbox = ""; q = Promise.resolve();
        return true;
      } catch (e) { last = e; await sleep(600); }
    }
    throw last || new Error("連不上");
  }
  function onDrop() {
    rx = null; tx = null;
    if (manualOff) { manualOff = false; if (state !== "checked") setState("off"); return; }
    if (state === "switching") return;   // 切換時本來就會斷線
    if (state === "ready") { setState("reconnect", "連線中斷，正在連回…"); reconnect(); }
  }
  async function reconnect() {
    for (let i = 0; i < 20; i++) {
      await sleep(i ? 1500 : 1200);
      if (!device || manualOff) return;
      try {
        await attach();
        const v = await ask(2500);
        if (v && v[1] === "W") { ready(); return; }
        if (v && v[1] === "G") { await takeover(); return; }   // 不小心按到重設鈕：再接管一次
      } catch (e) { /* 再試 */ }
    }
    setState("off", "連不回來：請按「連接 micro:bit」重新選一次");
  }
  async function takeover() {
    setState("switching", "micro:bit 正在重新開機，切換成接收端…");
    write("KDWEB");
    await sleep(600);
    try { if (device.gatt.connected) device.gatt.disconnect(); } catch (e) {}
    setState("reconnect", "等 micro:bit 開機，自動連回中…");
    await reconnect();
  }
  function ready() {
    setState("ready", "已就緒");
    sentFrame = ""; pushFrame(true);
    if (wantTilt) write("T1");
  }
  async function connect(opt) {
    const checkOnly = !!(opt && opt.checkOnly);
    if (!navigator.bluetooth) { setState("off", "這個瀏覽器不支援藍牙：Android 請用 Chrome，iPad 請用 Bluefy"); return; }
    if (device && device.gatt.connected) { manualOff = true; device.gatt.disconnect(); return; }
    try {
      setState("wait", "請在清單裡選你的 micro:bit");
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }, { namePrefix: "BBC micro:bit" }], optionalServices: [NUS] });
      device.addEventListener("gattserverdisconnected", onDrop);
      setState("wait", "連接中…");
      await attach();
      const v = await ask(2500);
      if (!v) { setState("old", "這片 micro:bit 裡沒有接收端：請用第六堂的起始專案重新下載一次"); return; }
      if (checkOnly) {   // 第六堂下課前檢查：只問版本，不切換
        setState("checked", v[1] === "W" ? "接收端已就緒（正在接收端模式）" : "有接收端，可以上第七堂");
        manualOff = true; try { device.gatt.disconnect(); } catch (e) {}
        return;
      }
      if (v[1] === "W") ready(); else await takeover();
    } catch (e) {
      if (e && e.name === "NotFoundError") setState("off"); else setState("off", "連接失敗：" + ((e && e.message) || e));
    }
  }
  async function release() {   // 讓 micro:bit 回到學生自己的遊戲
    if (!rx) return;
    manualOff = true; await write("BYE"); await sleep(300);
    try { device.gatt.disconnect(); } catch (e) {}
    setState("off", "micro:bit 已回到第六堂的遊戲");
  }

  // ---------- LED ----------
  function pushFrame(now) {
    if (frameTimer && !now) return;
    const go = () => {
      frameTimer = 0;
      if (state !== "ready") return;
      const f = "L" + leds.map((v) => Math.round((v / 255) * 9)).join("");
      if (f !== sentFrame) { sentFrame = f; write(f); }
    };
    if (now) go(); else frameTimer = setTimeout(go, 60);
  }
  function setLeds(arr) { for (let i = 0; i < 25; i++) leds[i] = arr[i] | 0; emit("led", leds); pushFrame(); }
  // 捲動文字時 micro:bit 自己畫；捲完要把網頁的畫面重送一次
  function scroll(text, ms) { if (state !== "ready") return; write("S" + String(text).slice(0, 40)); setTimeout(() => { sentFrame = ""; pushFrame(); }, ms || 3000); }
  function tilt(on) { wantTilt = on; if (state === "ready") write(on ? "T1" : "T0"); }

  return {
    connect, release, setLeds, scroll, tilt, leds,
    on: (k, f) => listeners[k].push(f),
    get state() { return state; }, get name() { return device && device.name; },
  };
})();
