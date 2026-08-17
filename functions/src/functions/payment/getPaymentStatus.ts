import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getPaymentStatusSchema } from "../../schemas/payment.js";

export const getPaymentStatus = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getPaymentStatusSchema, request.data);

  const db = getFirestore();
  const paymentsSnap = await db
    .collection(COLLECTIONS.payments())
    .where("bookingId", "==", data.bookingId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (paymentsSnap.empty) {
    return { payment: null };
  }

  const payment = paymentsSnap.docs[0]?.data() as Payment;

  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  const isOwner = payment.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new HttpsError("permission-denied", "Access denied.");
  }

  // Customers see a restricted view — no provider IDs
  if (user.claims.role === "customer") {
    return {
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        invoiceId: payment.invoiceId,
        completedAt: payment.completedAt,
      },
    };
  }

  return { payment };
});
