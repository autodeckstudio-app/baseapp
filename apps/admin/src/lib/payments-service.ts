"use client";

import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Payment } from "@autodeck/core";

const LIST_LIMIT = 300;

/** Live, tenant-wide payment feed — newest first. Customer/vehicle/job/booking/
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

type InitiateRefundInput = { paymentId: string; reason: string };
type InitiateRefundOutput = { paymentId: string; refunded: boolean; providerRefundId: string | null };

// Admin-only, server-validated: only a "completed" payment can be refunded,
// the full amount is always taken from the original payment (never client
// input), and the linked invoice/job/booking are synced atomically inside
// initiateRefund itself — this is a thin wrapper only.
export async function refundPayment(paymentId: string, reason: string): Promise<InitiateRefundOutput> {
  const fn = httpsCallable<InitiateRefundInput, InitiateRefundOutput>(functions, "initiateRefund");
  const result = await fn({ paymentId, reason });
  return result.data;
}
