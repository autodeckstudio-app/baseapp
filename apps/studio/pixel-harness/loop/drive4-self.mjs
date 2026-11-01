import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/home/sandbox/fbtools/package.json");
const WebSocket = require("ws");
const require2 = createRequire("/tmp/replay28/functions/package.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = spawn("google-chrome", ["--headless=new","--no-sandbox","--disable-gpu","--remote-debugging-port=9336","--user-data-dir=/tmp/prof-self","--window-size=390,1800","about:blank"], { stdio: "ignore" });
let v; for (let i = 0; i < 60; i++) { try { v = await (await fetch("http://localhost:9336/json/version")).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(v.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on("open", r));
let id = 0; const pend = new Map();
ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "file:///tmp/replay28/apps/customer/pixel-harness/index6.html" });
const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, s); await send("Page.enable", {}, s);
const evalJson = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true }, s)).result.value;
const waitFor = async (expr, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evalJson(expr)) return Date.now() - t0; } catch {} await sleep(300); } throw new Error("timeout: " + label); };
const shot = async (path) => writeFileSync(path, Buffer.from((await send("Page.captureScreenshot", { format: "png" }, s)).data, "base64"));
const clickExact = (t) => `(function(){const x=[...document.querySelectorAll('div,span,button,a')].find(e=>e.textContent===${JSON.stringify(t)});if(x){x.click();return true}return false})()`;
const clickAria = (a) => `(function(){const x=document.querySelector('[aria-label="${a}"]');if(x){x.click();return true}return false})()`;
const setField = (sel, val) => `(function(){const el=document.querySelector(${JSON.stringify(sel)});if(!el)return 'NO-EL';const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return 'OK'})()`;
const out = { steps: [] };
try {
  await waitFor("window.__pixelReady===true", 25000, "ready");
  await waitFor("document.body.textContent.includes('REPORTED BY YOU')", 20000, "screen");
  out.steps.push(["Add PPF click", await evalJson(clickExact("Add PPF"))]);
  await waitFor("document.body.textContent.includes('Add Paint Protection Film')", 10000, "create pane");
  console.log("fill:", await evalJson(setField('input[placeholder="e.g. Garware, LLumar"]', "Garware")), await evalJson(setField('input[placeholder="e.g. 5"]', "5")), await evalJson(setField('input[aria-label="Applied on (optional)"]', "2026-10-15")), await evalJson(setField('input[placeholder="e.g. full body except roof"],textarea[placeholder="e.g. full body except roof"]', "full body except roof")));
  out.steps.push(["Save click", await evalJson(clickExact("Save"))]);
  await waitFor("document.body.textContent.includes('Garware') && !document.body.textContent.includes('Add Paint Protection Film')", 20000, "created+rendered");
  out.afterCreate = { garware: true, addedByYou: await evalJson("document.body.textContent.includes('Added by you')") };
  await shot("/downloads/v6.31-customer-selfreport-create-390.png");
  out.steps.push(["Edit click", await evalJson(clickAria("Edit Paint Protection Film"))]);
  await waitFor("document.body.textContent.includes('Edit Paint Protection Film')", 10000, "edit pane");
  console.log("refill:", await evalJson(setField('input[placeholder="e.g. Garware, LLumar"]', "Garware Pro")));
  out.steps.push(["Save click 2", await evalJson(clickExact("Save"))]);
  await waitFor("document.body.textContent.includes('Garware Pro') && !document.body.textContent.includes('Edit Paint Protection Film')", 20000, "edited+rendered");
  out.afterEdit = { garwarePro: true };
  await shot("/downloads/v6.31-customer-selfreport-edit-390.png");
} catch (e) { out.ERROR = String(e); }
try {
  const admin = require2("firebase-admin");
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8099";
  admin.initializeApp({ projectId: "autodeck-dev" });
  const db = admin.firestore();
  const prots = await db.collection("vehicles/veh-loop1/protections").get();
  out.readbackProtections = prots.docs.map((d) => ({ id: d.id, ...d.data() }));
  const audit = await db.collection("auditLog").get();
  out.readbackAudit = audit.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => JSON.stringify(a).includes("loop") || JSON.stringify(a).includes("cust-"));
} catch (e) { out.readbackError = String(e); }
writeFileSync("/tmp/loop4-trace.json", JSON.stringify(out, null, 1));
c.kill();
console.log(JSON.stringify(out, null, 1));
