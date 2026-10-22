// Guard: vercel.json sends security headers, and the BUILT site works under that CSP.
// Run after `astro build`:  node scripts/headers-guard.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));
const all = cfg.headers.find((h) => h.source === "/(.*)")?.headers ?? [];
const get = (k) => all.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value;
let bad = 0; const fail = (m) => { console.error("FAIL " + m); bad++; };
const csp = get("Content-Security-Policy");
if (!csp) fail("no Content-Security-Policy");
for (const [k, want] of [["X-Content-Type-Options", "nosniff"], ["X-Frame-Options", "DENY"]]) if (get(k) !== want) fail(`${k} should be ${want}`);
if (!get("Referrer-Policy")) fail("no Referrer-Policy");
if (!get("Permissions-Policy")) fail("no Permissions-Policy");
if (csp) {
  for (const need of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"]) if (!csp.includes(need)) fail("CSP missing " + need);
  if (/script-src[^;]*('unsafe-inline'|'unsafe-eval'|\*)/.test(csp)) fail("script-src must not allow unsafe-inline, unsafe-eval or *");
  const dist = new URL("../dist/", import.meta.url).pathname;
  if (!existsSync(dist)) fail("dist/ missing: run astro build first");
  else {
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const allowedHosts = new Set(csp.match(/https:\/\/[a-z0-9.-]+/g) ?? []);
    for (const f of walk(dist).filter((f) => f.endsWith(".html"))) {
      const t = readFileSync(f, "utf8");
      // Executable inline scripts would be blocked. JSON data blocks (ld+json) are not executed.
      for (const m of t.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const attrs = m[1]; const body = m[2].trim();
        if (/\bsrc=/.test(attrs) || /type=["']application\/ld\+json["']/.test(attrs)) continue;
        if (body) fail(`${f.replace(dist, "")}: inline <script> would be blocked by script-src 'self'`);
      }
      if (/\son[a-z]+=["']/i.test(t.replace(/<script[\s\S]*?<\/script>/gi, ""))) fail(`${f.replace(dist, "")}: inline event handler attribute would be blocked`);
      // Loaded resources (not plain links) must come from a host the CSP allows.
      for (const m of t.matchAll(/<(?:script|img|source|video|iframe)\b[^>]*\bsrc=["'](https?:\/\/[^"']+)|<link\b[^>]*\brel=["'](?:stylesheet|preload|icon)[^>]*\bhref=["'](https?:\/\/[^"']+)/gi)) {
        const u = new URL(m[1] || m[2]);
        if (!allowedHosts.has(u.origin)) fail(`${f.replace(dist, "")}: loads ${u.origin} which the CSP does not allow`);
      }
    }
    const widgets = walk(dist).filter((f) => /\.(js|css)$/.test(f));
    for (const f of widgets) {
      const t = readFileSync(f, "utf8");
      for (const m of t.matchAll(/fetch\(\s*["'](https?:\/\/[^"']+)/g)) { const o = new URL(m[1]).origin; if (!allowedHosts.has(o)) fail(`${f.replace(dist, "")}: fetches ${o}, not in connect-src`); }
    }
  }
}
if (bad) { console.error(`${bad} problem(s)`); process.exit(1); }
console.log("headers-guard ok");
