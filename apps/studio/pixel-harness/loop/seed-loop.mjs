import { createRequire } from "node:module";
const require = createRequire("/tmp/replay28/functions/package.json");
const admin = require("firebase-admin");
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8099";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
admin.initializeApp({ projectId: "autodeck-dev" });
const auth = admin.auth(); const db = admin.firestore();
const TENANT = "t-loop", STUDIO = "s-loop", CUSTOMER = "cust-loop1", STAFF = "staff-loop1";
await auth.createUser({ uid: STAFF }).catch(() => {});
await auth.createUser({ uid: CUSTOMER }).catch(() => {});
await auth.setCustomUserClaims(STAFF, { role: "studio", tenantId: TENANT, studioId: STUDIO });
await auth.setCustomUserClaims(CUSTOMER, { role: "customer", tenantId: TENANT });
await db.collection("vehicles").doc("veh-loop1").set({
  id: "veh-loop1", tenantId: TENANT, ownerId: CUSTOMER, registrationNumber: "GJ01AB1234",
  make: "Honda", model: "City", year: 2022, color: "White", photoUrl: null, deletedAt: null,
});
await db.collection("jobs").doc("job-loop1").set({
  id: "job-loop1", tenantId: TENANT, studioId: STUDIO, customerId: CUSTOMER, vehicleId: "veh-loop1",
  serviceId: "svc-loop", status: "READY_FOR_DELIVERY", paymentStatus: "paid",
  totalAmount: 10000, bookingId: null, scheduledAt: "2026-10-31T10:00:00.000Z",
  statusHistory: [], createdAt: "x", updatedAt: "x",
});
await db.collection("invoices").doc("inv-loop1").set({
  id: "inv-loop1", tenantId: TENANT, jobId: "job-loop1", customerId: CUSTOMER, vehicleId: "veh-loop1",
  status: "issued", total: 10000, lineItems: [],
});
const staffToken = await auth.createCustomToken(STAFF);
const customerToken = await auth.createCustomToken(CUSTOMER);
require("fs").writeFileSync("/tmp/loop-tokens.json", JSON.stringify({ staffToken, customerToken }));
console.log("SEEDED");
