// Screenshot each mockup screen at 390x844 (DSF 2) through headless Chrome.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../../apps/site/dist");
const out = "/tmp/site-mockups";
mkdirSync(out, { recursive: true });

const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(root, p.endsWith("/") ? p+"index.html" : p);
    if (!file.startsWith(root)) throw new Error("path");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(4420, r));

const port = 9600 + Math.floor(Math.random() * 200);
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=780,1688", "--force-device-scale-factor=2", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/mc-" + port, "about:blank"], { stdio: "ignore" });
let ws, id = 0; const waiters = new Map();
const send = (m, p = {}) => new Promise((res) => { const i = ++id; waiters.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiters.has(d.id)) { waiters.get(d.id)(d.result); waiters.delete(d.id); } };
await send("Page.enable");

const evaljs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;
for(const [name,w,h] of [["desktop",1440,1100],["mobile",390,844],["mobile-small",360,800],["mobile-large",430,932]]) {
 await send("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:name.startsWith("mobile")});
 for(const route of ["/","/app/"]) {
  await send("Page.navigate",{url:`http://127.0.0.1:4420${route}`});
  await sleep(2500);
  const r=await evaljs(`(()=>{const el=document.querySelector('.app-five-device')||document.querySelector('.walk-phone-sticky');el.scrollIntoView({block:'center',behavior:'instant'});const p=el.querySelector('.phone'),img=p.querySelector('img'),b=p.getBoundingClientRect(),i=img.getBoundingClientRect();return {phone:[b.width,b.height],image:[i.width,i.height],offset:[i.x-b.x,i.y-b.y],natural:[img.naturalWidth,img.naturalHeight],overflow:document.documentElement.scrollWidth-innerWidth}})()`);
  if(Math.abs(r.phone[0]/r.phone[1]-390/844)>.002||r.offset.some(n=>Math.abs(n)>1)||r.overflow>1)throw new Error(JSON.stringify(r));
  await sleep(300);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  const label=route==='/'?'home':'app';
  writeFileSync(`${out}/composed-${name}-${label}.png`,Buffer.from(shot.data,'base64'));
  console.log(name,route,JSON.stringify(r));
 }
}
chrome.kill();server.close();process.exit(0);
