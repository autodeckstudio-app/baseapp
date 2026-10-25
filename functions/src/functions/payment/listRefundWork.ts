// Admin-only READ-ONLY recovery surface for the refund outbox. Because
// Firestore rules keep refundRequests/paymentEvents server-only, staff cannot
// see held or in-flight refund requests without this callable. It lists:
//  - active + held (failed) refund requests for the caller's tenant, and
//  - payments flagged invoiceReviewNeeded by refund projection.
// It writes nothing. Running the outbox is a separate callable
// (processRefundOutbox) with its own production gate.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { COLLECTIONS } from "@autodeck/database";

const ACTIVE_STATUSES = ["reserved", "submitting", "submitted", "accepted", "ambiguous", "failed"] as const;

export const listRefundWork = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to view refund work.");
  }
  await enforceRateLimit(subjectFrom(user), "payment.refund");
  const db = getFirestore();
  const tenantId = user.claims.tenantId;

  const [reqSnap, paySnap, claimSnap] = await Promise.all([
    db.collection(COLLECTIONS.refundRequests())
      .where("tenantId", "==", tenantId)
      .where("status", "in", [...ACTIVE_STATUSES])
      .limit(100)
      .get(),
    db.collection(COLLECTIONS.payments())
      .where("tenantId", "==", tenantId)
      .where("invoiceReviewNeeded", "==", true)
      .limit(100)
      .get(),
    // Retained legacy refund claims (paymentEvents/refund_<paymentId>): the
    // deterministic ids make an exact prefix range possible.
    db.collection(COLLECTIONS.paymentEvents())
      .where("__name__", ">=", "refund_")
      .where("__name__", "<", "refund`")
      .limit(100)
      .get(),
  ]);

  const sortDesc = <T extends { updatedAt: string | null }>(a: T, b: T) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  const requests = reqSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      status: String(d.status ?? ""),
      paymentId: typeof d.paymentId === "string" ? d.paymentId : null,
      bookingId: typeof d.bookingId === "string" ? d.bookingId : null,
      jobId: typeof d.jobId === "string" ? d.jobId : null,
      amountPaise: typeof d.amountPaise === "number" ? d.amountPaise : null,
      providerRefundId: typeof d.providerRefundId === "string" ? d.providerRefundId : null,
      lastError: typeof d.lastError === "string" ? d.lastError : null,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
    };
  });
  requests.sort(sortDesc);
  const reviewPayments = paySnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      status: String(d.status ?? ""),
      refundState: typeof d.refundState === "string" ? d.refundState : null,
      amount: typeof d.amount === "number" ? d.amount : null,
      refundAmount: typeof d.refundAmount === "number" ? d.refundAmount : null,
      currency: typeof d.currency === "string" ? d.currency : null,
      invoiceId: typeof d.invoiceId === "string" ? d.invoiceId : null,
      bookingId: typeof d.bookingId === "string" ? d.bookingId : null,
      jobId: typeof d.jobId === "string" ? d.jobId : null,
      customerId: typeof d.customerId === "string" ? d.customerId : null,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
    };
  });
  reviewPayments.sort(sortDesc);

  // Legacy claims for THIS tenant that still need attention: the payment is
  // not refunded yet and the claim is not marked resolved.
  const legacyClaims: {
    paymentId: string; claimedAt: string | null; reconcileState: string | null; reconcileNote: string | null;
    paymentStatus: string | null; amount: number | null; currency: string | null;
  }[] = [];
  for (const doc of claimSnap.docs) {
    const d = doc.data() as { paymentId?: string; claimedAt?: string; reconcileState?: string; reconcileNote?: string };
    if (d.reconcileState === "resolved") continue;
    const paymentId = doc.id.slice("refund_".length);
    if (!paymentId) continue;
    const payDoc = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
    if (!payDoc.exists) continue;
    const pd = payDoc.data()!;
    if (pd.tenantId !== tenantId) continue;
    if (pd.status === "refunded" && d.reconcileState === "resolved") continue;
    legacyClaims.push({
      paymentId,
      claimedAt: typeof d.claimedAt === "string" ? d.claimedAt : null,
      reconcileState: typeof d.reconcileState === "string" ? d.reconcileState : null,
      reconcileNote: typeof d.reconcileNote === "string" ? d.reconcileNote : null,
      paymentStatus: typeof pd.status === "string" ? pd.status : null,
      amount: typeof pd.amount === "number" ? pd.amount : null,
      currency: typeof pd.currency === "string" ? pd.currency : null,
    });
  }
  return { requests: requests.slice(0, 50), reviewPayments: reviewPayments.slice(0, 50), legacyClaims: legacyClaims.slice(0, 50) };
});
