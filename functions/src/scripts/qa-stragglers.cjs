// QA: exercise updateVehicle, upsertBay (no-op values) and voidInvoice (journey-test invoice) with synthetic test identities + minted App Check token.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio", serviceAccountId: "autodeck-studio@appspot.gserviceaccount.com" });
const K = "AIzaSyABYNBxwC7rhZhCMlid9xlVJrKrnLPPsRg", APP = "1:24903853329:web:2bc743dc86aad929d4d8b0", CUST = "rrmMIWEY4WNXFY4TXCzvnlxi6g53", TEN = "automodz", STUDIO = "studio-ahmedabad";
async function idt(uid, claims) {
  const t = await admin.auth().createCustomToken(uid, claims);
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + K, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t, returnSecureToken: true }) });
  return (await r.json()).idToken;
}
async function appCheck() {
  // Test-only: registers a one-off App Check debug token for the web app (revert: delete it in Firebase console > App Check > Apps > Manage debug tokens) and exchanges it.
  const gt = process.env.TOKEN, base = `https://firebaseappcheck.googleapis.com/v1/projects/autodeck-studio/apps/${APP}`;
  const dbg = require("crypto").randomUUID();
  const c = await fetch(base + "/debugTokens", { method: "POST", headers: { Authorization: "Bearer " + gt, "Content-Type": "application/json", "x-goog-user-project": "autodeck-studio" }, body: JSON.stringify({ displayName: "instinct-qa-temp", token: dbg }) });
  console.log("debugToken create", c.status, (await c.text()).slice(0, 160));
  const r = await fetch(base + ":exchangeDebugToken", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-user-project": "autodeck-studio" }, body: JSON.stringify({ debugToken: dbg }) });
  const j = await r.json(); if (!j.token) console.log("exchange", r.status, JSON.stringify(j).slice(0, 200)); return j.token;
}
let AC;
async function call(name, tok, data) {
  const r = await fetch("https://asia-south1-autodeck-studio.cloudfunctions.net/" + name, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok, "X-Firebase-AppCheck": AC }, body: JSON.stringify({ data }) });
  return name + " " + r.status + " " + (await r.text()).slice(0, 220);
}
(async () => {
  AC = await appCheck(); console.log("appcheck token", AC ? "minted" : "FAILED");
  const cu = await idt(CUST, { role: "customer", tenantId: TEN });
  const adm = await idt("qa-admin-quote", { role: "admin", tenantId: TEN, studioId: STUDIO });
  console.log(await call("updateVehicle", cu, { vehicleId: "psZuslrRmnwV0DFfi753", color: "Grey" }));
  const sc = (await admin.firestore().collection("studioConfig").doc(STUDIO).get()).data(); const b = sc.bays[0];
  console.log(await call("upsertBay", adm, { studioId: STUDIO, bayId: b.id, name: b.name, bayType: b.bayType, active: b.active }));
  console.log(await call("voidInvoice", adm, { invoiceId: "0EelmdJbn4fG8Edj6NKT", reason: "QA test invoice (journey-test user)" }));
  console.log("STRAGGLERS DONE");
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
