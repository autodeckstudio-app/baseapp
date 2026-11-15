import type { Firestore, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { COLLECTIONS } from "@autodeck/database";
/** Canonical job.customerId only. No UID/name fallback and no account changes.
 * Same transaction as receipt, all reads before writes. */
export async function assertCustomerNotErasing(tx: Transaction, db: Firestore, tenantId: string, customerId: string): Promise<void> {
 const snap = await tx.get(db.collection(COLLECTIONS.customers()).doc(customerId));
 const customer = snap.data();
 if (!customer || customer["tenantId"] !== tenantId || customer["deletedAt"] || customer["erasureState"] === "purging")
  throw new HttpsError("failed-precondition", "Customer identity needs office review. No receipt was recorded.");
}
