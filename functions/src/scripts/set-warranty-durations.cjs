// Fills the structured warranty term (value + unit) from each service's warrantyLabel so issued
// warranties get a real end date. Only touches services whose structured fields are empty and whose
// label clearly states a term. Dry run unless --apply.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
const APPLY = process.argv.includes("--apply");
const parse = (l) => {
  if (/lifetime/i.test(l)) return { v: null, u: "lifetime" };
  const m = l.match(/(\d+)[-\s]*(year|month|day)/i);
  if (!m) return null;
  return { v: Number(m[1]), u: m[2].toLowerCase() + "s" };
};
(async () => {
  const snap = await db.collection("services").get();
  let n = 0;
  for (const doc of snap.docs) {
    const s = doc.data();
    if (!s.warrantyLabel || !/warranty/i.test(s.warrantyLabel)) continue;
    if (s.warrantyDurationUnit) continue;
    const p = parse(s.warrantyLabel);
    console.log(`${doc.id} | ${s.name} | ${s.warrantyLabel} => ${p ? JSON.stringify(p) : "SKIP (unparsed)"}`);
    if (!p) continue;
    n++;
    if (APPLY) await doc.ref.update({ warrantyDurationValue: p.v, warrantyDurationUnit: p.u, updatedAt: new Date().toISOString() });
  }
  console.log(APPLY ? `APPLIED ${n}` : `DRY RUN ${n} would change`);
})();
