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
  unreliableBanner: document.getElementById("unreliableBanner"),
  autoStopToggle: document.getElementById("autoStopToggle"),
  log: document.getElementById("log"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  helpBtn: document.getElementById("helpBtn"),
  helpDialog: document.getElementById("helpDialog"),
  closeHelpBtn: document.getElementById("closeHelpBtn"),
  stopBtn: document.getElementById("stopBtn"),
  scanAllBtn: document.getElementById("scanAllBtn"),
};

let device = null;
let rxChar = null; // write
let txChar = null; // notify
let activeCmd = null; // command currently held down, to avoid duplicate sends
let consecutiveWriteFailures = 0;
let pairingHintShown = false;

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

// Some browsers define navigator.bluetooth but never actually show the
// device chooser (Samsung Internet, Opera Mobile, ...). Without a timeout
// the UI would sit on "連線中" forever with no feedback.
const REQUEST_DEVICE_TIMEOUT_MS = 20000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Android's BLE stack frequently drops the very first GATT connection
// attempt right after it succeeds (the well-known "GATT error 133"),
// especially right after a fresh scan. Retrying the connect + service
// discovery a couple of times, with a short delay, resolves it almost
// every time without the user having to do anything.
const GATT_CONNECT_ATTEMPTS = 3;
const GATT_RETRY_DELAY_MS = 600;

async function connectGattWithRetry(dev) {
  let lastErr;
  for (let attempt = 1; attempt <= GATT_CONNECT_ATTEMPTS; attempt++) {
    try {
      if (dev.gatt.connected) dev.gatt.disconnect();
      if (attempt > 1) {
        log(`連線不穩，自動重試第 ${attempt} 次…`);
        await sleep(GATT_RETRY_DELAY_MS);
      }
      const server = await dev.gatt.connect();
      const service = await server.getPrimaryService(NUS_SERVICE_UUID);
      const rx = await service.getCharacteristic(NUS_RX_CHAR_UUID);
      const tx = await service.getCharacteristic(NUS_TX_CHAR_UUID);
      return { rx, tx };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function connect(showAllDevices) {
  if (!navigator.bluetooth) return;
  try {
    setStatus("connecting");
    // micro:bit's BLE advertising packet is too small to fit the full
    // 128-bit UART service UUID, so filtering by service UUID finds
    // nothing during the scan. Filter by the name it always advertises
    // instead; the service is still accessed after connect via
    // optionalServices. If the board was renamed, fall back to showing
    // every nearby BLE device for manual selection.
    const requestOptions = showAllDevices
      ? { acceptAllDevices: true, optionalServices: [NUS_SERVICE_UUID] }
      : { filters: [{ namePrefix: "BBC micro:bit" }], optionalServices: [NUS_SERVICE_UUID] };
    device = await withTimeout(
      navigator.bluetooth.requestDevice(requestOptions),
      REQUEST_DEVICE_TIMEOUT_MS
    );
    const { rx, tx } = await connectGattWithRetry(device);
    rxChar = rx;
    txChar = tx;
    device.addEventListener("gattserverdisconnected", onDisconnected);

    // Subscribing to the TX characteristic is only used to show the
    // micro:bit's echoed text in the log — it's not needed to drive the
    // car. Some boards refuse it (e.g. "GATT Error: Not supported." when
    // notify requires bonding under certain MakeCode pairing settings), so
    // treat failure here as non-fatal instead of aborting the whole
    // connection and leaving rxChar set while the UI reports "未連接".
    try {
      await txChar.startNotifications();
      txChar.addEventListener("characteristicvaluechanged", onNotify);
    } catch (notifyErr) {
      log(`無法訂閱回傳資料（不影響遙控）：${notifyErr.message || notifyErr}`, "err");
    }

    setStatus("connected", device.name || "micro:bit");
    log(`已連接 ${device.name || "micro:bit"}`);
  } catch (err) {
    if (err && err.name === "NotFoundError") {
      // user cancelled the device picker
      setStatus("disconnected");
      return;
    }
    if (err && err.message === "TIMEOUT") {
      log("逾時：裝置選單一直沒跳出來，這通常代表目前瀏覽器沒有正確支援 Web Bluetooth，請改用 Android 版 Chrome 或 Edge。", "err");
      setStatus("disconnected");
      return;
    }
    log(`連接失敗（已重試 ${GATT_CONNECT_ATTEMPTS} 次）：${err.message || err}`, "err");
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
  writeChain = Promise.resolve();
  useWriteWithResponse = false;
  consecutiveWriteFailures = 0;
  pairingHintShown = false;
  setStatus("disconnected");
  log("已中斷連接");
}

function onNotify(event) {
  const value = new TextDecoder().decode(event.target.value);
  log(`收到：${value}`, "recv");
}

// Android's BLE stack does not reliably handle a second GATT operation
// started before the previous one resolves — it tends to fail both with a
// generic "GATT operation failed for unknown reason.", which happens
// easily when buttons are tapped in quick succession. Chain writes so
// only one is ever in flight.
let writeChain = Promise.resolve();

// If writeValueWithoutResponse keeps failing on this board, switch to
// writeValue (with response) for the rest of the session instead of
// retrying the failing mode every time.
let useWriteWithResponse = false;

async function writeToRx(data) {
  const canWriteNoResponse = !!(rxChar.properties && rxChar.properties.writeWithoutResponse);
  const canWriteWithResponse = !!(rxChar.properties && rxChar.properties.write);
  const preferNoResponse = canWriteNoResponse && !useWriteWithResponse;

  try {
    if (preferNoResponse) {
      await rxChar.writeValueWithoutResponse(data);
    } else if (canWriteWithResponse) {
      await rxChar.writeValue(data);
    } else {
      await rxChar.writeValueWithoutResponse(data);
    }
  } catch (err) {
    // One automatic fallback to the other write mode before giving up.
    if (preferNoResponse && canWriteWithResponse) {
      await rxChar.writeValue(data);
      useWriteWithResponse = true;
    } else if (!preferNoResponse && canWriteNoResponse) {
      await rxChar.writeValueWithoutResponse(data);
      useWriteWithResponse = false;
    } else {
      throw err;
    }
  }
}

function sendChar(c) {
  if (!rxChar) return writeChain;
  const data = new TextEncoder().encode(c + "#");
  writeChain = writeChain.catch(() => {}).then(async () => {
    try {
      await writeToRx(data);
      log(`送出：${c}#`, "sent");
      consecutiveWriteFailures = 0;
    } catch (err) {
      log(`送出失敗：${err.message || err}`, "err");
      consecutiveWriteFailures++;
      if (consecutiveWriteFailures >= 2 && !pairingHintShown) {
        pairingHintShown = true;
        log(
          "連續送出失敗，且兩種寫入方式都試過。這通常代表 micro:bit 專案的藍牙「配對安全性」不是設成「不需要配對」，導致連線沒有加密/配對，寫入被拒絕。請到 MakeCode 齒輪圖示→專案設定→藍牙，確認選的是「不需要配對 (No pairing required)」，重新下載到板子；並到手機系統的藍牙設定裡「忘記」這個裝置，再回來重新連線一次。",
          "err"
        );
      }
    }
  });
  return writeChain;
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

// Browsers that define navigator.bluetooth but are known to not reliably
// show the device chooser when requestDevice() is called.
const UNRELIABLE_UA_PATTERNS = [/SamsungBrowser/i, /OPR\//i, /Firefox/i, /FxiOS/i];

function init() {
  if (!navigator.bluetooth) {
    els.unsupportedBanner.hidden = false;
    els.connectBtn.disabled = true;
  } else if (UNRELIABLE_UA_PATTERNS.some((re) => re.test(navigator.userAgent))) {
    els.unreliableBanner.hidden = false;
  }

  if (navigator.bluetooth && navigator.bluetooth.getAvailability) {
    navigator.bluetooth.getAvailability().then((available) => {
      log(available ? "偵測到裝置有藍牙介面卡" : "此裝置沒有偵測到可用的藍牙介面卡", available ? undefined : "err");
    });
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

  els.scanAllBtn.addEventListener("click", () => {
    if (device && device.gatt.connected) {
      disconnect();
    } else {
      connect(true);
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
