// READ-ONLY inventory. Writes nothing. Lists every sign-in account and what hangs off it,
// so test data can be told apart from real users before any cleanup is proposed.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
initializeApp({ projectId: "autodeck-studio" });
const db = getFirestore();

const users = [];
let token;
do {
  const page = await getAuth().listUsers(1000, token);
  users.push(...page.users);
  token = page.pageToken;
} while (token);

const OWNER_FIELDS = ["ownerId", "customerId", "userId", "uid", "createdBy"];
const COLS = ["customers", "vehicles", "bookings", "jobs", "payments", "invoices", "approvals", "papers", "memberships", "notifications", "pickupRequests", "reviews", "warranties", "inspections", "membershipUsage", "accountDeletionRequests", "carLeads"];
const perUid = new Map();
const totals = {};
const payments = [];
for (const c of COLS) {
  const s = await db.collection(c).get();
  totals[c] = s.size;
  for (const d of s.docs) {
    const x = d.data();
    const uid = OWNER_FIELDS.map((f) => x[f]).find((v) => typeof v === "string") ?? "(none)";
    const m = perUid.get(uid) ?? {};
    m[c] = (m[c] ?? 0) + 1;
    perUid.set(uid, m);
    if (c === "payments") payments.push({ id: d.id, uid, amount: x.amount, status: x.status, gateway: x.gateway ?? x.provider ?? x.method, ref: x.razorpayPaymentId ?? x.gatewayPaymentId ?? null });
  }
}
const cust = new Map();
for (const d of (await db.collection("customers").get()).docs) cust.set(d.id, d.data());

const KEEP = /meet|gauri|sheth871/i;
console.log("== collection totals ==");
console.log(JSON.stringify(totals));
console.log(`\n== sign-in accounts: ${users.length} ==`);
for (const u of users) {
  const c = cust.get(u.uid) ?? {};
  const claims = u.customClaims ?? {};
  const label = [u.displayName ?? c.name ?? c.displayName, u.email, u.phoneNumber].filter(Boolean).join(" / ") || "(no name, email or phone)";
  const keep = KEEP.test(label) ? "KEEP?" : "";
  console.log(`${u.uid} | role=${claims.role ?? "-"} | ${label} | providers=${u.providerData.map((p) => p.providerId).join(",") || "-"} | created=${u.metadata.creationTime} | lastSignIn=${u.metadata.lastSignInTime ?? "never"} | data=${JSON.stringify(perUid.get(u.uid) ?? {})} ${keep}`);
}
const authIds = new Set(users.map((u) => u.uid));
console.log("\n== data owned by a uid that has NO sign-in account ==");
for (const [uid, m] of perUid) if (!authIds.has(uid)) console.log(uid, JSON.stringify(m));
console.log(`\n== payments: ${payments.length} ==`);
for (const p of payments.slice(0, 60)) console.log(JSON.stringify(p));
