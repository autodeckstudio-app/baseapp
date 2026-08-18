import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle, Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createVehicleSchema } from "../../schemas/vehicle.js";

export const createVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);

  const data = validate(createVehicleSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "vehicle.create");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc();

  // A customer always owns their own vehicle. Studio/admin may register a
  // vehicle on behalf of an existing customer during walk-in intake — the
  // target customer must already exist in this tenant (doc20: full
  // customer-creation-from-studio is explicitly not V1 scope; only an
  // existing account's vehicle can be added this way).
  let ownerId = user.uid;
  if (data.ownerId && data.ownerId !== user.uid) {
    if (user.claims.role === "customer") {
      throw new HttpsError("permission-denied", "Cannot create a vehicle for another customer.");
    }
    const ownerSnap = await db.collection(COLLECTIONS.customers()).doc(data.ownerId).get();
    if (!ownerSnap.exists) throw new HttpsError("not-found", "Customer not found.");
    const owner = ownerSnap.data() as Customer;
    assertTenant(user, owner.tenantId);
    ownerId = data.ownerId;
  }

  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: ref.id,
    tenantId: user.claims.tenantId, // Server-set — not client-settable
    ownerId, // Server-resolved — never trusted verbatim from the client
    registrationNumber: data.registrationNumber,
    make: data.make,
    model: data.model,
    year: data.year,
    color: data.color,
    category: data.category ?? null,
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, vehicle);
    writeAuditLog(tx, {
      action: "vehicle.created",
      entityType: "Vehicle",
      entityId: ref.id,
      user,
      studioId: null,
      after: { id: ref.id, tenantId: vehicle.tenantId, ownerId: vehicle.ownerId },
    });
  });

  return { vehicle };
});
