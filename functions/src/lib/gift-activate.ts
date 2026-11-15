// The one rule for turning a paid gift on, shared by the verified-payment path and the helper. Pure, so it is unit tested.
import { giftExpiry, type Gift, type Payment } from "@autodeck/core";

export type GiftActivation =
  | { activate: true; patch: Pick<Gift, "status" | "purchasedAt" | "expiresAt" | "paymentId"> }
  | { activate: false; reason: "gift_missing" | "gift_not_pending" | "amount_mismatch" | "wrong_buyer" };

/** Activate only a PENDING_PAYMENT gift, for the buyer who paid, when the paid amount equals the gift price. The 60 days start now. */
export function planGiftActivation(gift: Gift | undefined, payment: Pick<Payment, "id" | "amount" | "customerId" | "tenantId">, nowIso: string): GiftActivation {
  if (!gift) return { activate: false, reason: "gift_missing" };
  if (gift.status !== "PENDING_PAYMENT") return { activate: false, reason: "gift_not_pending" };
  if (gift.buyerId !== payment.customerId || gift.tenantId !== payment.tenantId) return { activate: false, reason: "wrong_buyer" };
  if (payment.amount !== gift.amountPaise) return { activate: false, reason: "amount_mismatch" };
  return { activate: true, patch: { status: "ACTIVE", purchasedAt: nowIso, expiresAt: giftExpiry(nowIso), paymentId: payment.id } };
}
