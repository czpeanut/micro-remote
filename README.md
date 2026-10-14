# micro-remote

手機端網頁 App，透過 Web Bluetooth 直接控制使用 MakeCode「藍牙串口 (Bluetooth UART)」積木的
micro:bit 遙控車，搭配文件開頭截圖中的積木程式使用，不需另外安裝原生 App。

## 檔案結構

- `index.html` — 頁面結構與遙控按鈕（前進／後退／左轉／右轉／停止）
- `style.css` — 手機優先的深色介面樣式
- `app.js` — Web Bluetooth 連線與指令傳送邏輯
- `manifest.json` / `sw.js` / `icon.svg` — 讓頁面可「加入主畫面」成為類 App 使用

## 通訊協定

App 透過 micro:bit 內建的 **Nordic UART Service**（MakeCode 藍牙積木使用的同一組服務）傳送資料：

| 用途 | UUID |
| --- | --- |
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| RX（App 寫入 → micro:bit 讀取） | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| TX（micro:bit 通知 → App 顯示） | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |

每次按下方向鍵會送出「單一字元 + `#`」，對應積木程式中的
`藍牙串口 讀取直到 #`：

| 指令 | 對應動作 |
| --- | --- |
| `f#` | 前進（M1=50, M2=50） |
| `b#` | 後退（M1=-50, M2=-50） |
| `l#` | 左轉（M1=50, M2=-50） |
| `r#` | 右轉（M1=-50, M2=50） |
| `s#` | 停止 — **需自行在 micro:bit 程式加入這個判斷**，見下方說明 |

## micro:bit 端需要加入的積木

截圖中的程式沒有處理停止的情況。App 預設在放開按鈕時會送出 `s#`，
請在既有的「如果 / 那麼」堆疊最後加入一個：

```
如果 C = "s" 那麼
    設置馬達M1的速度為 0　馬達M2的速度為 0
```

若不想修改 micro:bit 程式，可以在 App 中關閉「放開按鈕自動停止」，
按鈕就只會在點擊當下送出一次方向指令（不會送出 `s#`），靠切換其他方向鍵來改變動作。

## 使用方式

1. 用手機瀏覽器開啟 `index.html`（需部署在 HTTPS 網址，例如 GitHub Pages；
   Web Bluetooth 不允許在一般 `http://` 網址下使用）。
2. 點右上角「連接」，在裝置選單中選擇對應的 `BBC micro:bit [xxxxx]`。
3. 連接成功後即可用畫面上的方向鍵操控遙控車，下方「通訊紀錄」會顯示送出與收到的資料，方便除錯。
4. 可用瀏覽器「加入主畫面」功能將頁面安裝成類似原生 App 的圖示。

### 瀏覽器相容性

Web Bluetooth 目前僅部分平台支援：

- ✅ Android：Chrome、Edge
- ✅ iOS：需使用 [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) 這類支援 Web Bluetooth 的瀏覽器（Safari／一般 Chrome for iOS 不支援）
- ✅ 桌機：Chrome、Edge（需藍牙介面卡）
- ❌ Firefox、一般 iOS Safari

## 部署建議

最簡單的方式是啟用 GitHub Pages（Settings → Pages → 選擇此分支 / 根目錄），
即可取得 HTTPS 網址供手機開啟。

## 機械手臂遙控頁（arm.html）與吊車遙控頁（crane.html）

給「悟空機械手臂」課程用的兩個頁面，和遙控車共用同一套藍牙串口連線方式，`index.html` 不受影響。
GitHub Pages 網址後面加 `/arm.html` 或 `/crane.html`。每個按鈕送出「英文單字 + `#`」，
按住型的按鈕放開時自動送 `stop#`。

**arm.html（第三堂：固定式機械手臂）**

| 指令 | 按鈕 | 用法 |
| --- | --- | --- |
| `left#` / `right#` | 底座左轉／右轉 | 按住 |
| `up#` / `down#` | 手臂抬起／放下 | 按住 |
| `grab#` / `open#` | 夾爪夾緊／放開 | 點一下 |
| `stop#` | 停止 | 點一下 |

**crane.html（第四堂：吊車 = 小車底盤 + 全伺服手臂）**

| 指令 | 按鈕 | 用法 |
| --- | --- | --- |
| `forward#` / `back#` / `left#` / `right#` | 車子前進／後退／左轉／右轉（M1、M2） | 按住 |
| `spinL#` / `spinR#` | 轉台左旋／右旋（S1 連續伺服） | 按住 |
| `up#` / `down#` | 手臂抬起／放下（S0） | 按住 |
| `grab#` / `open#` | 夾爪夾緊／放開（S2） | 點一下 |
| `stop#` | 停止 | 點一下 |
| `rec#` / `play#` | 示教：開始錄製／重播（挑戰） | 點一下 |

micro:bit 端：`當藍牙串口收到資料 #` → `指令 = 藍牙串口 讀取直到 #`，再用「如果 指令 = "left"」等判斷。

## 深海探險（sub.html）— micro:bit 體感潛艇遊戲

電腦（Chrome／Edge）或平板開啟。側面視角的深海世界，有水的慣性與阻力：傾斜之後潛艇慢慢加速、慢慢停下。
沒有 micro:bit 時可用鍵盤方向鍵試玩、空白鍵發射聲納。畫面上有「上下相反」選項。

- **駕駛訓練（主題1 第六堂）**：左右傾斜前進／後退、前後傾斜下潛／上浮，90 秒收集發光珍珠。
- **雙屏尋寶（主題1 第八堂）**：寶藏藏在黑暗中，看 micro:bit 的雷達找；聲納 3 次；120 秒。

| 方向 | 訊息 | 意思 |
| --- | --- | --- |
| micro:bit → 電腦 | `x:數字`、`y:數字` | 加速度感測值（藍牙串口 寫入值），約每 0.1 秒送一次 |
| micro:bit → 電腦 | `p#` | 發射聲納 |
| micro:bit → 電腦 | `l#` `r#` `u#` `d#` | 舊版方向指令，也可以用 |
| 電腦 → micro:bit | `0#`～`4#` | 雷達強度，4 最近（尋寶模式） |
| 電腦 → micro:bit | `g#` | 收集到珍珠／找到寶藏 |
| 電腦 → micro:bit | `e#` | 時間到 |
