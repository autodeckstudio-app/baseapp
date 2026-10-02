// QA helper: drives the quote flow on a test booking via the deployed callables using synthetic test identities.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio", serviceAccountId: "autodeck-studio@appspot.gserviceaccount.com" });
const K = "AIzaSyABYNBxwC7rhZhCMlid9xlVJrKrnLPPsRg", BID = process.argv[2], CUST = "rrmMIWEY4WNXFY4TXCzvnlxi6g53";
async function idt(uid, claims) {
  const t = await admin.auth().createCustomToken(uid, claims);
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + K, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t, returnSecureToken: true }) });
  return (await r.json()).idToken;
}
async function call(name, tok, data) {
  const r = await fetch("https://asia-south1-autodeck-studio.cloudfunctions.net/" + name, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ data }) });
  return name + " " + r.status + " " + (await r.text()).slice(0, 200);
}
(async () => {
  const col = admin.firestore().collectionGroup("bookings");
  const find = async () => (await col.get()).docs.find((d) => d.id === BID);
  let d = await find(); const b = d.data(); console.log("BEFORE", b.quoteStatus, b.priceOnRequest, b.status, b.tenantId);
  const adm = await idt("qa-admin-quote", { role: "admin", tenantId: b.tenantId, studioId: b.studioId });
  const jq = async () => (await admin.firestore().collectionGroup("jobs").where("bookingId", "==", BID).get()).docs.map((j) => j.id + " total=" + j.data().totalAmount);
  console.log("JOB BEFORE", await jq());
  console.log(await call("setBookingQuote", adm, { bookingId: BID, basePricePaise: 700000 }));
  console.log("JOB AFTER", await jq());
  d = await find(); console.log("AFTER QUOTE", d.data().quoteStatus, d.data().basePrice ?? d.data().totalPrice ?? JSON.stringify(d.data().priceBreakdown || "").slice(0, 120));
  const cu = await idt(CUST, { role: "customer", tenantId: b.tenantId });
  console.log(await call("respondToBookingQuote", cu, { bookingId: BID }));
  d = await find(); console.log("AFTER APPROVE", d.data().quoteStatus);
  console.log("QA DONE");
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
