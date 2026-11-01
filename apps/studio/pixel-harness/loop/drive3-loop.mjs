import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/home/sandbox/fbtools/package.json");
const WebSocket = require("ws");
const require2 = createRequire("/tmp/replay28/functions/package.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome(port, profile) {
  const c = spawn("google-chrome", ["--headless=new","--no-sandbox","--disable-gpu",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"--window-size=390,1800","about:blank"], { stdio: "ignore" });
  let v;
  for (let i = 0; i < 60; i++) { try { v = await (await fetch(`http://localhost:${port}/json/version`)).json(); break; } catch { await sleep(250); } }
  if (!v) throw new Error("no devtools " + port);
  const ws = new WebSocket(v.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on("open", r));
  let id = 0; const pend = new Map();
  ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const send = (method, params, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { chrome: c, send };
}
async function newTab(ctx, url) { const { targetId } = await ctx.send("Target.createTarget", { url }); const { sessionId } = await ctx.send("Target.attachToTarget", { targetId, flatten: true }); await ctx.send("Runtime.enable", {}, sessionId); await ctx.send("Page.enable", {}, sessionId); return sessionId; }
const evalJson = async (ctx, s, expr) => (await ctx.send("Runtime.evaluate", { expression: expr, returnByValue: true }, s)).result.value;
async function waitFor(ctx, s, expr, ms, label) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evalJson(ctx, s, expr)) return Date.now() - t0; } catch {} await sleep(300); } throw new Error("timeout: " + label); }
const shot = async (ctx, s, path) => writeFileSync(path, Buffer.from((await ctx.send("Page.captureScreenshot", { format: "png" }, s)).data, "base64"));
const clickText = (t) => `(function(){const x=[...document.querySelectorAll('div,span,button')].find(e=>e.textContent===${JSON.stringify(t)});if(x){x.click();return true}return false})()`;
const clickContains = (t) => `(function(){const x=[...document.querySelectorAll('div,span,button')].find(e=>(e.textContent||'').includes(${JSON.stringify(t)}) && e.textContent.length < 120);if(x){x.click();return true}return false})()`;

const CUST = "file:///tmp/replay28/apps/customer/pixel-harness/index6.html";
const STAFF = (job) => `file:///tmp/replay28/apps/studio/pixel-harness/index-loop.html?job=${job}`;
const out = { stages: [] };
const custCtx = await launchChrome(9333, "/tmp/prof-cust3");
const staffCtx = await launchChrome(9334, "/tmp/prof-staff3");
let cust, staff;
async function staffDeliver(jobId, clicks, tag) {
  staff = await newTab(staffCtx, STAFF(jobId));
  await waitFor(staffCtx, staff, "window.__pixelReady===true", 25000, tag + " staff ready");
  await waitFor(staffCtx, staff, "document.body.textContent.includes('Protection work on this visit')", 20000, tag + " pane loaded");
  for (const c of clicks) {
    const ok = await (c.startsWith("~") ? evalJson(staffCtx, staff, clickContains(c.slice(1))) : evalJson(staffCtx, staff, clickText(c)));
    out.stages.push([tag, "click", c, ok]);
    await sleep(400);
  }
  await sleep(500);
  out.stages.push([tag, "confirm", await evalJson(staffCtx, staff, clickText("Confirm mark delivered"))]);
  await waitFor(staffCtx, staff, "window.__delivered===true", 20000, tag + " delivered ack");
  await shot(staffCtx, staff, `/downloads/v6.30-staff-${tag}-390.png`);
  await send_close(staffCtx, staff);
}
async function send_close(ctx, s) { try { const { targetId } = await ctx.send("Target.getTargetInfo", {}, s).catch(() => ({})); } catch {} }
try {
  cust = await newTab(custCtx, CUST);
  await waitFor(custCtx, cust, "window.__pixelReady===true", 25000, "customer ready");
  await waitFor(custCtx, cust, "document.body.textContent.includes('READY FOR DELIVERY')", 20000, "vehicle render");
  out.before = { ppfRecord: await evalJson(custCtx, cust, "document.body.textContent.includes('Paint Protection Film')"), history: await evalJson(custCtx, cust, "document.body.textContent.includes('Protection history')") };

  await staffDeliver("job-loop1", ["Record work", "Add install", "PPF", "Full body"], "install");
  out.install = { ppfMs: await waitFor(custCtx, cust, "document.body.textContent.includes('Paint Protection Film')", 20000, "install visible") };
  await shot(custCtx, cust, "/downloads/v6.30-customer-after-install-390.png");

  await staffDeliver("job-loop2", ["Record work", "Add replace", "~ - ref "], "replace");
  out.replace = { historyMs: await waitFor(custCtx, cust, "document.body.textContent.includes('Protection history')", 20000, "history visible"), currentStillPpf: null };
  out.replace.currentStillPpf = await evalJson(custCtx, cust, "document.body.textContent.includes('Paint Protection Film')");
  out.replace.replacedLabel = await evalJson(custCtx, cust, "document.body.textContent.includes('Replaced by newer work') || document.body.textContent.includes('Superseded')");
  await shot(custCtx, cust, "/downloads/v6.30-customer-after-replace-390.png");

  await staffDeliver("job-loop3", ["Record work", "Add removal", "~ - ref "], "remove");
  await sleep(1500);
  out.remove = { ppfGone: await evalJson(custCtx, cust, "!document.body.textContent.includes('Paint Protection Film record')"), historyStays: await evalJson(custCtx, cust, "document.body.textContent.includes('Protection history')"), removedLabel: await evalJson(custCtx, cust, "document.body.textContent.includes('Removed')") };
  await shot(custCtx, cust, "/downloads/v6.30-customer-after-remove-390.png");
} catch (e) { out.ERROR = String(e); }
// Full readback: protections (all fields) + auditLog (all fields, entity linkage)
try {
  const admin = require2("firebase-admin");
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8099";
  admin.initializeApp({ projectId: "autodeck-dev" });
  const db = admin.firestore();
  const prots = await db.collection("vehicles/veh-loop1/protections").get();
  out.readbackProtections = prots.docs.map((d) => ({ id: d.id, ...d.data() }));
  const audit = await db.collection("auditLog").get();
  out.readbackAudit = audit.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => JSON.stringify(a).includes("loop"));
  const jobs = await db.collection("jobs").get();
  out.readbackJobs = jobs.docs.map((d) => { const j = d.data(); return { id: d.id, status: j.status, protectionWork: j.protectionWork ?? null }; });
} catch (e) { out.readbackError = String(e); }
writeFileSync("/tmp/loop3-trace.json", JSON.stringify(out, null, 1));
custCtx.chrome.kill(); staffCtx.chrome.kill();
console.log(JSON.stringify(out, null, 1));
