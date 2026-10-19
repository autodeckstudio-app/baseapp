// Guard: the app-story phone shell must keep the screens' aspect ratio at phone widths,
// otherwise object-fit:cover crops the screenshots (the "squished mockup" bug).
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
const port = 9500 + Math.floor(Math.random() * 200);
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/mg-" + port, "about:blank"], { stdio: "ignore" });
let ws, id = 0; const waiters = new Map();
const send = (m, p = {}) => new Promise((res) => { const i = ++id; waiters.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const evaljs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiters.has(d.id)) { waiters.get(d.id)(d.result); waiters.delete(d.id); } };
await send("Page.enable");
let fail = 0;
for (const w of [360, 390, 430]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://localhost:4399/" });
  await sleep(2500);
  const r = await evaljs(`(()=>{const sh=document.querySelector('.phone-shell');if(!sh)return {err:'no shell'};const b=sh.getBoundingClientRect();const img=sh.querySelector('.app-screen img, .app-screen');const nat=img&&img.naturalWidth?img.naturalWidth/img.naturalHeight:390/844;const box=b.width/b.height;const cropped=Math.abs(box-nat)/nat>0.03;const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;return {w:${w},shell:[Math.round(b.width),Math.round(b.height)],box:box.toFixed(3),nat:nat.toFixed(3),cropped,overflow}})()`);
  console.log(JSON.stringify(r));
  if (r.err || r.cropped || r.overflow > 1) fail = 1;
}
chrome.kill();
process.exit(fail);
