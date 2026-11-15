import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8099";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.GCLOUD_PROJECT = "autodeck-dev";

initializeApp({ projectId: "autodeck-dev", storageBucket: "autodeck-dev.appspot.com" });
const db = getFirestore(); const auth = getAuth(); const bucket = getStorage().bucket();
console.log("ADMIN BUCKET NAME:", bucket.name);

const uid = "probe-customer-1";
try { await auth.getUser(uid); } catch { await auth.createUser({ uid, email: "probe@example.com" }); }
await auth.setCustomUserClaims(uid, { role: "customer", tenantId: "automodz" });
const now = new Date().toISOString();

await db.collection("customers").doc(uid).set({
  id: uid, tenantId: "automodz", authUid: uid, name: "Probe Customer",
  phone: "+919000000001", email: "probe@example.com",
  notificationPrefs: { push: false, quietMode: false },
  createdAt: now, updatedAt: now, deletedAt: null,
});

await db.collection("vehicles").doc("probe-vehicle-1").set({
  id: "probe-vehicle-1", tenantId: "automodz", ownerId: uid,
  registrationNumber: "GJ01AB1234", make: "Probe", model: "Sedan", year: 2021,
  color: "Blue", category: null, photoUrl: null, odometer: 12000,
  createdAt: now, updatedAt: now, deletedAt: null,
});
await db.collection("vehicles").doc("probe-vehicle-2").set({
  id: "probe-vehicle-2", tenantId: "automodz", ownerId: uid,
  registrationNumber: "GJ02CD5678", make: "Probe", model: "Hatch", year: 2019,
  color: "Red", category: null, photoUrl: null, odometer: 40000,
  createdAt: now, updatedAt: now, deletedAt: null,
});

const jpg = fs.readFileSync("/tmp/replay28/apps/site/dist/assets/img/car-lights.jpg");
console.log("JPEG BYTES:", jpg.length, "magic:", jpg.subarray(0,3).toString("hex"));

async function putObject(path) {
  const dlToken = randomUUID();
  await bucket.file(path).save(jpg, {
    contentType: "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: dlToken, ownerId: uid } },
  });
  const enc = encodeURIComponent(path);
  return `http://127.0.0.1:9199/v0/b/${bucket.name}/o/${enc}?alt=media&token=${dlToken}`;
}

const path1 = "automodz/vehicles/probe-vehicle-1/paper-probe-paper-1.jpg";
const url1 = await putObject(path1);
const path2 = "automodz/vehicles/probe-vehicle-2/paper-probe-paper-2.jpg";
const url2 = await putObject(path2);
const pathDecoy = "automodz/vehicles/probe-vehicle-1/paper-probe-paper-10.jpg";
await putObject(pathDecoy);

const paperBase = {
  tenantId: "automodz", studioId: "studio-ahmedabad", customerId: uid,
  title: null, supersededAt: null, supersededBy: null,
  issuedOn: "2024-01-15", expiresOn: "2027-01-14",
  status: "VERIFIED", verificationMode: "manual",
  extractedPlate: null, extractedExpiry: null,
  reviewedBy: null, reviewedAt: null, rejectionReason: null, notes: null,
  createdBy: uid, createdAt: now, updatedAt: now,
};
await db.collection("papers").doc("probe-paper-1").set({
  ...paperBase, id: "probe-paper-1", vehicleId: "probe-vehicle-1",
  kind: "INSURANCE", reference: "POL-12345",
  evidenceUrl: url1, evidencePath: path1, pendingEvidencePath: null,
});
await db.collection("papers").doc("probe-paper-2").set({
  ...paperBase, id: "probe-paper-2", vehicleId: "probe-vehicle-2",
  kind: "PUC", reference: "PUC-999",
  evidenceUrl: url2, evidencePath: path2, pendingEvidencePath: null,
});

const customToken = await auth.createCustomToken(uid);
fs.writeFileSync("/tmp/probe-token.txt", customToken);
console.log("TOKEN_LEN:", customToken.length);
console.log("LEGACY_URL_1:", url1);
console.log("SEED_DONE");
