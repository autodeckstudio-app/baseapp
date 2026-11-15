import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Payment, Gift } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { GIFT_PURCHASE_REUSE_MS } from "./gift-purchase.js";
import { ensureAdvanceLink } from "./advance-link.js";
import type { PaymentProvider } from "./payment-provider.js";

/** Native gifts use the same reconcile-first, exclusive-create lifecycle as advances.
 * Does not activate a gift. Only the existing verified capture path can do that. */
export async function obtainGiftPaymentLink(db: Firestore, payment: Payment, provider: PaymentProvider, customerPhone: string) {
  const ref = db.collection(COLLECTIONS.payments()).doc(payment.id);
  const assertPayable = async (tx: FirebaseFirestore.Transaction) => {
    const p = (await tx.get(ref)).data() as Payment | undefined;
    if (!p || p.targetType !== "gift" || p.customerId !== payment.customerId || p.tenantId !== payment.tenantId || !p.giftId || p.amount !== payment.amount || p.currency !== payment.currency || p.method !== "razorpay_payment_link" || p.status !== "pending") throw new Error("This gift payment is not available. Check its status before retrying.");
    const g = (await tx.get(db.collection(COLLECTIONS.gifts()).doc(p.giftId))).data() as Gift | undefined;
    if (!g || g.status !== "PENDING_PAYMENT" || g.buyerId !== p.customerId || g.tenantId !== p.tenantId || g.amountPaise !== p.amount || !Number.isFinite(Date.parse(g.createdAt)) || Date.now() - Date.parse(g.createdAt) > GIFT_PURCHASE_REUSE_MS) throw new Error("This gift is no longer awaiting payment.");
    return p;
  };
  // Even stored-link replays require a current payable gift, not just a current Payment.
  await db.runTransaction(async tx => { await assertPayable(tx); });
  return ensureAdvanceLink({ ...payment, paymentUrl: payment.paymentUrl ?? null, orderAmbiguous: payment.orderAmbiguous ?? null }, {
    referenceId: payment.id, bookingId: payment.giftId!, description: "AutoDeck gift: foam wash", customerName: "Customer", customerPhone,
  }, {
    fetchLink: async id => { const r = await provider.fetchPaymentLink(id); return r ? { id: r.providerPaymentLinkId, amount: r.amount, currency: r.currency, paymentUrl: r.paymentUrl, status: r.status } : null; },
    createLink: params => provider.createPaymentLink(params),
    claimCreate: (leaseId, knownLinkId) => db.runTransaction(async tx => {
      const p = await assertPayable(tx);
      // Never mint a link over a Standard Checkout order created on another device.
      if (p.linkCreateLeaseId === "gift-standard-checkout" || (p.razorpayOrderId && !p.razorpayPaymentLinkId)) throw new Error("This gift already has a checkout in progress. Complete it on that device or contact the studio.");
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
    flagManualReview: reason => db.collection(COLLECTIONS.staffAlerts()).doc(`gift_review_${payment.id}`).set({ id: `gift_review_${payment.id}`, kind: "gift_manual_review", tenantId: payment.tenantId, studioId: null, paymentId: payment.id, giftId: payment.giftId, reason, createdAt: new Date().toISOString() }).then(() => undefined),
  });
}
