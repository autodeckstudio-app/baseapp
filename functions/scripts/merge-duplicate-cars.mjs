// Merges duplicate live cars with one plate into the one to keep. Dry run unless --write.
// Usage: node merge-duplicate-cars.mjs <PLATE> <keep-id-prefix> [--write]
// Archives the others (sets deletedAt, the same thing archiveVehicle does), points their bookings and jobs at the kept car,
// refreshes those bookings' vehicleSnapshot, and copies a photo to the kept car only if it has none. Deletes nothing.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();
const [plate, keepPrefix] = [(process.argv[2] ?? "").toUpperCase(), process.argv[3] ?? ""];
const write = process.argv.includes("--write");
if (!plate || !keepPrefix) { console.log("usage: <PLATE> <keep-id-prefix> [--write]"); process.exit(1); }

const snap = await db.collection("vehicles").where("registrationNumber", "==", plate).get();
const live = snap.docs.filter((d) => d.data().deletedAt === null);
const keepDocs = live.filter((d) => d.id.startsWith(keepPrefix));
if (keepDocs.length !== 1) { console.log(`expected exactly one live car starting ${keepPrefix}, found ${keepDocs.length}`); process.exit(1); }
const keep = keepDocs[0];
const owners = new Set(live.map((d) => d.data().ownerId));
if (owners.size !== 1) { console.log("live cars with this plate belong to different owners, stopping"); process.exit(1); }
const others = live.filter((d) => d.id !== keep.id);
const kv = keep.data();
console.log(`plate ${plate}: keep ${keep.id} (${kv.make} ${kv.model} ${kv.year} ${kv.color}, photo ${kv.photoUrl ? "yes" : "no"})`);
const ops = [];
let photoFrom = null;
for (const d of others) {
  const v = d.data();
  const bk = await db.collection("bookings").where("vehicleId", "==", d.id).get();
  const jb = await db.collection("jobs").where("vehicleId", "==", d.id).get();
  console.log(`  archive ${d.id} (${v.make} ${v.model} ${v.year} ${v.color}) photo=${v.photoUrl ? "yes" : "no"} bookings=${bk.size} jobs=${jb.size}`);
  ops.push({ ref: d.ref, data: { deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  if (!kv.photoUrl && !photoFrom && v.photoUrl) photoFrom = { id: d.id, url: v.photoUrl };
  for (const b of bk.docs) {
    console.log(`    move booking ${b.id} -> ${keep.id}`);
    ops.push({ ref: b.ref, data: { vehicleId: keep.id, vehicleSnapshot: { registrationNumber: kv.registrationNumber, make: kv.make, model: kv.model, year: kv.year, color: kv.color, photoUrl: photoFrom?.url ?? kv.photoUrl ?? null } } });
  }
  for (const j of jb.docs) { console.log(`    move job ${j.id} -> ${keep.id}`); ops.push({ ref: j.ref, data: { vehicleId: keep.id } }); }
}
if (photoFrom) { console.log(`  copy photo from ${photoFrom.id} to the kept car`); ops.push({ ref: keep.ref, data: { photoUrl: photoFrom.url, updatedAt: new Date().toISOString() } }); }
console.log(`${ops.length} writes planned. Nothing is deleted.`);
if (!write) { console.log("dry run: nothing written"); process.exit(0); }
for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); for (const o of ops.slice(i, i + 400)) b.update(o.ref, o.data); await b.commit(); }
console.log("done. Revert: set deletedAt back to null on the archived cars, and point the moved bookings back by id from the lines above.");
