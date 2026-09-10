"use strict";

// Nordic UART Service - this is the same service micro:bit MakeCode's
// "藍牙串口 (Bluetooth UART)" blocks expose, so no UUID changes are needed
// on the micro:bit side.
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
  stopBtn: document.getElementById("stopBtn"),
};

let device = null;
let rxChar = null; // write
let txChar = null; // notify
let activeCmd = null; // command currently held down, to avoid duplicate sends

function log(text, cls) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  const t = new Date().toLocaleTimeString("zh-TW", { hour12: false });
  line.textContent = `[${t}] ${text}`;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
  while (els.log.childNodes.length > 200) {
    els.log.removeChild(els.log.firstChild);
  }
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
      filters: [{ services: [NUS_SERVICE_UUID] }],
      optionalServices: [NUS_SERVICE_UUID],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(NUS_SERVICE_UUID);
    rxChar = await service.getCharacteristic(NUS_RX_CHAR_UUID);
    txChar = await service.getCharacteristic(NUS_TX_CHAR_UUID);

    await txChar.startNotifications();
    txChar.addEventListener("characteristicvaluechanged", onNotify);

    setStatus("connected", device.name || "micro:bit");
    log(`已連接 ${device.name || "micro:bit"}`);
  } catch (err) {
    if (err && err.name === "NotFoundError") {
      // user cancelled the device picker
      setStatus("disconnected");
      return;
    }
    log(`連接失敗：${err.message || err}`, "err");
    setStatus("disconnected");
  }
}

function disconnect() {
  if (device && device.gatt.connected) {
    device.gatt.disconnect();
  } else {
    onDisconnected();
  }
}

function onDisconnected() {
  rxChar = null;
  txChar = null;
  activeCmd = null;
  setStatus("disconnected");
  log("已中斷連接");
}

function onNotify(event) {
  const value = new TextDecoder().decode(event.target.value);
  log(`收到：${value}`, "recv");
}

async function sendChar(c) {
  if (!rxChar) return;
  const data = new TextEncoder().encode(c + "#");
  try {
    if (rxChar.properties && rxChar.properties.writeWithoutResponse) {
      await rxChar.writeValueWithoutResponse(data);
    } else {
      await rxChar.writeValue(data);
    }
    log(`送出：${c}#`, "sent");
  } catch (err) {
    log(`送出失敗：${err.message || err}`, "err");
  }
}

function bindDpad() {
  const buttons = document.querySelectorAll(".dpad-btn[data-cmd]");

  buttons.forEach((btn) => {
    const cmd = btn.dataset.cmd;

    const start = (e) => {
      e.preventDefault();
      if (!rxChar) return;
      btn.classList.add("active");
      activeCmd = cmd;
      vibrate(12);
      sendChar(cmd);
    };

    const end = (e) => {
      e.preventDefault();
      btn.classList.remove("active");
      if (activeCmd !== cmd) return;
      activeCmd = null;
      if (els.autoStopToggle.checked) sendChar("s");
    };

    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("pointerleave", end);
  });

  els.stopBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!rxChar) return;
    els.stopBtn.classList.add("active");
    activeCmd = null;
    vibrate(12);
    sendChar("s");
  });
  els.stopBtn.addEventListener("pointerup", () => els.stopBtn.classList.remove("active"));
  els.stopBtn.addEventListener("pointerleave", () => els.stopBtn.classList.remove("active"));
}

function init() {
  if (!navigator.bluetooth) {
    els.unsupportedBanner.hidden = false;
    els.connectBtn.disabled = true;
  }

  setStatus("disconnected");
  bindDpad();

  els.connectBtn.addEventListener("click", () => {
    if (device && device.gatt.connected) {
      disconnect();
    } else {
      connect();
    }
  });

  els.clearLogBtn.addEventListener("click", () => {
    els.log.innerHTML = "";
  });

  els.helpBtn.addEventListener("click", () => els.helpDialog.showModal());
  els.closeHelpBtn.addEventListener("click", () => els.helpDialog.close());

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
