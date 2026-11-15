// Read-only. Lists live cars that share a plate under one owner, with booking counts, so one can be kept.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();
const plate = (process.argv[2] ?? "").toUpperCase();
const snap = await db.collection("vehicles").where("registrationNumber", "==", plate).get();
for (const d of snap.docs) {
  const v = d.data();
  const b = await db.collection("bookings").where("vehicleId", "==", d.id).get();
  const active = b.docs.filter((x) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(x.data().status)).length;
  console.log([d.id, `owner=${v.ownerId}`, `live=${v.deletedAt === null}`, `${v.make} ${v.model} ${v.year} ${v.color}`, `photo=${v.photoUrl ? "yes" : "no"}`, `created=${v.createdAt}`, `bookings=${b.size}`, `upcoming=${active}`].join(" | "));
}
