"use strict";
/*
 * store.js — 學號＋4 位數密碼登入、作品存檔
 *  有設定 ARC_CONFIG.api：存到 Google 試算表（apps-script.gs）
 *  沒設定：存在這台電腦的瀏覽器（localStorage），換電腦就看不到
 */
window.ArcStore = (function () {
  const API = (window.ARC_CONFIG && window.ARC_CONFIG.api) || "";
  const SKEY = "arc.session";
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  async function sha(s) {
    try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
    catch (e) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h); }
  }
  async function remote(req) {
    try {
      const r = await fetch(API, { method: "POST", body: JSON.stringify(req) });   // text/plain，不會觸發 CORS 預檢
      return await r.json();
    } catch (e) { return { ok: false, err: "連不上存檔伺服器，請檢查網路" }; }
  }
  async function local(req) {
    const key = `arc.acct.${req.course}.${req.sid}`;
    let a = null; try { a = JSON.parse(ls.get(key) || "null"); } catch (e) {}
    if (req.action === "login") {
      if (!a) {
        if (!req.create) return { ok: true, exists: false };
        const salt = Math.random().toString(36).slice(2);
        a = { name: String(req.name || "").slice(0, 20), salt, hash: await sha(salt + "|" + req.pw), data: "", t: Date.now() };
        ls.set(key, JSON.stringify(a)); return { ok: true, exists: true, created: true, data: "" };
      }
      if ((await sha(a.salt + "|" + req.pw)) !== a.hash) return { ok: false, err: "密碼不對" };
      return { ok: true, exists: true, name: a.name, data: a.data };
    }
    if (req.action === "save") {
      if (!a) return { ok: false, err: "找不到這個學號，請重新登入" };
      if ((await sha(a.salt + "|" + req.pw)) !== a.hash) return { ok: false, err: "密碼不對" };
      a.data = req.data; a.t = Date.now();
      return ls.set(key, JSON.stringify(a)) ? { ok: true, saved: new Date().toISOString() } : { ok: false, err: "瀏覽器空間不夠，存不進去" };
    }
    return { ok: false, err: "不認得的動作" };
  }
  const send = (req) => (API ? remote(req) : local(req));
  function check(course, sid, pw) {
    if (!/^(low|mid|high)$/.test(course)) return "沒有這個課程";
    if (!sid) return "請輸入學號";
    if (sid.length > 30) return "學號太長了";
    if (!/^\d{4}$/.test(pw)) return "密碼是 4 位數字";
    return "";
  }
  return {
    remote: !!API,
    check,
    login: (course, sid, pw, opt) => send({ action: "login", course, sid, pw, create: !!(opt && opt.create), name: (opt && opt.name) || "" }),
    save: (ses, data) => send({ action: "save", course: ses.course, sid: ses.sid, pw: ses.pw, data }),
    session: () => { try { return JSON.parse(sessionStorage.getItem(SKEY) || "null"); } catch (e) { return null; } },
    setSession: (s) => { try { if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); } catch (e) {} },
    draft: { get: (k) => ls.get("arc.draft." + k), set: (k, v) => ls.set("arc.draft." + k, v) },
  };
})();
