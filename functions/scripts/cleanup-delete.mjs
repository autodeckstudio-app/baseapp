// Deletes exactly what ~/cleanup-plan.json lists. Refuses kept accounts. Run only after the dry run was approved.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isKept } from "./cleanup-lib.mjs";
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();
const plan = JSON.parse(readFileSync(`${homedir()}/cleanup-plan.json`, "utf8"));
if (plan.authUids.some(isKept) || plan.docs.some((p) => p.startsWith("customers/") && isKept(p.split("/")[1]))) { console.log("plan contains a kept account, stopping"); process.exit(1); }
const SAFE = /^(customers|vehicles|bookings|jobs|payments|invoices|approvals|papers|memberships|notifications|pickupRequests|reviews|warranties|inspections|membershipUsage|accountDeletionRequests|carLeads)\//;
if (plan.docs.some((p) => !SAFE.test(p))) { console.log("plan contains a path outside the allowed collections, stopping"); process.exit(1); }
let n = 0;
for (let i = 0; i < plan.docs.length; i += 400) {
  const b = db.batch();
  for (const p of plan.docs.slice(i, i + 400)) { b.delete(db.doc(p)); n++; }
  await b.commit();
}
console.log(`deleted ${n} documents`);
if (plan.authUids.length) { const r = await getAuth().deleteUsers(plan.authUids); console.log(`deleted ${r.successCount} sign-in accounts, ${r.failureCount} failed`); }
console.log("revert: gcloud firestore import <backup path>, and firebase auth:import ~/auth-backup.json");
