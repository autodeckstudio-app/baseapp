import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { InventoryItem, InventoryTxn } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { recordInventoryTxnSchema } from "../../schemas/inventory.js";

// Studio-and-above: record one stock movement. The item's stockQty updates in
// the same transaction as the txn log write, so the log is always consistent
// with on-hand stock. Stock-outs are rejected unless type is ADJUSTMENT
// (admin-only), which is the documented way to true-up after a stock count.
export const recordInventoryTxn = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(recordInventoryTxnSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inventory.txn");

  if (data.type === "ADJUSTMENT") {
    assertRole(user, "admin", "superadmin");
  }

  const db = getFirestore();
  const itemRef = db.collection(COLLECTIONS.inventoryItems()).doc(data.itemId);
  const txnRef = db.collection(COLLECTIONS.inventoryTxns()).doc();

  let resultingQty = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists) throw new HttpsError("not-found", "Inventory item not found.");
    const item = snap.data() as InventoryItem;
    if (user.claims.role !== "superadmin" && item.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Item belongs to a different tenant.");
    }
    assertStudio(user, item.studioId, "Inventory item");
    if (!item.active) throw new HttpsError("failed-precondition", "Item is inactive.");

    resultingQty = item.stockQty + data.qtyDelta;
    if (resultingQty < 0) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient stock: on hand ${item.stockQty} ${item.unit}, requested delta ${data.qtyDelta}.`,
      );
    }

    const now = new Date().toISOString();
    const txn: InventoryTxn = {
      id: txnRef.id,
      tenantId: item.tenantId,
      studioId: item.studioId,
      itemId: item.id,
      type: data.type,
      qtyDelta: data.qtyDelta,
      refType: data.refType ?? "none",
      refId: data.refId ?? null,
      notes: data.notes ?? null,
      createdBy: user.uid,
      createdAt: now,
    };

    tx.update(itemRef, { stockQty: resultingQty, updatedAt: now });
    tx.set(txnRef, txn);
    writeAuditLog(tx, {
      action: "inventory.txnRecorded",
      entityType: "inventoryTxn",
      entityId: txnRef.id,
      user,
      studioId: item.studioId,
      before: { stockQty: item.stockQty },
      after: { stockQty: resultingQty, type: data.type, qtyDelta: data.qtyDelta },
    });
  });

  return { id: txnRef.id, stockQty: resultingQty };
});
