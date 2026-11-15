// Responsive guard: loads each URL at many widths in headless Chrome and fails on horizontal
// overflow or elements poking past the viewport. No dependencies (Node 22 WebSocket + Chrome CDP).
// Usage: node scripts/responsive-guard.mjs <baseUrl> <path> [<path> ...]
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const [base, ...paths] = process.argv.slice(2);
if (!base || paths.length === 0) { console.error("usage: responsive-guard.mjs <baseUrl> <path>..."); process.exit(2); }
const SIZES = [[320, 640], [360, 740], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768], [1440, 900]];
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/rg-" + port, "about:blank"], { stdio: "ignore" });
let ws, id = 0; const waiters = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiters.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

const CHECK = `(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  const scrollers = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest('[aria-hidden="true"], [data-rg-ignore], .ax-ambient')) continue; // decorative backgrounds may bleed
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' && r.right <= vw + 1 && r.left >= -1) continue;
    if ((r.right > vw + 1 || r.left < -1) && !scrollers(el)) bad.push((el.tagName + '.' + String(el.className).slice(0, 30)) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (bad.length >= 3) break;
  }
  return { docOverflow: document.documentElement.scrollWidth > vw + 1, scrollWidth: document.documentElement.scrollWidth, vw, bad };
})()`;

let failed = 0;
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiters.has(d.id)) { waiters.get(d.id)(d.result); waiters.delete(d.id); } };
  await send("Page.enable");
  for (const p of paths) {
    for (const [w, h] of SIZES) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
      await send("Page.navigate", { url: base + p });
      await sleep(Number(process.env.RG_WAIT ?? 4000));
      const r = await send("Runtime.evaluate", { expression: CHECK, returnByValue: true });
      const v = r.result.value;
      const ok = !v.docOverflow && v.bad.length === 0;
      if (!ok) failed++;
      console.log(`${ok ? "PASS" : "FAIL"} ${p} ${w}x${h}${ok ? "" : ` scrollWidth=${v.scrollWidth} ${v.bad.join(" | ")}`}`);
    }
  }
} finally { chrome.kill(); }
process.exit(failed ? 1 : 0);
