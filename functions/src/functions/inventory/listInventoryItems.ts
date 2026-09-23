import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { InventoryItem } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listInventoryItemsSchema } from "../../schemas/inventory.js";

// Studio-and-above read: items for one studio with a low-stock flag computed
// server-side so the Office dashboard and Inventory screen agree.
export const listInventoryItems = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(listInventoryItemsSchema, request.data);
  assertStudio(user, data.studioId, "Inventory item");
  await enforceRateLimit(subjectFrom(user), "inventory.read");

  const db = getFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.inventoryItems())
    .where("tenantId", "==", user.claims.tenantId)
    .where("studioId", "==", data.studioId);
  if (data.category) query = query.where("category", "==", data.category);
  if (data.includeInactive !== true) query = query.where("active", "==", true);

  const snap = await query.limit(500).get();
  const items = snap.docs.map((d) => d.data() as InventoryItem);
  const lowStock = items.filter((i) => i.stockQty <= i.lowStockThreshold);
  return { items, lowStockItemIds: lowStock.map((i) => i.id) };
});
