import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { claimIsHeldByOther, plateClaimRef, releaseClaim, writeClaim } from "../../lib/plateClaim.js";
import { updateVehicleSchema } from "../../schemas/vehicle.js";

export const updateVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");

  const data = validate(updateVehicleSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "vehicle.update");

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
    if (data.photoUrl !== undefined) updates["photoUrl"] = data.photoUrl;

    // Changing the plate to one this owner already has live is a duplicate.
    if (data.registrationNumber !== undefined && data.registrationNumber !== existing.registrationNumber) {
      const clash = await tx.get(
        db
          .collection(COLLECTIONS.vehicles())
          .where("tenantId", "==", existing.tenantId)
          .where("ownerId", "==", existing.ownerId)
          .where("registrationNumber", "==", data.registrationNumber)
          .limit(10),
      );
      if (clash.docs.some((d) => d.id !== data.vehicleId && (d.data() as Vehicle).deletedAt === null)) {
        throw new HttpsError("already-exists", "This car is already added.", { field: "registrationNumber", reason: "duplicate" });
      }
    }

    let claimMove: { oldData: { vehicleId?: string | null } | undefined } | null = null;
    if (data.registrationNumber !== undefined && data.registrationNumber !== existing.registrationNumber && existing.deletedAt === null) {
      if (await claimIsHeldByOther(db, tx, existing.tenantId, existing.ownerId, data.registrationNumber, data.vehicleId)) {
        throw new HttpsError("already-exists", "This car is already added.", { field: "registrationNumber", reason: "duplicate" });
      }
      const oldSnap = await tx.get(plateClaimRef(db, existing.tenantId, existing.ownerId, existing.registrationNumber));
      claimMove = { oldData: oldSnap.exists ? (oldSnap.data() as { vehicleId?: string | null }) : undefined };
    }

    tx.update(ref, updates);
    if (claimMove && data.registrationNumber !== undefined) {
      await releaseClaim(db, tx, claimMove.oldData, existing.tenantId, existing.ownerId, existing.registrationNumber, data.vehicleId, updates["updatedAt"] as string);
      writeClaim(db, tx, existing.tenantId, existing.ownerId, data.registrationNumber, data.vehicleId, updates["updatedAt"] as string);
    }

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
