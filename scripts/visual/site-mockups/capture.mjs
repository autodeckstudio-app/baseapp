// Screenshot each mockup screen at 390x844 (DSF 2) through headless Chrome.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const out = "/tmp/site-mockups";
mkdirSync(out, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(root, p === "/" ? "/scripts/visual/site-mockups/index.html" : p);
    if (!file.startsWith(root)) throw new Error("path");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(4419, r));

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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const evaljs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;
for (const s of ["home", "bookings", "garage", "cars", "profile"]) {
  await send("Page.navigate", { url: `http://127.0.0.1:4419/scripts/visual/site-mockups/index.html?screen=${s}` });
  await sleep(4000);
  await evaljs("document.fonts.ready.then(()=>1)");
  await sleep(500);
  const errs = await evaljs("JSON.stringify({err:window.__err,w:innerWidth,h:innerHeight,doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]})");
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${out}/${s}.png`, Buffer.from(shot.data, "base64"));
  console.log(s, shot.data.length, errs);
}
chrome.kill(); server.close();
process.exit(0);
