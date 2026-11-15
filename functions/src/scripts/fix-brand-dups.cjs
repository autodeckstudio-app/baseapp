// Deactivates seeded brand products that duplicate an existing priced studio service (e.g. "Kovalent Borophene" vs "Borophene").
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
(async () => {
  const all = (await db.collection("services").get()).docs.map((d) => d.data());
  const studio = all.filter((s) => !s.id.startsWith("svc-brand-"));
  let n = 0;
  for (const s of all.filter((x) => x.id.startsWith("svc-brand-") && x.active)) {
    const bare = s.name.toLowerCase().replace(`${(s.brand || "").toLowerCase()} `, "");
    const dup = studio.some((t) => t.name.toLowerCase() === bare || t.name.toLowerCase() === s.name.toLowerCase());
    if (dup) { await db.collection("services").doc(s.id).update({ active: false, updatedAt: new Date().toISOString() }); n++; console.log("deactivated", s.id); }
  }
  console.log("DUPS DONE " + n);
})().catch((e) => { console.error(e); process.exit(1); });
