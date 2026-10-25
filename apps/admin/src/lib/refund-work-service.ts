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

export type LegacyRefundClaim = {
  paymentId: string;
  claimedAt: string | null;
  reconcileState: string | null;
  reconcileNote: string | null;
  paymentStatus: string | null;
  amount: number | null;
  currency: string | null;
};

export type RefundWork = {
  requests: RefundWorkRequest[];
  reviewPayments: RefundReviewPayment[];
  legacyClaims: LegacyRefundClaim[];
  /** false while older claim records are still being scanned: an empty
   * legacyClaims list is not yet an "all clear". */
  legacyScanComplete: boolean;
};

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

export type ReconcileRefundClaimsOutput = {
  projected: number; converged: number; released: number; held: number; alreadyAccounted: number;
  scanned: number; exhausted: boolean;
};

/** Admin-only RECONCILIATION-ONLY sweep of retained legacy refund claims:
 * verifies provider evidence read-only and projects truthful processed money,
 * releases on authoritative absence, or holds with a visible note. It NEVER
 * submits a new refund. The callable itself is production-gated like the
 * outbox drain until deploy-time activation review lifts the refusal. */
export async function reconcileRefundClaims(): Promise<ReconcileRefundClaimsOutput> {
  const fn = httpsCallable<Record<string, never>, ReconcileRefundClaimsOutput>(functions, "reconcileRefundClaims");
  const result = await fn({});
  return result.data;
}
