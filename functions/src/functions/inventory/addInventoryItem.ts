import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { InventoryItem } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { addInventoryItemSchema } from "../../schemas/inventory.js";

// Admin-only: register a new stockable item at a studio.
export const addInventoryItem = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(addInventoryItemSchema, request.data);
  assertStudio(user, data.studioId, "Inventory item");
  await enforceRateLimit(subjectFrom(user), "inventory.create");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.inventoryItems()).doc();
  const now = new Date().toISOString();

  const item: InventoryItem = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: data.studioId,
    name: data.name,
    category: data.category,
    unit: data.unit,
    stockQty: data.stockQty ?? 0,
    lowStockThreshold: data.lowStockThreshold ?? 0,
    costPerUnit: data.costPerUnit ?? 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, item);
    writeAuditLog(tx, {
      action: "inventory.itemCreated",
      entityType: "inventoryItem",
      entityId: ref.id,
      user,
      studioId: data.studioId,
      after: { name: item.name, category: item.category, stockQty: item.stockQty },
    });
  });

  return { id: ref.id };
});
