import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getInvoiceSchema } from "../../schemas/invoice.js";

export const getInvoice = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getInvoiceSchema, request.data);

  const db = getFirestore();
  const invoiceSnap = await db.collection(COLLECTIONS.invoices()).doc(data.invoiceId).get();

  if (!invoiceSnap.exists) throw new HttpsError("not-found", "Invoice not found.");

  const invoice = invoiceSnap.data() as Invoice;

  if (invoice.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  const isOwner = invoice.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new HttpsError("permission-denied", "Access denied.");
  }

  return { invoice };
});
