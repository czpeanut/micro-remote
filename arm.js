"use strict";

// 機械手臂遙控：和 app.js 一樣使用 micro:bit 的 Nordic UART Service（MakeCode「藍牙串口」積木）。
// 每個按鈕送出「英文單字 + #」，micro:bit 端用「藍牙串口 讀取直到 #」接收。
const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // phone -> micro:bit (write)
const NUS_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // micro:bit -> phone (notify)

const els = {
  connectBtn: document.getElementById("connectBtn"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  deviceName: document.getElementById("deviceName"),
  unsupportedBanner: document.getElementById("unsupportedBanner"),
  autoStopToggle: document.getElementById("autoStopToggle"),
  log: document.getElementById("log"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  helpBtn: document.getElementById("helpBtn"),
  helpDialog: document.getElementById("helpDialog"),
  closeHelpBtn: document.getElementById("closeHelpBtn"),
  recBtn: document.getElementById("recBtn") || document.createElement("button"),
};

let device = null;
let rxChar = null;
let txChar = null;
let activeCmd = null;
let sending = Promise.resolve(); // 依序送出，避免 GATT 忙碌時掉指令

function log(text, cls) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  const t = new Date().toLocaleTimeString("zh-TW", { hour12: false });
  line.textContent = `[${t}] ${text}`;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
  while (els.log.childNodes.length > 200) els.log.removeChild(els.log.firstChild);
}

function setStatus(state, name) {
  els.statusDot.className = "dot" + (state === "connected" ? " connected" : state === "connecting" ? " connecting" : "");
  els.statusText.textContent = state === "connected" ? "已連接" : state === "connecting" ? "連接中…" : "未連接";
  els.deviceName.textContent = name ? `(${name})` : "";
  els.connectBtn.textContent = state === "connected" ? "中斷" : "連接";
  els.connectBtn.classList.toggle("disconnect", state === "connected");
  els.connectBtn.disabled = state === "connecting";
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

async function connect() {
  if (!navigator.bluetooth) return;
  try {
    setStatus("connecting");
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE_UUID] }, { namePrefix: "BBC micro:bit" }],
      optionalServices: [NUS_SERVICE_UUID],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);
    const service = await nusService(device);
    ({ rx: rxChar, tx: txChar } = await nusChars(service));
    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged", onNotify);
    setStatus("connected", device.name || "micro:bit");
    log(`已連接 ${device.name || "micro:bit"}`);
  } catch (err) {
    if (err && err.name === "NotFoundError") {
      setStatus("disconnected");
      return;
    }
    log(`連接失敗：${err.message || err}`, "err");
    setStatus("disconnected");
  }
}

function disconnect() {
  if (device && device.gatt.connected) device.gatt.disconnect();
  else onDisconnected();
}

function onDisconnected() {
  rxChar = null;
  txChar = null;
  activeCmd = null;
  els.recBtn.classList.remove("recording");
  setStatus("disconnected");
  log("已中斷連接");
}

function onNotify(event) {
  log(`收到：${new TextDecoder().decode(event.target.value)}`, "recv");
}

function send(word) {
  if (!rxChar) return;
  const data = new TextEncoder().encode(word + "#");
  sending = sending.then(async () => {
    try {
      if (rxChar.properties && rxChar.properties.writeWithoutResponse) await rxChar.writeValueWithoutResponse(data);
      else await rxChar.writeValue(data);
      log(`送出：${word}#`, "sent");
    } catch (err) {
      log(`送出失敗：${err.message || err}`, "err");
    }
  });
}

function bindButtons() {
  document.querySelectorAll(".pad-btn[data-cmd]").forEach((btn) => {
    const cmd = btn.dataset.cmd;
    const hold = btn.hasAttribute("data-hold");

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!rxChar) return;
      btn.classList.add("active");
      vibrate(12);
      if (hold) activeCmd = cmd;
      if (cmd === "rec") els.recBtn.classList.add("recording");
      if (cmd === "play") els.recBtn.classList.remove("recording");
      send(cmd);
    });

    const end = (e) => {
      e.preventDefault();
      btn.classList.remove("active");
      if (!hold || activeCmd !== cmd) return;
      activeCmd = null;
      if (els.autoStopToggle.checked) send("stop");
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("pointerleave", end);
  });
}

function init() {
  if (!navigator.bluetooth) {
    els.unsupportedBanner.hidden = false;
    els.connectBtn.disabled = true;
  }
  setStatus("disconnected");
  bindButtons();
  els.connectBtn.addEventListener("click", () => {
    if (device && device.gatt.connected) disconnect();
    else connect();
  });
  els.clearLogBtn.addEventListener("click", () => { els.log.innerHTML = ""; });
  els.helpBtn.addEventListener("click", () => els.helpDialog.showModal());
  els.closeHelpBtn.addEventListener("click", () => els.helpDialog.close());
}

document.addEventListener("DOMContentLoaded", init);

// micro:bit 的 UART 和 Nordic 標準相反：6e400002 是 micro:bit 送出（indicate），6e400003 才是寫入。
// 依特性的屬性判斷哪個能寫，兩種韌體都能連。
async function nusChars(svc) {
  const a = await svc.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
  const b = await svc.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
  const canWrite = (c) => c.properties.write || c.properties.writeWithoutResponse;
  return canWrite(a) ? { rx: a, tx: b } : { rx: b, tx: a };
}

// 連上後再取服務；有些電腦會在剛連上時斷一下，所以重試三次。
async function nusService(device) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
      await new Promise((r) => setTimeout(r, 300 + i * 400));
      if (!device.gatt.connected) throw new Error("disconnected");
      return await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  const msg = String((last && last.message) || last);
  if (/disconnected|GATT Server/i.test(msg))
    throw new Error("micro:bit 一連上就斷線。請確認：① MakeCode 專案設定選「不需配對」後重新下載；② 到電腦或平板的藍牙設定，把這台 micro:bit 移除（忘記裝置）；③ 平板 App 已中斷連線。");
  if (/No Services matching|not found/i.test(msg))
    throw new Error("這台 micro:bit 沒有藍牙串口：程式要加「藍牙串口服務」，並用 bluetooth 擴展下載。");
  throw last;
}
