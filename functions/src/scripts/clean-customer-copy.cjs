// Moves sourcing notes out of customer-facing service descriptions into an admin-only internalNotes field.
// Nothing is deleted: the full original description is kept in internalNotes. Dry run unless --apply.
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio" });
const db = admin.firestore();
const APPLY = process.argv.includes("--apply");
const clean = (d, s) => {
  let t = (d || "")
    .replace(/\s*Range as stated on \S+\s*Price quoted by the studio\.?/gi, "")
    .replace(/\s*Specs per \S+/gi, "")
    .replace(/\s*Photo is a placeholder\.?/gi, "")
    .replace(/\s*Price quoted by the studio\.?/gi, "")
    .replace(/\s+/g, " ").trim();
  if (t && !/[.!?]$/.test(t)) t += ".";
  if (t.length < 12) t = `${s.brand ? s.brand + " " : ""}${s.name}, fitted by the AutoDeck team.`;
  return t;
};
(async () => {
  const snap = await db.collection("services").get();
  let n = 0;
  for (const doc of snap.docs) {
    const s = doc.data();
    if (s.internalNotes !== undefined) continue;
    const next = clean(s.description, s);
    if (next === s.description) continue;
    n++;
    console.log(`${doc.id} | ${s.name}\n  was: ${s.description}\n  now: ${next}`);
    if (APPLY) await doc.ref.update({ description: next, internalNotes: [s.description, s.priceBasis ? `Price basis: ${s.priceBasis}` : ""].filter(Boolean).join("\n"), updatedAt: new Date().toISOString() });
  }
  console.log(APPLY ? `APPLIED ${n}` : `DRY RUN ${n} would change`);
})();
