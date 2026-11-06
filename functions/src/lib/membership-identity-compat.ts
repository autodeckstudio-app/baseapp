import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
/** Never infer/migrate historical benefit ownership. Existing UID-keyed memberships for a staged profile require explicit reconciliation. Block new purchase before provider work, including transaction race with older clients. */
export async function assertMembershipIdentityCompatible(
  db: Firestore,
  tenantId: string,
  uid: string,
  canonicalId: string,
  transaction?: Transaction,
  includeTerminal = false,
) {
  if (uid === canonicalId) return;
  const query = db
    .collection(COLLECTIONS.memberships())
    .where("tenantId", "==", tenantId)
    .where("customerId", "==", uid);
  const selected = includeTerminal
    ? query.limit(1)
    : query.where("status", "in", ["pending", "active"]).limit(1);
  const rows = transaction
    ? await transaction.get(selected)
    : await selected.get();
  if (transaction)
    await transaction.get(
      db.collection("membershipClaims").doc(`${tenantId}_${uid}`),
    );
  if (!rows.empty)
    throw new HttpsError(
      "failed-precondition",
      "Your earlier membership needs a studio identity review. No new plan or benefits were created.",
    );
}
