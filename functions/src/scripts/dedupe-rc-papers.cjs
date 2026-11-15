// Round 7 point 5d. Finds cars with more than one active RC paper, keeps the newest and marks older ones superseded (additive, never deletes).
// DRY RUN BY DEFAULT: prints what would change and writes nothing. Pass --apply to write; do not run --apply without the owner's go.
// Needs application default credentials for the target project (or FIRESTORE_EMULATOR_HOST for a local run). No keys in this file.
const admin = require("firebase-admin");
const apply = process.argv.includes("--apply");
const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
if (!project) { console.error("Set GCLOUD_PROJECT (use autodeck-dev with FIRESTORE_EMULATOR_HOST for a local run)."); process.exit(1); }
admin.initializeApp({ projectId: project });
(async () => {
  const db = admin.firestore();
  const snap = await db.collection("papers").where("kind", "==", "RC").get();
  const byCar = new Map();
  for (const d of snap.docs) { const p = d.data(); if (p.supersededAt) continue; const k = `${p.tenantId}|${p.vehicleId}`; (byCar.get(k) || byCar.set(k, []).get(k)).push({ ref: d.ref, p }); }
  let cars = 0, toMark = 0;
  for (const [k, list] of byCar) {
    if (list.length < 2) continue;
    cars++;
    list.sort((a, b) => String(b.p.createdAt).localeCompare(String(a.p.createdAt)));
    const keep = list[0];
    for (const old of list.slice(1)) {
      toMark++;
      console.log(`${apply ? "MARK" : "WOULD MARK"} paper ${old.p.id} (ref ${old.p.reference}, created ${old.p.createdAt}) superseded by ${keep.p.id} on car ${k}`);
      if (apply) await old.ref.update({ supersededAt: new Date().toISOString(), supersededBy: keep.p.id });
    }
  }
  console.log(`${apply ? "APPLIED" : "DRY RUN"}: ${cars} car(s) with duplicate RCs, ${toMark} paper(s) ${apply ? "marked" : "would be marked"}. Nothing deleted.`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
