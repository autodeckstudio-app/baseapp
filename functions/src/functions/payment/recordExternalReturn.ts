// PREVIEW ONLY. Records an owner's aggregate attestation, never moves money.
// Provider capture/refund status, invoices and booking fee fields are untouched.
// The source is an operator-supplied owner-channel reference, not bank proof.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

const schema = z.object({
  paymentIds: z.array(z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)).min(1).max(20),
  totalPaise: z.number().int().positive().safe(),
  sourceReference: z.string().min(1).max(256),
  statement: z.string().min(1).max(2000),
}).strict();

export const recordExternalReturn = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) throw new HttpsError("permission-denied", "Admin required.");
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Payment set, total and owner statement reference are required.");
  const data = parsed.data;
  const ids = [...new Set(data.paymentIds)].sort();
  if (ids.length !== data.paymentIds.length) throw new HttpsError("invalid-argument", "Duplicate payment ids.");
  const db = getFirestore();
  const recordId = `external_return_${createHash("sha256").update(JSON.stringify([user.claims.tenantId, ids])).digest("hex")}`;
  const recordRef = db.collection(COLLECTIONS.paymentEvents()).doc(recordId);
  return db.runTransaction(async (tx) => {
    const old = await tx.get(recordRef);
    if (old.exists) {
      const o = old.data()!;
      if (o.totalPaise !== data.totalPaise || o.sourceReference !== data.sourceReference || o.statement !== data.statement) throw new HttpsError("already-exists", "Existing external-return record differs; review it instead of overwriting.");
      return { recordId, alreadyRecorded: true };
    }
    const refs = ids.map((id) => db.collection(COLLECTIONS.payments()).doc(id));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    const payments = snaps.map((snap) => {
      if (!snap.exists) throw new HttpsError("not-found", "Payment missing.");
      const p = snap.data() as Payment;
      if (p.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Cross-tenant payment.");
      if (p.externalReturnRecordId || p.method !== "razorpay_payment_link" || p.status !== "completed" || (p.refundAmount ?? 0) !== 0 || !Number.isSafeInteger(p.amount) || p.amount <= 0) throw new HttpsError("failed-precondition", "Payment has a return/refund or is not an untouched captured online payment.");
      return p;
    });
    if (new Set(payments.map((p) => p.customerId)).size !== 1 || payments.some((p) => p.currency !== "INR") || payments.reduce((n, p) => n + p.amount, 0) !== data.totalPaise) throw new HttpsError("failed-precondition", "Attested total must match the complete payment set for one customer; no individual allocation is inferred.");
    // Share the EXACT claim docs read by legacy initiation and reservation.
    // Either transaction wins; the loser retries and refuses. Never clear an
    // existing claim/request, including failed/ambiguous provider submissions.
    for (const p of payments) {
      const claim = await tx.get(db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`));
      const requests = await tx.get(db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id));
      const guard = await tx.get(db.collection(COLLECTIONS.refundRequests()).doc(`active_${p.id}`));
      if (claim.exists || guard.exists || !requests.empty) throw new HttpsError("failed-precondition", "Provider refund activity exists; reconcile it before recording an external return.");
    }
    const recordedAt = new Date().toISOString();
    const record = { kind: "owner_attested_external_return", tenantId: user.claims.tenantId, customerId: payments[0]!.customerId, paymentIds: ids, totalPaise: data.totalPaise, currency: "INR", sourceReference: data.sourceReference, statement: data.statement, recordedAt, recordedBy: user.uid, returnedAt: null, returnMethod: null, returnReference: null, allocation: null };
    tx.create(recordRef, record);
    for (const [i, ref] of refs.entries()) {
      const p = payments[i]!;
      tx.update(ref, { externalReturnRecordId: recordId });
      tx.create(db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`), { kind: "external_return_hold", externalReturnRecordId: recordId, paymentId: p.id, tenantId: p.tenantId, recordedAt });
    }
    writeAuditLog(tx, { action: "payment.external_return_recorded", entityType: "ExternalReturn", entityId: recordId, user, studioId: null, after: record });
    return { recordId, alreadyRecorded: false };
  });
});
