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
