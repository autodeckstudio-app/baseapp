// Seed for the live-SDK identity journey (demo-autodeck emulator suite only).
// Creates: one verified Auth user (the walk-in customer), the staged
// unclaimed customer record + active claim challenge, a vehicle, a service,
// a booking and its live job; plus a second verified user for the self-serve
// setup path. Fail-closed: refuses to run without BOTH emulator hosts and a
// demo-* project id.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 \
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=demo-autodeck \
//   node apps/customer/demo/livesdk/seed.mjs
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const require = createRequire(new URL("../../../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const PROJECT = process.env.GCLOUD_PROJECT ?? "";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("refusing: both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set (emulator-only seed)");
}
if (!PROJECT.startsWith("demo-")) {
  throw new Error(`refusing: GCLOUD_PROJECT must be demo-* (got "${PROJECT}")`);
}

export const FIXTURE = {
  email: "livesdk.walkin@example.com",
  password: "livesdk-demo-pass-1",
  freshEmail: "livesdk.fresh@example.com",
  freshPassword: "livesdk-demo-pass-2",
  tenant: "automodz",
  studioId: "s1",
  stagedId: "staged-livesdk-1",
  code: "4820-1937", // normalized "48201937"
  vehicleId: "veh-livesdk-1",
  serviceId: "svc-livesdk-1",
  bookingId: "b-livesdk-1",
  jobId: "j-livesdk-1",
};

const app = initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();
const now = new Date().toISOString();
const tomorrow = new Date(Date.now() + 86400000);
const scheduledDate = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const scheduledAt = new Date(`${scheduledDate}T10:30:00+05:30`).toISOString();
const estimatedEndAt = new Date(`${scheduledDate}T11:30:00+05:30`).toISOString();

async function ensureUser(email, password) {
  try { await auth.deleteUser((await auth.getUserByEmail(email)).uid); } catch { /* not found */ }
  const u = await auth.createUser({ email, password, emailVerified: true, displayName: "Live SDK Walker" });
  return u.uid;
}

const walkinUid = await ensureUser(FIXTURE.email, FIXTURE.password);
const freshUid = await ensureUser(FIXTURE.freshEmail, FIXTURE.freshPassword);

for (const col of ["customers", "claimChallenges", "customerUidBindings", "walkinEmailKeys", "bookings", "jobs", "vehicles", "services", "invoices", "payments", "memberships", "approvals", "reviews", "rateLimits", "auditLog"]) {
  const snap = await db.collection(col).get();
  for (const d of snap.docs) await d.ref.delete();
}

await db.collection("customers").doc(FIXTURE.stagedId).set({
  id: FIXTURE.stagedId, tenantId: FIXTURE.tenant, authUid: null,
  name: "Live SDK Walker", phone: "+919000000042", email: FIXTURE.email,
  notificationPrefs: { push: false, quietMode: false },
  createdAt: now, updatedAt: now, deletedAt: null,
});

await db.collection("claimChallenges").add({
  tenantId: FIXTURE.tenant, customerDocId: FIXTURE.stagedId, email: FIXTURE.email,
  codeHash: createHash("sha256").update("48201937", "utf8").digest("hex"),
  status: "active", attempts: 0, rev: 1, issueCount: 1,
  createdAt: now, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
});

await db.collection("vehicles").doc(FIXTURE.vehicleId).set({
  id: FIXTURE.vehicleId, tenantId: FIXTURE.tenant, ownerId: FIXTURE.stagedId,
  make: "Maruti", model: "Swift", plate: "GJ01LS1234", archived: false,
  createdAt: now, updatedAt: now,
});

await db.collection("services").doc(FIXTURE.serviceId).set({
  id: FIXTURE.serviceId, tenantId: FIXTURE.tenant, name: "Ceramic Wash",
  category: "wash", basePrice: 250000, durationMinutes: 60, active: true,
  createdAt: now, updatedAt: now,
});

await db.collection("bookings").doc(FIXTURE.bookingId).set({
  id: FIXTURE.bookingId, tenantId: FIXTURE.tenant, customerId: FIXTURE.stagedId,
  vehicleId: FIXTURE.vehicleId, serviceId: FIXTURE.serviceId, studioId: FIXTURE.studioId,
  status: "ACTIVE", payMode: "studio",
  scheduledAt, scheduledDate, scheduledTime: "10:30",
  estimatedEndDate: scheduledDate, estimatedEndTime: "11:30", estimatedEndAt,
  durationMinutes: 60, notes: null,
  priceBreakdown: { basePrice: 250000, scopeAdjustment: 0, addOns: [], tax: 0, total: 250000 },
  totalAmount: 250000,
  createdAt: now, updatedAt: now,
});

await db.collection("jobs").doc(FIXTURE.jobId).set({
  id: FIXTURE.jobId, tenantId: FIXTURE.tenant, customerId: FIXTURE.stagedId,
  vehicleId: FIXTURE.vehicleId, serviceId: FIXTURE.serviceId, studioId: FIXTURE.studioId,
  bookingId: FIXTURE.bookingId,
  status: "VEHICLE_RECEIVED", paymentStatus: "unpaid", totalAmount: 250000,
  services: [], statusHistory: [],
  createdAt: now, updatedAt: now,
});

console.log(JSON.stringify({ ok: true, walkinUid, freshUid, ...FIXTURE }, null, 2));
await deleteApp(app);
