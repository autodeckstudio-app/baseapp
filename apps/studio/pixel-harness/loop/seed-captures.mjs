// Seed for website mockup captures: fictional identity + sample data only.
// Pre-creates a FIXED uid so fresh emulator instances stay deterministic;
// the app's emulator dev sign-in links to this account by email.
import { createRequire } from "node:module";
const require = createRequire("/home/sandbox/fbtools/package.json");
const admin = require("firebase-admin");
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8099";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
admin.initializeApp({ projectId: "autodeck-dev" });
const auth = admin.auth(); const db = admin.firestore();
const TENANT = "automodz", STUDIO = "studio-ahmedabad", UID = "shot-alex";
const now = new Date().toISOString();
const inHours = (h) => new Date(Date.now() + h * 3600_000);
const fmtDate = (d) => d.toISOString().slice(0, 10);
const fmtTime = (d) => d.toISOString().slice(11, 16);

await auth.createUser({ uid: UID, email: "alex@example.com", emailVerified: true, displayName: "Alex Morgan", phoneNumber: "+919876543210" })
  .catch(async (e) => { if (e.code !== "auth/uid-already-exists" && e.code !== "auth/email-already-exists") throw e; });
await auth.setCustomUserClaims(UID, { role: "customer", tenantId: TENANT, studioId: null });
await db.collection("customers").doc(UID).set({
  id: UID, tenantId: TENANT, name: "Alex Morgan", phone: "+919876543210",
  email: "alex@example.com", createdAt: now, updatedAt: now,
});
await db.collection("vehicles").doc("veh-shot1").set({
  id: "veh-shot1", tenantId: TENANT, ownerId: UID, registrationNumber: "GJ01SC2024",
  make: "Sample", model: "car", year: 2023, color: "Silver", photoUrl: null,
  deletedAt: null, createdAt: now, updatedAt: now,
});
await db.collection("services").doc("svc-wash").set({
  id: "svc-wash", tenantId: TENANT, name: "Signature Foam Wash", category: "wash",
  brand: null, description: "Foam wash, wheels and cabin tidy.", basePrice: 99900,
  currency: "INR", estimatedDurationMinutes: 60, warrantyLabel: null,
  warrantyDurationValue: null, warrantyDurationUnit: null,
  vehicleCategoryPricing: [], requiredBayType: "wash", membershipWashEligible: true,
  active: true, createdAt: now, updatedAt: now,
});
const sched = inHours(-1), est = inHours(2);
await db.collection("bookings").doc("bk-shot1").set({
  id: "bk-shot1", tenantId: TENANT, studioId: STUDIO, customerId: UID, vehicleId: "veh-shot1",
  vehicleSnapshot: { registrationNumber: "GJ01SC2024", make: "Sample", model: "car", year: 2023, color: "Silver", photoUrl: null },
  serviceId: "svc-wash", vehicleCategory: "sedan",
  scheduledAt: sched.toISOString(), scheduledDate: fmtDate(sched), scheduledTime: fmtTime(sched),
  estimatedEndAt: est.toISOString(), estimatedEndDate: fmtDate(est), estimatedEndTime: fmtTime(est),
  durationMinutes: 60, bayId: "bay-1", assignedEmployeeId: null,
  status: "CONFIRMED",
  priceBreakdown: { vehicleCategory: "sedan", basePrice: 99900, scopeAdjustment: 0, addOns: [], subtotal: 99900, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 17982, total: 117882 },
  totalAmount: 117882, membershipId: null, membershipDiscountApplied: false, membershipWashUsed: false,
  paymentStatus: "paid", payMode: "online", notes: null, idempotencyKey: "shot-1",
  rescheduleCount: 0, confirmedAt: now, cancelledAt: null, cancellationReason: null,
  createdAt: now, updatedAt: now,
});
await db.collection("jobs").doc("job-shot1").set({
  id: "job-shot1", tenantId: TENANT, studioId: STUDIO, customerId: UID, vehicleId: "veh-shot1",
  serviceId: "svc-wash", status: "IN_PROGRESS", paymentStatus: "paid",
  totalAmount: 117882, bookingId: "bk-shot1", scheduledAt: sched.toISOString(),
  statusHistory: [{ status: "VEHICLE_RECEIVED", at: inHours(-1).toISOString() }, { status: "IN_PROGRESS", at: inHours(-0.5).toISOString() }],
  createdAt: now, updatedAt: now,
});
await db.collection("memberships").doc("mem-shot1").set({
  id: "mem-shot1", tenantId: TENANT, customerId: UID, planId: "plan-shot",
  tier: "member", status: "active", washesTotal: 8, washesUsed: 2,
  discountPercent: 0, pickupsTotal: 0, pickupsUsed: 0, prioritySlot: false,
  startDate: "2026-10-01", endDate: "2026-11-30",
  activatedAt: now, activatedBy: "seed", upgradeFromMembershipId: null,
  cancelledAt: null, cancelledBy: null, cancellationReason: null,
  createdAt: now, updatedAt: now,
});
const listings = [
  ["car-shot1", "Sample", "SUV", 2023, 24000, "Diesel"],
  ["car-shot2", "Sample", "hatchback", 2022, 31000, "Petrol"],
  ["car-shot3", "Sample", "crossover", 2024, 12000, "Petrol"],
];
for (const [id, make, model, year, km, fuel] of listings) {
  await db.collection("carListings").doc(id).set({
    id, tenantId: TENANT, studioId: STUDIO, source: "studio", sellerId: null,
    status: "live", make, model, variant: null, year, kmDriven: km, fuel, gearbox: "Automatic",
    owners: 1, colour: "Silver", area: "Ahmedabad", askingPrice: 0,
    description: null, insuranceValidTill: null, photoPaths: [],
    sellerName: null, sellerPhone: null, registrationNumber: null,
    createdAt: now, updatedAt: now,
  });
}
console.log("SEEDED-CAPTURES uid=" + UID);
