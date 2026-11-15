import{readConsultPaymentBinding}from"../../lib/consult-payment.js";
import type{ServiceJob}from"@autodeck/core";
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
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {checkedCombinedPayment} from "@autodeck/core";
import type { Booking, Payment, Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { requestAdvancePaymentSchema } from "../../schemas/booking.js";
import {
  ADVANCE_BASIS_POLICY,
  ADVANCE_ROUNDING_POLICY,
  advancePaymentEnabled,
  buildAdvancePaymentRequest,
} from "../../lib/advance-payment.js";
import{combinedCheckoutEnabled}from'../../lib/combined-booking.js';
import{requireCustomerDocId}from'../../lib/customer-identity.js';
import { isHoldExpired } from "../../lib/booking-hold.js";
import { ensureAdvanceLink, type AdvanceLinkDeps } from "../../lib/advance-link.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const requestAdvancePayment = onCall(
  { region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], enforceAppCheck: shouldEnforceAppCheck() },
  async (request): Promise<{ paymentId: string; paymentUrl: string | null; status: string }> => {
    // Role wall FIRST (pure claims check, no reads): an unauthorized caller is
    // denied before the flag guard, so the default-deny sweep exercises this
    // callable's caller check even while the flag is off. The flag guard stays
    // before any schema validation, Firestore read, or provider call.
    const user = extractCustomerUser(request);
    if (!advancePaymentEnabled()&&!combinedCheckoutEnabled()) {
      throw new HttpsError(
        "failed-precondition",
        "Advance payments are not enabled yet. Pay at the studio when you collect your car.",
      );
    }

    const data = validate(requestAdvancePaymentSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "payment.initiate");

    const db = getFirestore();
    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = bookingSnap.data() as Booking;

    assertTenant(user, booking.tenantId);
    assertStudio(user, booking.studioId, "Booking");
    const owner=await requireCustomerDocId(db,COLLECTIONS.customers(),user.claims.tenantId,user.uid);
    if (booking.customerId !== owner) {
      throw new HttpsError("permission-denied", "Cannot pay an advance for another customer's booking.");
    }
    const assertActiveHold = (b: Booking) => {
      if (b.status !== "PENDING" || b.paymentStatus !== "unpaid") {
        throw new HttpsError("failed-precondition", `Cannot pay an advance for a booking with status ${b.status}; an unpaid active hold is required.`);
      }
      if (!b.holdExpiresAt || !Number.isFinite(Date.parse(b.holdExpiresAt)) || isHoldExpired(b, Date.now())) {
        throw new HttpsError("failed-precondition", "The slot hold expired before the advance was paid. Please book again.");
      }
      if (b.payMode !== "studio") throw new HttpsError("failed-precondition", "Advance applies to pay-at-studio bookings only.");
    };
    assertActiveHold(booking);
    if (!booking.combinedPayment && !advancePaymentEnabled()) throw new HttpsError("failed-precondition", "Legacy advance payments are not enabled.");

    // Deterministic payment id == provider referenceId: a retry finds the
    // SAME record, and the webhook resolves it without a query.
    const paymentRef = db.collection(COLLECTIONS.payments()).doc(`advance-${booking.id}`);
    const now = new Date().toISOString();

    const assertDisplayedAmount = (amount: number) => {
      if (data.expectedAdvancePaise !== undefined && data.expectedAdvancePaise !== amount) {
        throw new HttpsError("failed-precondition", "The advance amount changed. Review the booking before paying.", { reason: "advance_amount_changed" });
      }
    };
    const claim = await db.runTransaction(async (tx) => {
      const freshBooking = await tx.get(bookingRef);
      const b = freshBooking.data() as Booking;
      assertActiveHold(b);
      if (!b.combinedPayment && !advancePaymentEnabled()) throw new HttpsError("failed-precondition", "Legacy advance payments are not enabled.");
      if(b.customerId!==owner||b.tenantId!==booking.tenantId||b.studioId!==booking.studioId||b.id!==booking.id)throw new HttpsError("permission-denied","Booking ownership changed.");
      if(b.combinedPayment&&!combinedCheckoutEnabled())throw new HttpsError("failed-precondition","Combined payment is not active.");
      if(b.combinedPayment){try{const snap=checkedCombinedPayment(b.combinedPayment,b.totalAmount);if(snap.choice!=="advance20")throw Error();}catch{throw new HttpsError("failed-precondition","Combined advance snapshot changed.");}}
      if(b.combinedPayment&&(b as Booking&{quoteJourneyId?:string}).quoteJourneyId){const jobs=await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId","==",b.id).limit(2));if(jobs.size!==1)throw new HttpsError("failed-precondition","Quote job binding needs review.");await readConsultPaymentBinding(db,tx,jobs.docs[0]!.data()as ServiceJob,b as unknown as Record<string,unknown>);}
      if (b.advancePaymentId) {
        const existing = await tx.get(db.collection(COLLECTIONS.payments()).doc(b.advancePaymentId as string));
        const payment = existing.data() as Payment;
        if(!payment||payment.id!==b.advancePaymentId||payment.targetType!=="booking"||payment.jobId!==null||payment.studioId!==b.studioId||payment.currency!==b.priceBreakdown.currency||payment.method!=="razorpay_payment_link"||payment.bookingId!==b.id||payment.customerId!==b.customerId||payment.tenantId!==b.tenantId)throw new HttpsError("failed-precondition","Payment binding needs review.");
        if(b.combinedPayment&&payment.amount!==b.combinedPayment.payNowPaise)throw new HttpsError("failed-precondition","Combined payment amount changed.");
        assertDisplayedAmount(payment.amount);
        return { created: false as const, existing: payment };
      }
      if(b.combinedPayment&&!combinedCheckoutEnabled())throw new HttpsError("failed-precondition","Combined payment is not active.");
      const legacyAdvance = ()=>buildAdvancePaymentRequest(
        {
          id: b.id,
          payMode: b.payMode ?? "online",
          currency: b.priceBreakdown.currency ?? "INR",
          priceBreakdown: b.priceBreakdown,
          advancePaymentId: b.advancePaymentId ?? null,
        },
        ADVANCE_BASIS_POLICY,
        ADVANCE_ROUNDING_POLICY,
        { enabled: advancePaymentEnabled() },
      );
      const snap=b.combinedPayment;
      const advance=snap?(()=>{const checked=checkedCombinedPayment(snap,b.totalAmount);if(snap.choice!=='advance20'||checked.payNowPaise!==snap.payNowPaise||checked.balancePaise!==snap.balancePaise)throw new HttpsError('failed-precondition','Combined payment snapshot changed.');return{amountPaise:snap.payNowPaise,currency:b.priceBreakdown.currency??'INR',bookingId:b.id,description:'20% advance for combined service and transport',referenceId:`advance-${b.id}`,advancePaise:snap.payNowPaise,dueAtStudioPaise:snap.balancePaise}})():legacyAdvance();
      assertDisplayedAmount(advance.amountPaise);
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

    const existing = claim.created ? null : (claim.existing as Payment);
    if (existing?.status === "completed") {
      throw new HttpsError("already-exists", "The advance for this booking is already paid.");
    }

    // Exclusive claim held (or the same record found on retry). ALL provider
    // interaction goes through ensureAdvanceLink (reviewer A/G-series):
    // reconcile-first, never a blind stored URL, never a blind second link,
    // ambiguity persisted and resolved via the provider or manual review.
    const customerSnap = await db.collection(COLLECTIONS.customers()).doc(booking.customerId).get();
    const customer = customerSnap.exists ? (customerSnap.data() as Customer) : null;
    const provider = getPaymentProvider();
    const deps: AdvanceLinkDeps = {
      fetchLink: async (id) => {
        const r = await provider.fetchPaymentLink(id);
        return r ? { id: r.providerPaymentLinkId, amount: r.amount, currency: r.currency, paymentUrl: r.paymentUrl, status: r.status } : null;
      },
      createLink: (params) => provider.createPaymentLink(params),
      // R1: exclusive create claim - ONE transaction: no foreign lease and
      // no NEW bound link id required; pre-marks ambiguity so a crash after
      // this point fails CLOSED (never a blind second payable link).
      claimCreate: async (leaseId, knownLinkId) => {
        return db.runTransaction(async (tx) => {
          const heldBooking = (await tx.get(bookingRef)).data() as Booking;
          assertActiveHold(heldBooking);
          const cur = (await tx.get(paymentRef)).data() as Payment;
          if (cur.status === "completed") throw new HttpsError("already-exists", "The advance is already paid.");
          if (cur.linkCreateLeaseId && cur.linkCreateLeaseId !== leaseId) {
            return { kind: "held" as const, ambiguous: !!cur.orderAmbiguous };
          }
          if (cur.razorpayPaymentLinkId && cur.razorpayPaymentLinkId !== knownLinkId) {
            return { kind: "linked" as const, linkId: cur.razorpayPaymentLinkId };
          }
          tx.update(paymentRef, { linkCreateLeaseId: leaseId, orderAmbiguous: true, updatedAt: new Date().toISOString() });
          return { kind: "acquired" as const };
        });
      },
      // R1: conflict-aware binding patch - ONE transaction. If a DIFFERENT
      // link id was bound first, THIS create lost: its ids go to the
      // append-only history (never an unbound payable loser), the winner is
      // reported back for provider cancel + reconcile. The winning patch
      // binds ids and clears the lease + ambiguity atomically.
      patch: async (pt) => {
        return db.runTransaction(async (tx) => {
          const cur = (await tx.get(paymentRef)).data() as Payment;
          const nowIso = new Date().toISOString();
          if (cur.razorpayPaymentLinkId && cur.razorpayPaymentLinkId !== pt.razorpayPaymentLinkId) {
            tx.update(paymentRef, {
              priorLinkIds: FieldValue.arrayUnion(pt.razorpayPaymentLinkId),
              ...(pt.razorpayOrderId ? { priorOrderIds: FieldValue.arrayUnion(pt.razorpayOrderId) } : {}),
              linkCreateLeaseId: null, updatedAt: nowIso });
            return { bound: false as const, winnerLinkId: cur.razorpayPaymentLinkId };
          }
          tx.update(paymentRef, {
            paymentUrl: pt.paymentUrl,
            razorpayPaymentLinkId: pt.razorpayPaymentLinkId,
            razorpayOrderId: pt.razorpayOrderId,
            // Append-only history (reviewer G2): replaced link/order ids stay
            // resolvable for late captures; never overwritten away.
            ...(pt.superseded?.linkId ? { priorLinkIds: FieldValue.arrayUnion(pt.superseded.linkId) } : {}),
            ...(pt.superseded?.orderId ? { priorOrderIds: FieldValue.arrayUnion(pt.superseded.orderId) } : {}),
            linkCreateLeaseId: null, orderAmbiguous: false,
            updatedAt: nowIso });
          return { bound: true as const };
        });
      },
      // R1: post-commit provider cancel for a lost race's link.
      cancelLink: async (id) => provider.cancelPaymentLink(id),
      // W1: ambiguity is PERSISTED on the payment record.
      markAmbiguous: async (b) => {
        await paymentRef.update({ orderAmbiguous: b, updatedAt: new Date().toISOString() });
      },
      // W1: manual review lands on the REAL ops surface (staffAlerts), with
      // a deterministic id so repeated failures update one alert.
      flagManualReview: async (reason) => {
        const alertRef = db.collection(COLLECTIONS.staffAlerts()).doc(`advance_review_${paymentRef.id}`);
        await alertRef.set({
          id: alertRef.id, tenantId: booking.tenantId, studioId: booking.studioId ?? null,
          kind: "advance_manual_review", paymentId: paymentRef.id, bookingId: booking.id,
          reason, createdAt: new Date().toISOString(),
        });
      },
    };

    const state = existing ?? ((await paymentRef.get()).data() as Payment);
    let outcome;
    try {
      outcome = await ensureAdvanceLink(
        {
          id: state.id,
          amount: state.amount,
          currency: state.currency,
          paymentUrl: state.paymentUrl ?? null,
          razorpayPaymentLinkId: state.razorpayPaymentLinkId ?? null,
          razorpayOrderId: state.razorpayOrderId ?? null,
          orderAmbiguous: state.orderAmbiguous ?? null,
        },
        {
          bookingId: booking.id,
          description: "Advance for your AutoDeck booking (balance payable at the studio)",
          customerName: customer?.name || "Customer",
          customerPhone: customer?.phone ?? "",
          referenceId: paymentRef.id,
        },
        deps,
      );
    } catch (e) {
      // Provider unreachable mid-reconciliation or create failed: ambiguity
      // is already persisted where relevant. Surface a retryable error.
      throw new HttpsError("unavailable", e instanceof Error ? e.message : "Payment provider is unavailable. Please try again shortly.");
    }

    if (outcome.outcome === "manual_review") {
      return { paymentId: paymentRef.id, paymentUrl: null, status: "manual_review" };
    }
    return { paymentId: paymentRef.id, paymentUrl: outcome.paymentUrl, status: "pending" };
  },
);
