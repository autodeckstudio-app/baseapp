const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
(async () => {
  const col = db.collection("services");
  const ids = ["svc-ppf-garware-platinum", "svc-ppf-garware-plus"];
  for (const id of ids) {
    const s = await col.doc(id).get();
    const d = s.data() || {};
    delete d.internalNotes; delete d.description;
    console.log(id, JSON.stringify(d).slice(0, 700));
  }
})();
