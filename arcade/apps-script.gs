/**
 * 酷丁狐遊戲工坊：學生作品存檔（Google 試算表＋Apps Script）
 * 安裝：試算表 → 擴充功能 → Apps Script → 貼上這整份 → 部署 → 新增部署作業 → 類型「網頁應用程式」
 *       執行身分：我；誰可以存取：所有人 → 部署 → 複製網址給 Claude。
 * 每個學生每個遊戲一列：課程、學號、姓名、密碼雜湊、鹽、更新時間、作品（JSON，超過 4.5 萬字會分到後面幾格）
 */
const SHEET = '作品';
const CHUNK = 45000, MAXCHUNKS = 20;

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['課程', '學號', '姓名', '密碼雜湊', '鹽', '更新時間', '作品']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function hash_(pw, salt) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function find_(sh, course, sid) {
  const n = sh.getLastRow();
  if (n < 2) return 0;
  const v = sh.getRange(2, 1, n - 1, 2).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === course && String(v[i][1]) === sid) return i + 2;
  return 0;
}
function readData_(sh, row) {
  const v = sh.getRange(row, 7, 1, MAXCHUNKS).getValues()[0];
  return v.join('');
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return out_({ ok: true, msg: '酷丁狐遊戲工坊存檔服務' }); }

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, err: '格式錯誤' }); }
  const course = String(req.course || '').trim(), sid = String(req.sid || '').trim(), pw = String(req.pw || '');
  if (!/^(low|mid|high)$/.test(course)) return out_({ ok: false, err: '沒有這個課程' });
  if (!sid || sid.length > 30) return out_({ ok: false, err: '請輸入學號' });
  if (!/^\d{4}$/.test(pw)) return out_({ ok: false, err: '密碼是 4 位數字' });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheet_();
    let row = find_(sh, course, sid);
    if (req.action === 'login') {
      if (!row) {
        if (!req.create) return out_({ ok: true, exists: false });
        const salt = Utilities.getUuid();
        sh.appendRow([course, sid, String(req.name || '').slice(0, 20), hash_(pw, salt), salt, new Date(), '']);
        return out_({ ok: true, exists: true, created: true, data: '' });
      }
      const r = sh.getRange(row, 1, 1, 5).getValues()[0];
      if (hash_(pw, r[4]) !== r[3]) return out_({ ok: false, err: '密碼不對' });
      return out_({ ok: true, exists: true, name: r[2], data: readData_(sh, row) });
    }
    if (req.action === 'save') {
      if (!row) return out_({ ok: false, err: '找不到這個學號，請重新登入' });
      const r = sh.getRange(row, 1, 1, 5).getValues()[0];
      if (hash_(pw, r[4]) !== r[3]) return out_({ ok: false, err: '密碼不對' });
      const data = String(req.data || '');
      if (data.length > CHUNK * MAXCHUNKS) return out_({ ok: false, err: '作品太大了' });
      const cells = [];
      for (let i = 0; i < MAXCHUNKS; i++) cells.push(data.slice(i * CHUNK, (i + 1) * CHUNK));
      sh.getRange(row, 6).setValue(new Date());
      sh.getRange(row, 7, 1, MAXCHUNKS).setValues([cells]);
      return out_({ ok: true, saved: new Date().toISOString() });
    }
    return out_({ ok: false, err: '不認得的動作' });
  } finally { lock.releaseLock(); }
}
