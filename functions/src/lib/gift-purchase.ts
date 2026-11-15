// Starting a gift purchase, safely. One buyer has at most one in-flight purchase:
// a per-buyer slot doc serializes concurrent createGift calls (double-tap, retry after a
// lost response, two devices). The loser's transaction retries, sees the winner's slot and
// returns the same unpaid gift instead of creating a second one. Every state change is in
// the transaction; the code stays in giftSecrets until the payment is verified.
import type { Firestore } from "firebase-admin/firestore";
import type { AuthorizedUser } from "@autodeck/auth";
import { GIFT_SERVICE_ID, type Gift, type Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { writeAuditLog } from "../middleware/audit.js";
import { generateGiftCode, hashGiftCode } from "./gift-code.js";

export interface GiftPurchaseSlot { giftId: string; paymentId: string; amountPaise: number; updatedAt: string }

/** A started purchase can be reused for this long. Matches the buyer-facing retry window. */
export const GIFT_PURCHASE_REUSE_MS = 24 * 3_600_000;

/** The slot's purchase can still be used: same price, fresh, and nothing has moved on. */
export function slotReusable(slot: GiftPurchaseSlot, gift: Gift | undefined, payment: Payment | undefined, amountPaise: number, nowMs: number): boolean {
  if (slot.amountPaise !== amountPaise) return false;
  if (nowMs - Date.parse(slot.updatedAt) > GIFT_PURCHASE_REUSE_MS) return false;
  if (!gift || !payment) return false;
  if (gift.status !== "PENDING_PAYMENT") return false;
  return payment.status === "pending" || payment.status === "processing";
}

export interface GiftPurchaseStart { giftId: string; paymentId: string; amountPaise: number; reused: boolean }

export async function createGiftPurchase(db: Firestore, user: AuthorizedUser, amountPaise: number): Promise<GiftPurchaseStart> {
  const slotRef = db.collection(COLLECTIONS.giftPurchaseSlots()).doc(user.uid);
  return db.runTransaction(async (tx) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 1. The buyer's own in-flight purchase wins: double-tap and retry return it unchanged.
    const slotSnap = await tx.get(slotRef);
    if (slotSnap.exists) {
      const slot = slotSnap.data() as GiftPurchaseSlot;
      const giftSnap = await tx.get(db.collection(COLLECTIONS.gifts()).doc(slot.giftId));
      const paySnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(slot.paymentId));
      const g = giftSnap.exists ? (giftSnap.data() as Gift) : undefined;
      const p = paySnap.exists ? (paySnap.data() as Payment) : undefined;
      if (slotReusable(slot, g, p, amountPaise, nowMs)) {
        return { giftId: g!.id, paymentId: p!.id, amountPaise, reused: true };
      }
    }

    // 2. A recent unpaid gift with no slot yet (started before slots existed) is adopted, not duplicated.
    const recent = await tx.get(db.collection(COLLECTIONS.gifts()).where("buyerId", "==", user.uid).limit(25));
    const candidates = recent.docs
      .map((d) => d.data() as Gift)
      .filter((g) => g.status === "PENDING_PAYMENT" && g.amountPaise === amountPaise && nowMs - Date.parse(g.createdAt) <= GIFT_PURCHASE_REUSE_MS)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    for (const g of candidates) {
      const pq = await tx.get(db.collection(COLLECTIONS.payments()).where("giftId", "==", g.id).limit(1));
      const pay = pq.empty ? null : (pq.docs[0]!.data() as Payment);
      if (pay && (pay.status === "pending" || pay.status === "processing")) {
        tx.set(slotRef, { giftId: g.id, paymentId: pay.id, amountPaise, updatedAt: nowIso } satisfies GiftPurchaseSlot);
        return { giftId: g.id, paymentId: pay.id, amountPaise, reused: true };
      }
    }

    // 3. Nothing to reuse: make the gift, its payment, the secret code and the slot together.
    const code = generateGiftCode();
    const codeHash = hashGiftCode(code)!;
    const ref = db.collection(COLLECTIONS.gifts()).doc();
    const payRef = db.collection(COLLECTIONS.payments()).doc();
    const gift: Gift = {
      id: ref.id, tenantId: user.claims.tenantId, buyerId: user.uid, serviceId: GIFT_SERVICE_ID, amountPaise, codeHash, codeTail: code.slice(-4),
      status: "PENDING_PAYMENT", createdAt: nowIso, purchasedAt: null, expiresAt: null, claimedBy: null, redeemedBy: null, redeemedAt: null,
      bookingId: null, voidedAt: null, voidReason: null, refundRequested: false, paymentId: null,
    };
    const payment: Payment = {
      id: payRef.id, tenantId: user.claims.tenantId, studioId: null, targetType: "gift", jobId: null, bookingId: null, membershipId: null, giftId: ref.id,
      customerId: user.uid, amount: amountPaise, currency: "INR", method: "razorpay_payment_link", status: "pending",
      razorpayPaymentLinkId: null, razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
      manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null, completedAt: null, failedAt: null, cancelledAt: null,
      refundedAt: null, createdAt: nowIso, updatedAt: nowIso,
    };
    tx.create(ref, gift);
    tx.create(payRef, payment);
    tx.create(db.collection(COLLECTIONS.giftSecrets()).doc(ref.id), { giftId: ref.id, buyerId: user.uid, tenantId: user.claims.tenantId, code, createdAt: nowIso });
    tx.set(slotRef, { giftId: ref.id, paymentId: payRef.id, amountPaise, updatedAt: nowIso } satisfies GiftPurchaseSlot);
    writeAuditLog(tx, { action: "gift.created", entityType: "Gift", entityId: ref.id, user, studioId: null, after: { amountPaise, tail: gift.codeTail } });
    return { giftId: ref.id, paymentId: payRef.id, amountPaise, reused: false };
  });
}
