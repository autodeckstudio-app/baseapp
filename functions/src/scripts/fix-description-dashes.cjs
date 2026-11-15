// Replaces em dashes in customer-facing service descriptions. Original kept in internalNotes (appended).
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
const APPLY = process.argv.includes("--apply");
(async () => {
  const sv = await db.collection("services").get();
  for (const d of sv.docs) {
    const s = d.data();
    if (typeof s.description !== "string" || !/[\u2014\u2013]/.test(s.description)) continue;
    let t = s.description.replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+/g, " ").replace(/,\s*$/, "").trim();
    if (!/[.!?]$/.test(t)) t += ".";
    console.log(d.id, "|", t.slice(0, 110));
    if (APPLY) await d.ref.update({ description: t, internalNotes: [s.internalNotes, `Previous description: ${s.description}`].filter(Boolean).join("\n"), updatedAt: new Date().toISOString() });
  }
  console.log(APPLY ? "APPLIED" : "DRY RUN");
})();
