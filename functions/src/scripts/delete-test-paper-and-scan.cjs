// Deletes the labelled test paper (reference ZZ-POL-1234) after saving a JSON backup, then scans catalogue text for emoji and dashes.
const admin = require("firebase-admin");
const fs = require("fs");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
const bad = /[\u2014\u2013\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
(async () => {
  const snap = await db.collectionGroup("papers").get().catch(() => null);
  const all = snap ? snap.docs : (await db.collection("papers").get()).docs;
  for (const d of all) {
    if (d.data().reference === "ZZ-POL-1234") {
      fs.writeFileSync(`/tmp/paper-${d.id}.json`, JSON.stringify(d.data()));
      console.log("BACKUP", d.ref.path, JSON.stringify(d.data()).slice(0, 300));
      await d.ref.delete();
      console.log("DELETED", d.ref.path);
    }
  }
  const sv = await db.collection("services").get();
  let n = 0;
  for (const d of sv.docs) {
    const s = d.data();
    if (s.isActive === false) continue;
    for (const k of ["name", "description", "warrantyLabel", "brand"]) {
      if (typeof s[k] === "string" && bad.test(s[k])) { n++; console.log("HIT", d.id, k, s[k].slice(0, 80)); }
    }
  }
  console.log("SCAN hits", n, "of", sv.size);
})();
