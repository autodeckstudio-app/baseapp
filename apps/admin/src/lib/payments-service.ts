"use client";

import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Payment } from "@autodeck/core";

const LIST_LIMIT = 300;

/** Live, tenant-wide payment feed - newest first. Customer/vehicle/job/booking/
 * status/method filters are applied client-side. */
export function listenToPayments(
  tenantId: string,
  onData: (payments: Payment[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.payments()),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(LIST_LIMIT),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Payment)), onError);
}

type ConfirmManualPaymentInput = { paymentId: string };
type ConfirmManualPaymentOutput = { paymentId: string; invoiceId: string | null; alreadyCompleted: boolean };

// Office-only (server-enforced for UPI since 28 Oct 2026): the admin has
// checked the receiving account and marks a pending manual payment received.
// Completes the payment and issues the invoice. Idempotent server-side.
// Pending claims confirm through the callable that owns the payment's state:
// job payments through confirmManualPayment (which also issues the invoice),
// membership claims through confirmMembershipPayment (which activates the
// membership). A membership payment has no invoice - never route it through
// the job path.
export async function confirmReceivedPayment(payment: Pick<Payment, "id" | "membershipId" | "method">): Promise<void> {
  if (payment.membershipId) {
    const fn = httpsCallable<{ membershipId: string; method: Payment["method"] }, unknown>(functions, "confirmMembershipPayment");
    await fn({ membershipId: payment.membershipId, method: payment.method });
    return;
  }
  const fn = httpsCallable<ConfirmManualPaymentInput, ConfirmManualPaymentOutput>(functions, "confirmManualPayment");
  await fn({ paymentId: payment.id });
}

type InitiateRefundInput = { paymentId: string; reason: string };
type InitiateRefundOutput = { paymentId: string; refunded: boolean; providerRefundId: string | null };

// Admin-only, server-validated: only a "completed" payment can be refunded,
// the full amount is always taken from the original payment (never client
// input), and the linked invoice/job/booking are synced atomically inside
// initiateRefund itself - this is a thin wrapper only.
export async function refundPayment(paymentId: string, reason: string): Promise<InitiateRefundOutput> {
  const fn = httpsCallable<InitiateRefundInput, InitiateRefundOutput>(functions, "initiateRefund");
  const result = await fn({ paymentId, reason });
  return result.data;
}
