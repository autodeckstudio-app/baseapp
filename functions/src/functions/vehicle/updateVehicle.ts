import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { updateVehicleSchema } from "../../schemas/vehicle.js";

export const updateVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");

  const data = validate(updateVehicleSchema, request.data);

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new HttpsError("not-found", "Vehicle not found.");
    }

    const existing = snap.data() as Vehicle;

    assertTenant(user, existing.tenantId);

    // Customers can only update their own vehicles
    if (user.claims.role === "customer" && existing.ownerId !== user.uid) {
      throw new HttpsError("permission-denied", "You do not own this vehicle.");
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.registrationNumber !== undefined) updates["registrationNumber"] = data.registrationNumber;
    if (data.make !== undefined) updates["make"] = data.make;
    if (data.model !== undefined) updates["model"] = data.model;
    if (data.year !== undefined) updates["year"] = data.year;
    if (data.color !== undefined) updates["color"] = data.color;
    if (data.odometer !== undefined) updates["odometer"] = data.odometer;
    if (data.category !== undefined) updates["category"] = data.category;

    tx.update(ref, updates);

    writeAuditLog(tx, {
      action: "vehicle.updated",
      entityType: "Vehicle",
      entityId: data.vehicleId,
      user,
      studioId: null,
      before: { registrationNumber: existing.registrationNumber },
      after: updates,
    });
  });

  return { vehicleId: data.vehicleId };
});
