// Admin-only: reserves a booking/job refund in the outbox. No provider call
// happens here — the reserved request is submitted and projected by the
// (emulator-gated) runner. While the runner's production refusal holds, this
// producer refuses in production too: a reservation with no runner to drain
// it would strand the payment's refundable balance behind its guard.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { isProductionProject } from "../../lib/environment.js";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { requestBookingRefundSchema } from "../../schemas/payment.js";
import { reserveRefund, refundablePaise, runRefundOutbox } from "../../lib/refund-outbox.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";

export const requestBookingRefund = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to reserve refunds.");
  }
  if (isProductionProject()) {
    throw new HttpsError("failed-precondition", "Refund reservations are held for deploy-time activation review.");
  }
  const data = validate(requestBookingRefundSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.refund");

  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Payment not found.");
  const payment = snap.data() as Payment;
  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (payment.method !== "razorpay_payment_link") {
    // Cash/UPI/bank refunds settle outside the provider; recording them is a
    // separate, still-held flow — do not improvise it here.
    throw new HttpsError("failed-precondition", "Only provider (Razorpay) payments can be refunded through the outbox.");
  }
  const amount = data.amountPaise ?? refundablePaise(payment);
  if (amount <= 0) throw new HttpsError("failed-precondition", "Nothing refundable left on this payment.");
  try {
    const { requestId } = await reserveRefund(db, {
      payment, amountPaise: amount, reason: data.reason, createdBy: user.uid,
    });
    // Submission ownership: a reservation emits no provider event, so this
    // post-commit drain is what submits it (scoped to the request just
    // created). Failure leaves the durable reservation in place with the
    // error written on it; the manual runner remains the backstop.
    try {
      await runRefundOutbox(db, getPaymentProvider(), { requestId, runnerId: `request:${user.uid}` });
    } catch (err) {
      await db.collection(COLLECTIONS.refundRequests()).doc(requestId).update({
        lastError: `post-reservation refund submission failed: ${err instanceof Error ? err.message : String(err)}`,
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
    const settled = await db.collection(COLLECTIONS.refundRequests()).doc(requestId).get();
    const status = (settled.data() as { status?: string } | undefined)?.status ?? "reserved";
    return { requestId, amountPaise: amount, status };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("failed-precondition", err instanceof Error ? err.message : "Could not reserve refund.");
  }
});
