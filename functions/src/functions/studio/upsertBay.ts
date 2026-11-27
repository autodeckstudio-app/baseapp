import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import type { Bay, ServiceJob, StudioConfig } from "@autodeck/core";
import { physicallyHeldBayIds, readBayTypeLocks, writeBayTypeLocks } from "../../lib/bay-type-lock.js";
import { activeReservationsForBays } from "../../lib/bay-reservations.js";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { upsertBaySchema } from "../../schemas/studio.js";

// Admin-only. Creates a new bay (resource) or updates an existing one.
// Bays live embedded in the StudioConfig document (no separate collection).
// There is no delete — bays with historical job associations must remain
// resolvable, so deactivation (active: false) is the only removal path.
export const upsertBay = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(upsertBaySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "studio.upsertBay");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Studio not found.");

    const existing = snap.data() as StudioConfig;
    assertTenant(user, existing.tenantId);

    let bays: Bay[];
    let bayId: string;
    let change: "resource.created" | "resource.updated";
    let before: Record<string, unknown> | null = null;
    let typeLockRefs: DocumentReference[] = [];

    if (data.bayId) {
      const index = existing.bays.findIndex((b) => b.id === data.bayId);
      const existingBay = index === -1 ? null : existing.bays[index];
      if (!existingBay) throw new HttpsError("not-found", "Bay not found.");

      before = { ...existingBay };
      const updatedBay: Bay = {
        ...existingBay,
        name: data.name,
        bayType: data.bayType,
        active: data.active,
      };
      bays = [...existing.bays];
      bays[index] = updatedBay;
      bayId = data.bayId;
      change = "resource.updated";
      // Capacity guard for a retype or deactivation. Lock the old and new bay types (sorted, before any occupancy
      // read), then refuse while the bay has an upcoming booking or a vehicle physically in it. Existing bookings
      // are never reassigned silently; staff move or complete them first.
      const retyped = existingBay.bayType !== data.bayType;
      const deactivated = existingBay.active === true && data.active === false;
      if (retyped || deactivated) {
        typeLockRefs = await readBayTypeLocks(tx, db, existing.tenantId, data.studioId, [existingBay.bayType, data.bayType]);
        const held = await physicallyHeldBayIds((q) => tx.get(q), db, data.studioId, [data.bayId]);
        const pending = await tx.get(db.collection(COLLECTIONS.jobs()).where("studioId", "==", data.studioId).where("bayId", "==", data.bayId).where("status", "==", "PENDING_VEHICLE"));
        const upcoming = pending.docs.some((d) => { const end = Date.parse((d.data() as ServiceJob).estimatedEndAt); return !Number.isFinite(end) || end > Date.now(); });
        const reservedAhead = ((await activeReservationsForBays((q) => tx.get(q), db, data.studioId, [data.bayId])).get(data.bayId) ?? []).some((i) => i.endAt.getTime() > Date.now());
        if (held.size > 0 || upcoming || reservedAhead) {
          throw new HttpsError("failed-precondition", "This bay has an upcoming booking or a vehicle in it. Move or complete them before changing its type or deactivating it.");
        }
      }
    } else {
      const newRef = db.collection(COLLECTIONS.studioConfig()).doc();
      const newBay: Bay = {
        id: newRef.id,
        tenantId: existing.tenantId,
        studioId: data.studioId,
        name: data.name,
        bayType: data.bayType,
        active: data.active,
      };
      bays = [...existing.bays, newBay];
      bayId = newBay.id;
      change = "resource.created";
    }

    const updatedAt = new Date().toISOString();
    tx.update(ref, { bays, updatedAt });
    writeBayTypeLocks(tx, typeLockRefs, updatedAt);

    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "Bay",
      entityId: bayId,
      user,
      studioId: data.studioId,
      before,
      after: { name: data.name, bayType: data.bayType, active: data.active },
      metadata: { change },
    });

    return { bayId };
  });

  return { studioId: data.studioId, bayId: result.bayId };
});
