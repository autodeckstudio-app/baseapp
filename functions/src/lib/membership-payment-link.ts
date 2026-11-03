import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Payment, Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { ensureAdvanceLink } from "./advance-link.js";
import type { PaymentProvider } from "./payment-provider.js";

/** Memberships use the same reconcile-first, exclusive-create lifecycle as advances.
 * Claims persist without automatic TTL reset: a crash after claim may have issued
 * a provider link, so missing reference/ambiguity must go to manual review.
 * Does not activate a membership. Only the existing verified capture path can do that. */
export async function obtainMembershipPaymentLink(db: Firestore, payment: Payment, provider: PaymentProvider, customerPhone: string) {
  const ref = db.collection(COLLECTIONS.payments()).doc(payment.id);
  const assertPayable = async (tx: FirebaseFirestore.Transaction) => {
    const p = (await tx.get(ref)).data() as Payment | undefined;
    if (!p || p.targetType !== "membership" || p.customerId !== payment.customerId || p.tenantId !== payment.tenantId || !p.membershipId || p.amount !== payment.amount || p.currency !== payment.currency || p.method !== "razorpay_payment_link" || p.status !== "pending") throw new Error("This membership payment is not available. Check its status before retrying.");
    const g = (await tx.get(db.collection(COLLECTIONS.memberships()).doc(p.membershipId))).data() as Membership | undefined;
    if (!g || g.status !== "pending" || g.customerId !== p.customerId || g.tenantId !== p.tenantId) throw new Error("This membership is no longer awaiting payment.");
    return p;
  };
  // Even stored-link replays require a current payable membership, not just a current Payment.
  await db.runTransaction(async tx => { await assertPayable(tx); });
  return ensureAdvanceLink({ ...payment, paymentUrl: payment.paymentUrl ?? null, orderAmbiguous: payment.orderAmbiguous ?? null }, {
    referenceId: payment.id, bookingId: payment.membershipId!, description: "AutoDeck membership", customerName: "Customer", customerPhone,
  }, {
    fetchLink: async id => { const r = await provider.fetchPaymentLink(id); // Membership dead links require studio review, never automatic regeneration.
      if (!r || !["created", "issued"].includes(r.status) || r.amount !== payment.amount || r.currency !== payment.currency) {
        await ref.update({ paymentUrl: null });
        return { id, amount: r?.amount ?? 0, currency: r?.currency ?? "", paymentUrl: "", status: r?.status === "paid" || r?.status === "partially_paid" ? r.status : "needs_review" };
      }
      return { id: r.providerPaymentLinkId, amount: r.amount, currency: r.currency, paymentUrl: r.paymentUrl, status: r.status }; },
    createLink: params => provider.createPaymentLink(params),
    claimCreate: (leaseId, knownLinkId) => db.runTransaction(async tx => {
      const p = await assertPayable(tx);
      // Never mint a link over a Standard Checkout order created on another device.
      if (p.linkCreateLeaseId === "membership-standard-checkout" || (p.razorpayOrderId && !p.razorpayPaymentLinkId)) throw new Error("This membership already has a checkout in progress. Complete it on that device or contact the studio.");
      if (p.linkCreateLeaseId && p.linkCreateLeaseId !== leaseId) return { kind: "held" as const, ambiguous: !!p.orderAmbiguous };
      if (p.razorpayPaymentLinkId && p.razorpayPaymentLinkId !== knownLinkId) return { kind: "linked" as const, linkId: p.razorpayPaymentLinkId };
      tx.update(ref, { linkCreateLeaseId: leaseId, orderAmbiguous: true, updatedAt: new Date().toISOString() }); return { kind: "acquired" as const };
    }),
    patch: patch => db.runTransaction(async tx => {
      const p = (await tx.get(ref)).data() as Payment;
      const history = { ...(patch.razorpayOrderId ? { priorOrderIds: FieldValue.arrayUnion(patch.razorpayOrderId) } : {}), priorLinkIds: FieldValue.arrayUnion(patch.razorpayPaymentLinkId) };
      if (p.razorpayPaymentLinkId && p.razorpayPaymentLinkId !== patch.razorpayPaymentLinkId) { tx.update(ref, history); return { bound: false as const, winnerLinkId: p.razorpayPaymentLinkId }; }
      tx.update(ref, { paymentUrl: patch.paymentUrl, razorpayPaymentLinkId: patch.razorpayPaymentLinkId, razorpayOrderId: patch.razorpayOrderId,
        ...(patch.superseded?.linkId ? { priorLinkIds: FieldValue.arrayUnion(patch.superseded.linkId) } : {}),
        ...(patch.superseded?.orderId ? { priorOrderIds: FieldValue.arrayUnion(patch.superseded.orderId) } : {}),
        orderAmbiguous: false, linkCreateLeaseId: null, updatedAt: new Date().toISOString() }); return { bound: true as const };
    }),
    cancelLink: id => provider.cancelPaymentLink(id),
    markAmbiguous: orderAmbiguous => ref.update({ orderAmbiguous }).then(() => undefined),
    flagManualReview: reason => db.collection(COLLECTIONS.staffAlerts()).doc(`membership_review_${payment.id}`).set({ id: `membership_review_${payment.id}`, kind: "membership_manual_review", tenantId: payment.tenantId, studioId: null, paymentId: payment.id, membershipId: payment.membershipId, reason: `${reason}. Ops: fetch by referenceId ${payment.id} and all current/prior link/order IDs BEFORE clearing any lease. Never blindly reset or create a replacement.`, createdAt: new Date().toISOString() }).then(() => undefined),
  });
}
