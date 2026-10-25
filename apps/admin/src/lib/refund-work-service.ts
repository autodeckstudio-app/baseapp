"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type RefundWorkRequest = {
  id: string;
  status: string;
  paymentId: string | null;
  bookingId: string | null;
  jobId: string | null;
  amountPaise: number | null;
  providerRefundId: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type RefundReviewPayment = {
  id: string;
  status: string;
  refundState: string | null;
  amount: number | null;
  refundAmount: number | null;
  currency: string | null;
  invoiceId: string | null;
  bookingId: string | null;
  jobId: string | null;
  customerId: string | null;
  updatedAt: string | null;
};

export type RefundWork = { requests: RefundWorkRequest[]; reviewPayments: RefundReviewPayment[] };

/** Admin-only, read-only: refundRequests are server-only under Firestore
 * rules, so this callable is the only way staff can see held or in-flight
 * refund work for their own tenant. */
export async function listRefundWork(): Promise<RefundWork> {
  const fn = httpsCallable<Record<string, never>, RefundWork>(functions, "listRefundWork");
  const result = await fn({});
  return result.data;
}

export type RunRefundOutboxOutput = { submitted: number; projected: number; failed: number };

/** Admin-only: asks the server to drain this tenant's refund outbox now.
 * The callable itself is production-gated; in the live project it refuses
 * until deploy-time activation review lifts the refusal. */
export async function runRefundOutbox(): Promise<RunRefundOutboxOutput> {
  const fn = httpsCallable<{ limit?: number }, RunRefundOutboxOutput>(functions, "processRefundOutbox");
  const result = await fn({});
  return result.data;
}
