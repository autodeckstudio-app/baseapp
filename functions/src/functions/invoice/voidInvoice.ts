// Admin-only: voids a draft or issued invoice.
// A voided invoice is permanently closed. Historical data is preserved.
// To issue a corrected invoice, a new one must be created.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { voidInvoiceSchema } from "../../schemas/invoice.js";

export const voidInvoice = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to void invoices.");
  }

  const data = validate(voidInvoiceSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "invoice.void");

  const db = getFirestore();
  const invoiceSnap = await db.collection(COLLECTIONS.invoices()).doc(data.invoiceId).get();
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

  await db.runTransaction(async (tx) => {
    tx.update(db.collection(COLLECTIONS.invoices()).doc(data.invoiceId), {
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
