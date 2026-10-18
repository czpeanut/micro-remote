"use strict";
/*
 * 主題2 共用：micro:bit 藍牙串口（Nordic UART）連線
 *  - MB.connect()：選擇 micro:bit 並連線
 *  - MB.send("word")：送出 word#
 *  - MB.on(fn)：收到訊息時呼叫 fn({key, value}) 或 fn({word})
 *    micro:bit 端用「藍牙串口 寫入值 name = 數字」→ 收到 "name:數字"
 *    或「藍牙串口 寫入字串 xxx#」→ 收到 word
 *  需要頁面上有 #dot #status #connectBtn #log（沒有也不會壞）
 */
const MB = (() => {
  const NUS = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const $ = (id) => document.getElementById(id);
  let device = null, rxChar = null, sending = Promise.resolve(), inbox = "", handlers = [], lastRx = 0;

  function setStatus(st, name) {
    const dot = $("dot"), status = $("status"), btn = $("connectBtn");
    if (dot) dot.className = "dot" + (st === "on" ? " on" : st === "wait" ? " wait" : "");
    if (status) status.textContent = st === "on" ? `已連接 ${name || ""}` : st === "wait" ? "連接中…" : "未連接";
    if (btn) btn.textContent = st === "on" ? "中斷連接" : "連接 micro:bit";
  }
  function log(t, cls) {
    const el = $("log"); if (!el) return;
    const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = t; el.appendChild(d);
    while (el.childNodes.length > 6) el.removeChild(el.firstChild);
  }
  async function nusService(dev) {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        const server = dev.gatt.connected ? dev.gatt : await dev.gatt.connect();
        await new Promise((r) => setTimeout(r, 300 + i * 400));
        if (!dev.gatt.connected) throw new Error("disconnected");
        return await server.getPrimaryService(NUS);
      } catch (e) { last = e; await new Promise((r) => setTimeout(r, 700)); }
    }
    const msg = String((last && last.message) || last);
    if (/disconnected|GATT Server/i.test(msg)) throw new Error("連不上：請確認 micro:bit 的程式有「藍牙串口服務」積木，而且專案設定為「不需配對」");
    throw last;
  }
  async function nusChars(svc) {
    const a = await svc.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    const b = await svc.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    const canWrite = (c) => c.properties.write || c.properties.writeWithoutResponse;
    return canWrite(a) ? { rx: a, tx: b } : { rx: b, tx: a };
  }
  async function connect() {
    if (device && device.gatt.connected) { device.gatt.disconnect(); return; }
    if (!navigator.bluetooth) { alert("這個瀏覽器不支援藍牙：電腦或 Android 請用 Chrome／Edge，iPad 請用 Bluefy。"); return; }
    try {
      setStatus("wait");
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }, { namePrefix: "BBC micro:bit" }], optionalServices: [NUS] });
      device.addEventListener("gattserverdisconnected", () => { rxChar = null; setStatus("off"); log("已中斷連接", "e"); });
      const svc = await nusService(device);
      const ch = await nusChars(svc); rxChar = ch.rx;
      await ch.tx.startNotifications();
      ch.tx.addEventListener("characteristicvaluechanged", (e) => receive(new TextDecoder().decode(e.target.value)));
      setStatus("on", device.name); log(`已連接 ${device.name || "micro:bit"}`);
    } catch (err) {
      if (!err || err.name !== "NotFoundError") log(`連接失敗：${(err && err.message) || err}`, "e");
      setStatus("off");
    }
  }
  function send(word) {
    if (!rxChar) return;
    const data = new TextEncoder().encode(word + "#");
    sending = sending.then(async () => {
      try {
        if (rxChar.properties && rxChar.properties.writeWithoutResponse) await rxChar.writeValueWithoutResponse(data);
        else await rxChar.writeValue(data);
        log(`送出 ${word}#`, "s");
      } catch (err) { log(`送出失敗 ${err.message || err}`, "e"); }
    });
  }
  function receive(chunk) {
    inbox += chunk;
    const parts = inbox.split(/[#\r\n]+/); inbox = parts.pop(); if (inbox.length > 120) inbox = "";
    for (const raw of parts) {
      const msg = raw.trim(); if (!msg) continue;
      lastRx = performance.now();
      const m = msg.match(/^([a-zA-Z]+)\s*:\s*(-?[\d.]+)$/);
      const ev = m ? { key: m[1].toLowerCase(), value: parseFloat(m[2]) } : { word: msg.toLowerCase() };
      if (!m) log(`收到 ${msg}#`, "r");
      handlers.forEach((h) => h(ev));
    }
  }
  function on(fn) { handlers.push(fn); }
  function live() { return lastRx > 0 && performance.now() - lastRx < 2500; }
  function connected() { return !!rxChar; }
  /* 給自動測試用：模擬 micro:bit 送來的字串 */
  function inject(text) { lastRx = performance.now(); receive(text); }
  document.addEventListener("DOMContentLoaded", () => { const b = $("connectBtn"); if (b) b.addEventListener("click", connect); });
  return { connect, send, on, live, connected, log, inject };
})();

/* 共用音效（Web Audio） */
const SFX = (() => {
  let ac = null, enabled = true;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
  function tone(f1, f2, dur, type = "sine", vol = 0.18, delay = 0) {
    const a = audio(); if (!a || !enabled) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq = 800, delay = 0, type = "lowpass") {
    const a = audio(); if (!a || !enabled) return;
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = type; f.frequency.value = freq; g.gain.value = vol; s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + delay);
  }
  return { audio, tone, noise, set(v) { enabled = v; }, get on() { return enabled; } };
})();
