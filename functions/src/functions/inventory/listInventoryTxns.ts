import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { InventoryTxn } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listInventoryTxnsSchema } from "../../schemas/inventory.js";

// Studio-and-above read: stock movement history, newest first, capped at 200.
export const listInventoryTxns = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(listInventoryTxnsSchema, request.data);
  assertStudio(user, data.studioId, "Inventory txn");
  await enforceRateLimit(subjectFrom(user), "inventory.read");

  const db = getFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.inventoryTxns())
    .where("tenantId", "==", user.claims.tenantId)
    .where("studioId", "==", data.studioId);
  if (data.itemId) query = query.where("itemId", "==", data.itemId);
  query = query.orderBy("createdAt", "desc").limit(200);

  const snap = await query.get();
  return { txns: snap.docs.map((d) => d.data() as InventoryTxn) };
});
