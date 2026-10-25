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

export type RefundClaimTruth = { paymentId: string; state: string; note: string | null };

export type RefundWork = {
  requests: RefundWorkRequest[];
  reviewPayments: RefundReviewPayment[];
  legacyClaims: LegacyRefundClaim[];
  /** false while older claim records are still being scanned: an empty
   * legacyClaims list is not yet an "all clear". */
  legacyScanComplete: boolean;
  /** Authoritative current state for claim ids the caller already shows:
   * paged scans never return resolved/released claims, so this is how known
   * rows learn they were reconciled away. */
  claimTruth: RefundClaimTruth[];
};

/** Admin-only, read-only: refundRequests are server-only under Firestore
 * rules, so this callable is the only way staff can see held or in-flight
 * refund work for their own tenant. */
export async function listRefundWork(knownClaimPaymentIds: string[] = []): Promise<RefundWork> {
  const fn = httpsCallable<{ knownClaimPaymentIds: string[] }, RefundWork>(functions, "listRefundWork");
  // The backend bounds known ids per call; batch so an accumulated review
  // cycle larger than the bound still refreshes EVERY shown row. Paged scan
  // fields come from the first call; claimTruth merges across all batches.
  const chunks: string[][] = [];
  for (let i = 0; i < knownClaimPaymentIds.length; i += 200) chunks.push(knownClaimPaymentIds.slice(i, i + 200));
  if (chunks.length === 0) chunks.push([]);
  const first = (await fn({ knownClaimPaymentIds: chunks[0]! })).data;
  const claimTruth = [...first.claimTruth];
  for (const chunk of chunks.slice(1)) {
    const more = (await fn({ knownClaimPaymentIds: chunk })).data;
    claimTruth.push(...more.claimTruth);
  }
  return { ...first, claimTruth };
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
