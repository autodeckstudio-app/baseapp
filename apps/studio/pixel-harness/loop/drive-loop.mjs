import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/home/sandbox/fbtools/package.json");
const WebSocket = require("ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome(port, profile) {
  const c = spawn("google-chrome", ["--headless=new","--no-sandbox","--disable-gpu",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"--window-size=390,1800","about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 60; i++) { try { v = await (await fetch(`http://localhost:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
  if (!v) throw new Error("no devtools on " + port);
  const ws = new WebSocket(v.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on("open", r));
  let id = 0; const pend = new Map(); const consoleMsgs = [];
  ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") { consoleMsgs.push(["exception", JSON.stringify(m.params.exceptionDetails).slice(0, 300)]); } });
  const send = (method, params, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { chrome: c, send, consoleMsgs };
}
async function newTab(ctx, url) { const { targetId } = await ctx.send("Target.createTarget", { url }); const { sessionId } = await ctx.send("Target.attachToTarget", { targetId, flatten: true }); await ctx.send("Runtime.enable", {}, sessionId); await ctx.send("Page.enable", {}, sessionId); return sessionId; }
const evalJson = async (ctx, s, expr) => (await ctx.send("Runtime.evaluate", { expression: expr, returnByValue: true }, s)).result.value;
async function waitFor(ctx, s, expr, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evalJson(ctx, s, expr)) return Date.now() - t0; } catch {} await sleep(300); } throw new Error("timeout: " + label); }
const shot = async (ctx, s, path) => writeFileSync(path, Buffer.from((await ctx.send("Page.captureScreenshot", { format: "png" }, s)).data, "base64"));
const clickText = (t) => `(function(){const els=[...document.querySelectorAll('div,span,button')];const x=els.find(e=>e.textContent===${JSON.stringify(t)});if(x){x.click();return true}return false})()`;

const CUST = "file:///tmp/replay28/apps/customer/pixel-harness/index6.html";
const STAFF = "file:///tmp/replay28/apps/studio/pixel-harness/index-loop.html";
const out = { steps: [] };
const custCtx = await launchChrome(9333, "/tmp/prof-cust");
const staffCtx = await launchChrome(9334, "/tmp/prof-staff");
let cust, staff;
try {
  cust = await newTab(custCtx, CUST);
  await waitFor(custCtx, cust, "window.__pixelReady===true", 25000, "customer ready");
  await waitFor(custCtx, cust, "document.body.textContent.includes('READY FOR DELIVERY')", 20000, "vehicle render");
  out.steps.push("customer initial render via own subscription: OK");
  out.custBeforeHasRecord = await evalJson(custCtx, cust, "document.body.textContent.includes('Paint Protection Film')");
  await shot(custCtx, cust, "/downloads/v6.29-customer-before-390.png");

  staff = await newTab(staffCtx, STAFF);
  await waitFor(staffCtx, staff, "window.__pixelReady===true", 25000, "staff ready");
  await waitFor(staffCtx, staff, "document.body.textContent.includes('Protection work on this visit')", 20000, "pane loaded");
  await shot(staffCtx, staff, "/downloads/v6.29-staff-pane-390.png");
  for (const t of ["Record work", "Add install", "PPF", "Full body"]) {
    out.steps.push(["click", t, await evalJson(staffCtx, staff, clickText(t))]);
    await sleep(400);
  }
  await sleep(600);
  out.clickedConfirm = await evalJson(staffCtx, staff, clickText("Confirm mark delivered"));
  out.deliveredAckMs = await waitFor(staffCtx, staff, "window.__delivered===true", 20000, "delivered ack");
  await shot(staffCtx, staff, "/downloads/v6.29-staff-after-390.png");
  out.customerRenderMs = await waitFor(custCtx, cust, "document.body.textContent.includes('Paint Protection Film')", 20000, "customer PPF render");
  await shot(custCtx, cust, "/downloads/v6.29-customer-after-390.png");
  out.custTrace = await evalJson(custCtx, cust, "window.__trace");
  out.staffTrace = await evalJson(staffCtx, staff, "window.__trace");
  out.custBodyTail = (await evalJson(custCtx, cust, "document.body.textContent")).slice(0, 300);
} catch (e) {
  out.ERROR = String(e);
  try { out.custTrace = await evalJson(custCtx, cust, "window.__trace"); } catch {}
  try { out.staffTrace = await evalJson(staffCtx, staff, "window.__trace"); out.staffErr = await evalJson(staffCtx, staff, "window.__pixelError ?? null"); } catch {}
  try { out.custBody = (await evalJson(custCtx, cust, "document.body.textContent")).slice(0, 300); } catch {}
}
out.custConsole = custCtx.consoleMsgs.slice(0, 10);
out.staffConsole = staffCtx.consoleMsgs.slice(0, 10);
writeFileSync("/tmp/loop-trace.json", JSON.stringify(out, null, 1));
custCtx.chrome.kill(); staffCtx.chrome.kill();
console.log(JSON.stringify(out, null, 1));
