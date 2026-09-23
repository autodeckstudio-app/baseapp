import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { InventoryItem } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateInventoryItemSchema } from "../../schemas/inventory.js";

// Admin-only: edit item details or deactivate. Quantities never change here —
// every stock movement goes through recordInventoryTxn.
export const updateInventoryItem = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateInventoryItemSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inventory.update");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.inventoryItems()).doc(data.itemId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Inventory item not found.");
    const before = snap.data() as InventoryItem;
    if (user.claims.role !== "superadmin" && before.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Item belongs to a different tenant.");
    }
    assertStudio(user, before.studioId, "Inventory item");

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of ["name", "category", "unit", "lowStockThreshold", "costPerUnit", "active"] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    tx.update(ref, patch);
    writeAuditLog(tx, {
      action: "inventory.itemUpdated",
      entityType: "inventoryItem",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: { name: before.name, active: before.active, lowStockThreshold: before.lowStockThreshold },
      after: patch,
    });
  });

  return { id: data.itemId };
});
