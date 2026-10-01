// QA discovery (read-only): web app id, journey-test vehicles, studio ids/bays, invoices of test bookings.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore(), CUST = "rrmMIWEY4WNXFY4TXCzvnlxi6g53";
(async () => {
  const v = await db.collectionGroup("vehicles").get();
  console.log("vehicles", v.size, v.docs.filter((d) => JSON.stringify(d.data()).includes(CUST)).map((d) => d.ref.path + " " + d.data().registrationNumber).join(" | "));
  const s = await db.collectionGroup("studioConfig").get();
  console.log("studioConfig", s.docs.map((d) => d.ref.path + " bays=" + (d.data().bays || []).length).join(" | "));
  const i = await db.collectionGroup("invoices").get();
  console.log("invoices", i.size, i.docs.slice(0, 15).map((d) => d.id + ":" + d.data().status + ":" + (d.data().customerId || "").slice(0, 6) + ":" + (d.data().bookingId || "").slice(0, 6)).join(" | "));
  const r = await fetch("https://firebase.googleapis.com/v1beta1/projects/autodeck-studio/webApps", { headers: { Authorization: "Bearer " + process.env.TOKEN } });
  console.log("webapps", (await r.text()).replace(/\s+/g, " ").slice(0, 700));
})().catch((e) => console.error("ERR", e.message));
