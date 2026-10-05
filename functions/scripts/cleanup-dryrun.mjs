// READ-ONLY. Builds the exact delete list and saves it to ~/cleanup-plan.json. Deletes nothing.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { KEEP_PREFIXES, isKept, OWNER_FIELDS, OWNED } from "./cleanup-lib.mjs";
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();

const users = [];
let token;
do { const p = await getAuth().listUsers(1000, token); users.push(...p.users); token = p.pageToken; } while (token);
const custSnap = await db.collection("customers").get();

const authIds = new Set(users.map((u) => u.uid));
const targetUsers = users.filter((u) => !isKept(u.uid) && !(u.customClaims?.role && u.customClaims.role !== "customer"));
const staffLeft = users.filter((u) => !isKept(u.uid) && u.customClaims?.role && u.customClaims.role !== "customer");
const orphanCustomers = custSnap.docs.filter((d) => !authIds.has(d.id) && !isKept(d.id));
const targetUids = new Set([...targetUsers.map((u) => u.uid), ...orphanCustomers.map((d) => d.id)]);

const docs = []; // {path, label}
const held = []; // skipped on purpose, shown to Meet
for (const uid of targetUids) if (custSnap.docs.some((d) => d.id === uid)) docs.push({ path: `customers/${uid}`, label: "customer record" });
for (const c of OWNED) {
  let s;
  try { s = await db.collection(c).get(); } catch (e) { console.log(`!! could not read ${c}`); continue; }
  for (const d of s.docs) {
    const x = d.data();
    const owner = OWNER_FIELDS.map((f) => x[f]).find((v) => typeof v === "string");
    if (!owner || !targetUids.has(owner)) continue;
    if (c === "payments" && (x.razorpayPaymentId || x.gatewayPaymentId) && !/^(mock|test|pay_mock)/i.test(String(x.razorpayPaymentId ?? x.gatewayPaymentId))) { held.push({ path: `${c}/${d.id}`, why: "payment with a gateway id, held for Meet" }); continue; }
    docs.push({ path: `${c}/${d.id}`, label: c });
    if (c === "vehicles") {
      const sub = await d.ref.collection("protections").get();
      for (const p of sub.docs) docs.push({ path: `${c}/${d.id}/protections/${p.id}`, label: "vehicleProtections" });
    }
  }
}
const counts = {};
for (const d of docs) counts[d.label] = (counts[d.label] ?? 0) + 1;

console.log(`KEEP accounts (by uid prefix ${KEEP_PREFIXES.join(", ")}): ${users.filter((u) => isKept(u.uid)).map((u) => `${u.displayName ?? u.email ?? u.uid}`).join(" | ")}`);
if (staffLeft.length) console.log(`staff/admin accounts not in the keep list, NOT deleted: ${staffLeft.map((u) => u.uid).join(", ")}`);
console.log(`\nsign-in accounts to delete: ${targetUsers.length}`);
for (const u of targetUsers) console.log(`  ${u.uid} | ${u.displayName ?? "-"} | ${u.email ?? "-"} | ${u.phoneNumber ?? "-"} | last sign-in ${u.metadata.lastSignInTime ?? "never"}`);
console.log(`customer records without a sign-in account to delete: ${orphanCustomers.length}`);
for (const d of orphanCustomers) { const c = d.data(); console.log(`  ${d.id} | ${c.name ?? c.displayName ?? "-"} | ${c.email ?? "-"} | ${c.phone ?? "-"}`); }
console.log(`\ndocuments to delete: ${docs.length}`, JSON.stringify(counts));
console.log(`held back (not deleted): ${held.length}`);
for (const h of held) console.log(`  ${h.path} | ${h.why}`);
console.log("Not touched: auditLog, rateLimits, services, studioConfig, tenants, bays, employees, stored photo files.");

writeFileSync(`${homedir()}/cleanup-plan.json`, JSON.stringify({ made: new Date().toISOString(), authUids: targetUsers.map((u) => u.uid), docs: docs.map((d) => d.path) }));
console.log(`\nplan saved to ~/cleanup-plan.json (${targetUsers.length} accounts, ${docs.length} docs). Nothing deleted.`);
