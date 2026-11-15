// Adds a read-only copy of the car (vehicleSnapshot) to bookings that lack one.
// Writes only that one new field, only where it is missing. Edits and deletes nothing else.
// Prints what it will do first, then writes unless run with --dry.
// Also lists owners who have two live cars with the same plate (read-only, no claims written).
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const dry = process.argv.includes("--dry");
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();

const vSnap = await db.collection("vehicles").get();
const cars = new Map();
const byKey = new Map();
for (const d of vSnap.docs) {
  const v = d.data();
  cars.set(d.id, v);
  if (v.deletedAt === null) {
    const k = `${v.tenantId}|${v.ownerId}|${v.registrationNumber}`;
    byKey.set(k, [...(byKey.get(k) ?? []), d.id]);
  }
}
const dupes = [...byKey.entries()].filter(([, ids]) => ids.length > 1);

const bSnap = await db.collection("bookings").get();
const todo = [];
let already = 0;
const orphan = [];
for (const d of bSnap.docs) {
  const b = d.data();
  if (b.vehicleSnapshot) { already++; continue; }
  const v = cars.get(b.vehicleId);
  if (!v) { orphan.push(d.id); continue; }
  todo.push({ ref: d.ref, snap: { registrationNumber: v.registrationNumber, make: v.make, model: v.model, year: v.year, color: v.color, photoUrl: v.photoUrl ?? null } });
}

console.log(`vehicles: ${vSnap.size}, bookings: ${bSnap.size}`);
console.log(`bookings already with snapshot: ${already}`);
console.log(`bookings to get a snapshot: ${todo.length}`);
console.log(`bookings whose car doc is missing (skipped): ${orphan.length}`, orphan.slice(0, 20));
console.log(`owners with duplicate live plates (not touched): ${dupes.length}`);
for (const [k, ids] of dupes) console.log("  duplicate", k, ids.join(","));

if (dry) { console.log("dry run: nothing written"); process.exit(0); }
let n = 0;
for (let i = 0; i < todo.length; i += 400) {
  const batch = db.batch();
  for (const t of todo.slice(i, i + 400)) { batch.update(t.ref, { vehicleSnapshot: t.snap }); n++; }
  await batch.commit();
}
console.log(`written: ${n} bookings got vehicleSnapshot`);
console.log("revert: remove the vehicleSnapshot field from those bookings (nothing else changed)");
