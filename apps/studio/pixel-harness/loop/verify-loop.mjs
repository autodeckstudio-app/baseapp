import { createRequire } from "node:module";
const require = createRequire("/tmp/replay28/functions/package.json");
const admin = require("firebase-admin");
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8099";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
admin.initializeApp({ projectId: "autodeck-dev" });
const db = admin.firestore();
const job = (await db.collection("jobs").doc("job-loop1").get()).data();
console.log("job status:", job.status, "| protectionWork:", JSON.stringify(job.protectionWork));
const prots = await db.collection("vehicles/veh-loop1/protections").get();
for (const d of prots.docs) { const p = d.data(); console.log("protection:", d.id, p.kind, p.coverage, p.status, "source:", p.source, "installedByJobId:", p.installedByJobId, "customerId:", p.customerId, "tenant:", p.tenantId, "current:", p.current); }
const audit = await db.collection("auditLog").orderBy("createdAt", "desc").limit(3).get().catch(() => null);
if (audit) for (const d of audit.docs) { const a = d.data(); console.log("audit:", a.action ?? a.type, a.jobId ?? "", a.actorUid ?? a.actor ?? ""); }
