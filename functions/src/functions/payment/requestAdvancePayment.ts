// Pay-at-studio ADVANCE payment (basket item 4 - PREVIEW, NOT ACTIVATED).
// The customer pays the owner-adopted 20% advance online (policy 2 Nov 2026:
// discounted service price incl GST excl pickup, advance rounded up, balance
// exact at the studio). This is the real provider integration path: it claims
// the booking's advance slot in a transaction with a deterministic payment id
// (advance-<bookingId>, the same referenceId the webhook resolves), calls the
// provider exactly once, and patches the committed record with the link.
//
// DISABLED: ADVANCE_PAYMENT_ENABLED is false. The guard is FIRST - before
// auth, validation, rate limiting, any read or write - so while disabled this
// callable is inert by construction. Activation requires the final review
// gate; the no-show retention disclosure (confirmed) must be shown BEFORE the
// customer reaches this call (customer app gate).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Payment, Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { requestAdvancePaymentSchema } from "../../schemas/booking.js";
import {
  ADVANCE_PAYMENT_ENABLED,
  ADVANCE_BASIS_POLICY,
  ADVANCE_ROUNDING_POLICY,
  buildAdvancePaymentRequest,
} from "../../lib/advance-payment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const requestAdvancePayment = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request): Promise<{ paymentId: string; paymentUrl: string | null; status: string }> => {
    if (!ADVANCE_PAYMENT_ENABLED) {
      throw new HttpsError(
        "failed-precondition",
        "Advance payments are not enabled yet. Pay at the studio when you collect your car.",
      );
    }

    const data = validate(requestAdvancePaymentSchema, request.data);
    const user = extractCustomerUser(request);
    await enforceRateLimit(subjectFrom(user), "payment.initiate");

    const db = getFirestore();
    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = bookingSnap.data() as Booking;

    assertTenant(user, booking.tenantId);
    assertStudio(user, booking.studioId, "Booking");
    if (booking.customerId !== user.uid) {
      throw new HttpsError("permission-denied", "Cannot pay an advance for another customer's booking.");
    }
    if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") {
      throw new HttpsError("failed-precondition", `Cannot pay an advance for a booking with status ${booking.status}.`);
    }

    // Deterministic payment id == provider referenceId: a retry finds the
    // SAME record, and the webhook resolves it without a query.
    const paymentRef = db.collection(COLLECTIONS.payments()).doc(`advance-${booking.id}`);
    const now = new Date().toISOString();

    const claim = await db.runTransaction(async (tx) => {
      const freshBooking = await tx.get(bookingRef);
      const b = freshBooking.data() as Booking;
      if (b.advancePaymentId) {
        const existing = await tx.get(db.collection(COLLECTIONS.payments()).doc(b.advancePaymentId as string));
        return { created: false as const, existing: existing.data() as Payment };
      }
      const advance = buildAdvancePaymentRequest(
        {
          id: b.id,
          payMode: b.payMode ?? "online",
          currency: b.priceBreakdown.currency ?? "INR",
          priceBreakdown: b.priceBreakdown,
          advancePaymentId: b.advancePaymentId ?? null,
        },
        ADVANCE_BASIS_POLICY,
        ADVANCE_ROUNDING_POLICY,
      );
      const payment: Payment = {
        id: paymentRef.id,
        tenantId: b.tenantId,
        studioId: b.studioId,
        targetType: "booking",
        jobId: null,
        bookingId: b.id,
        membershipId: null,
        customerId: b.customerId,
        amount: advance.amountPaise,
        currency: advance.currency,
        method: "razorpay_payment_link",
        status: "pending",
        paymentUrl: null,
        razorpayPaymentLinkId: null,
        razorpayPaymentId: null,
        razorpayOrderId: null,
        razorpayRefundId: null,
        refundAmount: null,
        manualReference: null,
        recordedBy: null,
        invoiceId: null,
        providerEventId: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        refundedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(paymentRef, payment);
      tx.update(bookingRef, { advancePaymentId: paymentRef.id, updatedAt: now });
      writeAuditLog(tx, {
        action: "payment.advance_initiated",
        entityType: "Payment",
        entityId: paymentRef.id,
        user,
        studioId: b.studioId,
        after: { bookingId: b.id, amount: advance.amountPaise, dueAtStudioPaise: advance.dueAtStudioPaise, status: "pending" },
      });
      return { created: true as const, existing: null, advance };
    });

    if (!claim.created) {
      const existing = claim.existing as Payment;
      if (existing.status === "completed") {
        throw new HttpsError("already-exists", "The advance for this booking is already paid.");
      }
      return { paymentId: existing.id, paymentUrl: existing.paymentUrl ?? null, status: existing.status };
    }

    // Exclusive claim held: call the provider exactly once, then patch the
    // committed record. A provider failure leaves a pending link-less record
    // a retry can resume from (same deterministic id).
    const customerSnap = await db.collection(COLLECTIONS.customers()).doc(booking.customerId).get();
    const customer = customerSnap.exists ? (customerSnap.data() as Customer) : null;
    const result = await getPaymentProvider().createPaymentLink({
      amount: claim.advance!.amountPaise,
      currency: claim.advance!.currency,
      bookingId: booking.id,
      description: claim.advance!.description,
      customerName: customer?.name || "Customer",
      customerPhone: customer?.phone ?? "",
      referenceId: claim.advance!.referenceId,
    });
    await paymentRef.update({
      paymentUrl: result.paymentUrl,
      razorpayPaymentLinkId: result.providerPaymentLinkId,
      razorpayOrderId: result.providerOrderId,
      updatedAt: new Date().toISOString(),
    });
    return { paymentId: paymentRef.id, paymentUrl: result.paymentUrl, status: "pending" };
  },
);
