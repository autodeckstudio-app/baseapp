import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { createVehicleSchema } from "../../schemas/vehicle.js";

export const createVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);

  const data = validate(createVehicleSchema, request.data);

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc();

  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: ref.id,
    tenantId: user.claims.tenantId, // Server-set — not client-settable
    ownerId: user.uid, // Server-set — not client-settable
    registrationNumber: data.registrationNumber,
    make: data.make,
    model: data.model,
    year: data.year,
    color: data.color,
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
