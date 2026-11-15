// Meet (phonemsg-01M3V3ETZYZD8MYY3CH2A7PB6X): keep only what LLumar's own site lists
// (Valor, Select Black, Platinum Extra, Platinum Gloss, Platinum Matte, Gloss and Matte). Deactivate "LLumar Gloss", "LLumar Platinum", "Garware Platinum", "Garware Coloured PPF" (not on the brand sites). Deactivate only, no delete: booking history stays intact.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
(async () => {
  const snap = await db.collection("services").where("brand", "in", ["LLumar", "Garware"]).get();
  for (const d of snap.docs) {
    const x = d.data();
    console.log("LL", d.id, "|", x.name, "|", x.active, "|", x.basePrice / 100);
    if (["LLumar Gloss", "LLumar Platinum", "Garware Platinum", "Garware Coloured PPF"].includes(x.name) && x.active) {
      await d.ref.update({ active: false, updatedAt: new Date().toISOString() });
      console.log("DEACTIVATED", d.id, x.name);
    }
  }
  console.log("LL DONE");
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
