/**
 * ประตูรหัสผ่านหน้า Dashboard
 * -----------------------------------------------------------
 * คนที่ยังไม่ผ่านรหัส จะไม่ได้ไฟล์ dashboard เลย — เห็นแค่หน้าใส่รหัส
 * เมื่อผ่านแล้ว Worker จะฝังค่า config (รหัสสาขา + Sheet ID) ลงไปในหน้าให้เลย
 * ผู้ใช้จึงไม่ต้องกรอกอะไรทั้งสิ้น
 *
 * ค่าลับทั้งหมดเก็บเป็น secret ของ Worker ไม่ได้อยู่ในโค้ดหรือใน git
 *   DASH_PASSWORD  — รหัสผ่านที่ใช้เข้า
 *   COOKIE_SECRET  — กุญแจเซ็น cookie (สุ่มยาวๆ)
 *   DASH_CONFIG    — JSON: {"branch":"...","am":"...","sources":[{"yy":"26","title":"...","sheetId":"..."}]}
 */

import DASHBOARD_HTML from "../../index.html";

const COOKIE = "dash_auth";
const MAX_AGE = 60 * 60 * 24 * 30;    // จำไว้ 30 วัน
const MAX_MONTH = 12;
const GSX_TAB = "ชีต1";               // ชีตงานซ่อม: แท็บเดียวทั้งปี
const CACHE_TTL = 600;                // เก็บผลดึง Sheet ไว้ 10 นาที

/* ---------- ลายเซ็น cookie (HMAC-SHA256) ---------- */
const enc = new TextEncoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signToken(exp, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(String(exp)));
  return exp + "." + b64url(sig);
}
// เทียบรหัสผ่านผ่าน SHA-256 — ได้ความยาวคงที่เสมอ ไม่ว่ารหัสจะสั้นยาวแค่ไหน
// และไม่ทำให้ความยาวรหัสรั่วออกทางเวลาตอบกลับ
async function sameSecret(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b))
  ]);
  return timingSafeEqual(b64url(ha), b64url(hb));
}

async function validToken(token, secret) {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  if (!/^\d+$/.test(exp) || Date.now() > Number(exp)) return false;
  // เซ็นใหม่แล้วเทียบทั้งสตริง — ป้องกัน cookie ปลอม
  const expect = await signToken(exp, secret);
  return timingSafeEqual(token, expect);
}
// เทียบแบบใช้เวลาคงที่ ไม่ให้เดาทีละตัวอักษรจากเวลาตอบกลับ
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(req, name) {
  const raw = req.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/* ---------- หน้าใส่รหัส ---------- */
function loginPage(msg) {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>เข้าสู่ระบบ</title><style>
:root{--bg:#f5f5f7;--card:#fff;--ink:#1d1d1f;--ink2:#6e6e73;--bd:rgba(0,0,0,.08);--ac:#0071e3;--dn:#c9302c;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--ink:#f5f5f7;--ink2:#98989d;--bd:rgba(255,255,255,.1);--ac:#0a84ff;--dn:#ff453a}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);
 min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;-webkit-font-smoothing:antialiased}
.box{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:38px 34px;max-width:380px;width:100%;
 box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06)}
h1{font-size:1.3rem;font-weight:600;letter-spacing:-.02em;margin-bottom:6px}
p{font-size:.88rem;color:var(--ink2);line-height:1.6;margin-bottom:22px}
label{display:block;font-size:.78rem;font-weight:650;color:var(--ink2);margin-bottom:7px}
input{width:100%;padding:12px 14px;border:1px solid var(--bd);border-radius:11px;background:var(--bg);color:var(--ink);
 font-family:inherit;font-size:1rem}
input:focus{outline:none;border-color:var(--ac);background:var(--card)}
button{width:100%;margin-top:16px;padding:12px;border:none;border-radius:11px;background:var(--ac);color:#fff;
 font-family:inherit;font-size:.95rem;font-weight:650;cursor:pointer}
button:hover{filter:brightness(.93)}
.err{margin-top:14px;padding:11px 14px;border-radius:10px;background:rgba(201,48,44,.1);color:var(--dn);font-size:.85rem}
.note{margin-top:20px;font-size:.75rem;color:var(--ink2);line-height:1.6;text-align:center}
</style></head><body>
<div class="box">
  <h1>📊 Dashboard ยอดขาย</h1>
  <p>หน้านี้จำกัดเฉพาะผู้ที่มีรหัสผ่าน</p>
  <form method="POST" action="/login">
    <label for="pw">รหัสผ่าน</label>
    <input id="pw" name="password" type="password" autofocus autocomplete="current-password" required>
    <button type="submit">เข้าสู่ระบบ</button>
  </form>
  ${msg ? `<div class="err">${msg}</div>` : ""}
  <div class="note">เข้าครั้งเดียว จำไว้ 30 วันบนเครื่องนี้</div>
</div></body></html>`;
}

/* ---------- ฝัง config ลงในหน้า dashboard ---------- */
function injectConfig(html, configJson) {
  // แทรกก่อน <script> ก้อนหลัก เพื่อให้ window.__DASH_CFG พร้อมใช้ตอนสคริปต์รัน
  const tag = `<script>window.__DASH_CFG=${configJson};</script>`;
  const i = html.indexOf("<script>");
  return i === -1 ? html.replace("</head>", tag + "</head>")
                  : html.slice(0, i) + tag + html.slice(i);
}

/* =========================================================================
   /api/sheets — Worker ดึง Google Sheet ทุกแท็บแทนเบราว์เซอร์ แล้วเก็บ cache ไว้
   เบราว์เซอร์จึงยิงแค่ครั้งเดียว ไม่ต้องยิง 24 ครั้งทุกรอบ
   ส่งกลับเป็น CSV ดิบ ไม่แปลงอะไร — ตรรกะแยกหมวดยังอยู่ฝั่งหน้าเว็บที่เดียว
   ========================================================================= */
function gvizUrl(sheetId, tab) {
  return "https://docs.google.com/spreadsheets/d/" + sheetId +
         "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(tab);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Google อาจตอบ 429 เมื่อขอถี่ — ลองซ้ำแบบถอยห่างขึ้นเรื่อยๆ
async function fetchTabText(sheetId, tab, tries = 3) {
  let last = null;
  for (let a = 0; a < tries; a++) {
    if (a) await sleep(500 * a + Math.random() * 300);
    let res;
    try { res = await fetch(gvizUrl(sheetId, tab), { cf: { cacheTtl: 0 } }); }
    catch (e) { last = e; continue; }
    if (res.ok) {
      const text = await res.text();
      if (/^\s*</.test(text)) throw new Error("ได้ HTML แทน CSV — Sheet ยังไม่เปิดสิทธิ์สาธารณะ");
      return text;
    }
    last = new Error("HTTP " + res.status);
    if (res.status !== 429 && res.status < 500) throw last;
  }
  throw last;
}

async function apiSheets(request, env, ctx) {
  let cfg = null;
  try { cfg = JSON.parse(env.DASH_CONFIG || "null"); } catch (e) { /* ปล่อยเป็น null */ }
  if (!cfg || !Array.isArray(cfg.sources) || !cfg.sources.length) {
    return new Response(JSON.stringify({ ok: false, error: "DASH_CONFIG ไม่ถูกต้อง" }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";
  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/__cache/sheets", { method: "GET" });

  // ส่งของใน cache กลับทันทีถ้ายังไม่หมดอายุ
  if (!fresh) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const body = await hit.text();
      return new Response(body, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Cache": "HIT" }
      });
    }
  }

  const jobs = [];
  // ชีตยอดขาย: 1 แท็บ = 1 เดือน
  for (const s of cfg.sources) {
    for (let m = 1; m <= MAX_MONTH; m++) {
      const tab = "เดือน " + m;
      jobs.push(fetchTabText(s.sheetId, tab).then(
        text => ({ kind: "sales", yy: s.yy, m, tab, text }),
        err  => ({ kind: "sales", yy: s.yy, m, tab, error: String((err && err.message) || err) })
      ));
    }
  }
  // ชีตงานซ่อม: แท็บเดียวทั้งปี หน้าเว็บแยกเดือนเองจาก Created Date
  for (const s of (Array.isArray(cfg.gsx) ? cfg.gsx : [])) {
    const tab = GSX_TAB;
    jobs.push(fetchTabText(s.sheetId, tab).then(
      text => ({ kind: "gsx", yy: s.yy, m: 1, tab, text }),
      err  => ({ kind: "gsx", yy: s.yy, m: 1, tab, error: String((err && err.message) || err) })
    ));
  }
  const tabs = await Promise.all(jobs);
  const body = JSON.stringify({ ok: true, fetchedAt: Date.now(), tabs });

  // เก็บลง edge cache ไว้ให้ครั้งต่อไป
  ctx.waitUntil(cache.put(cacheKey, new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "max-age=" + CACHE_TTL }
  })));

  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Cache": "MISS" }
  });
}

function redirect(to, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: to, ...headers } });
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const secret = env.COOKIE_SECRET;
    const password = env.DASH_PASSWORD;

    if (!secret || !password) {
      return new Response(
        "ยังไม่ได้ตั้ง secret — ต้องตั้ง DASH_PASSWORD และ COOKIE_SECRET ก่อน\n" +
        "  npx wrangler secret put DASH_PASSWORD\n" +
        "  npx wrangler secret put COOKIE_SECRET",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // ออกจากระบบ
    if (url.pathname === "/logout") {
      return redirect("/", { "Set-Cookie": cookieHeader("", 0) });
    }

    // ส่งรหัสผ่านเข้ามา
    if (url.pathname === "/login" && request.method === "POST") {
      const form = await request.formData();
      const given = String(form.get("password") || "");
      if (!(await sameSecret(given, password))) {
        // หน่วงนิดนึง กันไล่เดารหัสรัวๆ
        await new Promise(r => setTimeout(r, 700));
        return new Response(loginPage("รหัสผ่านไม่ถูกต้อง"), {
          status: 401, headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
      const token = await signToken(Date.now() + MAX_AGE * 1000, secret);
      return redirect("/", { "Set-Cookie": cookieHeader(token, MAX_AGE) });
    }

    // ทุกเส้นทางที่เหลือ ต้องผ่านรหัสก่อน
    const ok = await validToken(getCookie(request, COOKIE), secret);
    if (!ok) {
      return new Response(loginPage(""), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    // ผ่านแล้ว → ดึงข้อมูล Sheet ให้ (มี cache)
    if (url.pathname === "/api/sheets") return apiSheets(request, env, ctx);

    // ผ่านแล้ว → ส่ง dashboard พร้อม config ที่ฝังไว้
    const cfg = env.DASH_CONFIG || "null";
    return new Response(injectConfig(DASHBOARD_HTML, cfg), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",              // อย่าให้ proxy เก็บหน้าที่มี config
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer"
      }
    });
  }
};
