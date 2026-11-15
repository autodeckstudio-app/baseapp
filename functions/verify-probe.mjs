import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.GCLOUD_PROJECT = "autodeck-dev";
initializeApp({ projectId: "autodeck-dev", storageBucket: "autodeck-dev.appspot.com" });
const db = getFirestore(); const bucket = getStorage().bucket();

const p1 = (await db.collection("papers").doc("probe-paper-1").get()).data();
console.log("PAPER1 evidencePath:", JSON.stringify(p1.evidencePath), "evidenceUrl:", JSON.stringify(p1.evidenceUrl));
console.log("PAPER1 status:", p1.status, "| verificationMode:", p1.verificationMode, "| reason:", JSON.stringify(p1.verificationReason));
console.log("PAPER1 reference:", p1.reference, "| expiresOn:", p1.expiresOn, "| kind:", p1.kind, "| pendingEvidencePath:", JSON.stringify(p1.pendingEvidencePath));
console.log("PAPER1 reviewedBy/At:", JSON.stringify(p1.reviewedBy), JSON.stringify(p1.reviewedAt));

const [files] = await bucket.getFiles({ prefix: "automodz/vehicles/" });
console.log("STORAGE OBJECTS:", files.map(f=>f.name).sort().join(" | "));
const ownGone = !files.some(f=>f.name==="automodz/vehicles/probe-vehicle-1/paper-probe-paper-1.jpg");
const decoy10 = files.some(f=>f.name==="automodz/vehicles/probe-vehicle-1/paper-probe-paper-10.jpg");
const decoy2 = files.some(f=>f.name==="automodz/vehicles/probe-vehicle-2/paper-probe-paper-2.jpg");
console.log("OWN OBJECT ABSENT:", ownGone, "| NEAR-PREFIX DECOY INTACT:", decoy10, "| VEHICLE2 OBJECT INTACT:", decoy2);

const p2 = (await db.collection("papers").doc("probe-paper-2").get()).data();
console.log("PAPER2 status:", p2.status, "| evidencePath:", JSON.stringify(p2.evidencePath));
const v1 = (await db.collection("vehicles").doc("probe-vehicle-1").get()).data();
console.log("VEHICLE1 intact:", v1.registrationNumber, v1.deletedAt===null);
console.log("VERIFY_DONE");
