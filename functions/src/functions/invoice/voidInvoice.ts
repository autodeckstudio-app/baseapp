// Admin-only: voids a draft or issued invoice.
// A voided invoice is permanently closed. Historical data is preserved.
// To issue a corrected invoice, a new one must be created.
//
// Scope (Phase 5B P2-3 — documenting intended semantics): this function
// touches ONLY the Invoice document (status/voidedAt/voidedReason). It
// deliberately does NOT touch job.paymentStatus, the linked Payment, or any
// membership wash-usage record. Voiding an invoice is a correction to the
// billing DOCUMENT (e.g. it was issued with wrong line items, or issued in
// error) — it is not a statement about whether the underlying job was paid
// or the service was performed. If money actually needs to move,
// initiateRefund.ts is the correct path (it mutates the Payment, syncs
// job/booking paymentStatus, AND voids the linked invoice as part of that —
// see its own writeAuditLog "invoice.voided" call). This function is safe
// to use standalone only for invoices that were never actually paid
// (status is "paid" is explicitly rejected below).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { voidInvoiceSchema } from "../../schemas/invoice.js";

export const voidInvoice = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);

  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to void invoices.");
  }

  const data = validate(voidInvoiceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "invoice.void");

  const db = getFirestore();
  const invoiceRef = db.collection(COLLECTIONS.invoices()).doc(data.invoiceId);

  // Fast-fail pre-check (cheap, avoids starting a transaction for an
  // obviously-invalid request) — NOT the authoritative check, since
  // invoice.status is mutable/racy across concurrent calls. See the
  // re-check inside the transaction below (Phase 5B P2-1 fix — previously
  // the invoice was read once outside any transaction and that stale read
  // was the ONLY status check; two concurrent void calls on one invoice
  // would both pass it and both commit a blind tx.update(), the second
  // silently overwriting the first's voidedReason and producing two
  // "invoice.voided" audit entries for a single void).
  const preCheckSnap = await invoiceRef.get();
  if (!preCheckSnap.exists) throw new HttpsError("not-found", "Invoice not found.");
  const preCheckInvoice = preCheckSnap.data() as Invoice;
  if (preCheckInvoice.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  await db.runTransaction(async (tx) => {
    const invoiceSnap = await tx.get(invoiceRef);
    if (!invoiceSnap.exists) throw new HttpsError("not-found", "Invoice not found.");
    const invoice = invoiceSnap.data() as Invoice;

    if (invoice.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    }
    if (invoice.status === "void") {
      throw new HttpsError("failed-precondition", "Invoice is already void.");
    }
    if (invoice.status === "paid") {
      throw new HttpsError(
        "failed-precondition",
        "Cannot void a paid invoice. Initiate a refund first.",
      );
    }

    const now = new Date().toISOString();

    tx.update(invoiceRef, {
      status: "void",
      voidedAt: now,
      voidedReason: data.reason,
      updatedAt: now,
    });

    writeAuditLog(tx, {
      action: "invoice.voided",
      entityType: "Invoice",
      entityId: data.invoiceId,
      user,
      studioId: invoice.studioId,
      before: { status: invoice.status },
      after: { status: "void", reason: data.reason },
    });
  });

  return { invoiceId: data.invoiceId, voided: true };
});
