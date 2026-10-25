// Booking-refund outbox: reserve -> submit to provider -> reconcile/projection.
//
// Why an outbox: a provider refund is an external side effect that must happen
// exactly once, and Firestore transactions retry — so the two are sequenced
// through a durable request record instead of one fragile call.
//
//  - reserveRefund: one active reservation per payment; rejects amounts that
//    would over-refund.
//  - runRefundOutbox: submits reserved requests to the provider (mock in
//    dev/emulator; never wired to a scheduler or production adapter), then
//    projects truthful state onto the payment/job/booking in one transaction.
//  - Crash safety: a request that reached the provider but was never
//    projected keeps projectionNeeded=true; the next run projects WITHOUT
//    resubmitting to the provider.
//
// Held, deliberately: the issued-invoice/credit-note/tax treatment of a
// refund (owner's accountant decides) — the runner never voids an invoice and
// marks the hold explicitly instead.
import type { Firestore } from "firebase-admin/firestore";
import type { Payment, ServiceJob, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import type { PaymentProvider } from "./payment-provider.js";
import { verifyRefundAccounting } from "./refund-accounting.js";

// ambiguous = the submit outcome is UNKNOWN (response lost / provider cannot
  // confirm). It is an unresolved hold, NOT a failure: the reservation stays
  // active so the refundable balance is never released for a duplicate
  // request, and the runner only reconciles it via provider evidence.
// submitting = a runner holds the submission lease: the provider call is in
// flight or was lost mid-flight. Reconciled like ambiguous (bound provider
// evidence only), NEVER blindly resubmitted.
export type RefundRequestStatus = "reserved" | "submitting" | "submitted" | "accepted" | "ambiguous" | "projected" | "failed";

export interface RefundRequest {
  id: string;
  tenantId: string;
  studioId: string | null;
  paymentId: string;
  jobId: string | null;
  bookingId: string | null;
  amountPaise: number;
  reason: string;
  status: RefundRequestStatus;
  providerRefundId: string | null;
  projectionNeeded: boolean;
  // Submission lease (D2): which runner claimed reserved->submitting and when.
  // A stale lease means a crashed runner; recovery reconciles, never resubmits.
  leaseBy: string | null;
  leaseAt: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function requestsCol(db: Firestore) {
  return db.collection(COLLECTIONS.refundRequests());
}

/** Remaining refundable paise on a payment (captured minus already refunded). */
export function refundablePaise(payment: Payment): number {
  // "partially_refunded" is written by this outbox's own projection; the vintage Payment
  // type union predates it, hence the string compare.
  if (payment.status !== "completed" && (payment.status as string) !== "partially_refunded") return 0;
  return Math.max(0, payment.amount - (payment.refundAmount ?? 0));
}

export async function activeReservation(db: Firestore, paymentId: string): Promise<(RefundRequest & { ref: FirebaseFirestore.DocumentReference }) | null> {
  const snap = await requestsCol(db).where("paymentId", "==", paymentId).get();
  for (const doc of snap.docs) {
    const r = doc.data() as RefundRequest;
    if (r.status === "reserved" || r.status === "submitting" || r.status === "submitted" || r.status === "accepted" || r.status === "ambiguous") {
      return { ...r, ref: doc.ref };
    }
  }
  return null;
}

/**
 * Reserves a refund for a payment. One active reservation per payment; the
 * amount must fit inside what is still refundable. Returns the new request id.
 */
/**
 * Concurrency-safe: the active-reservation guard doc is claimed with
 * tx.create inside one transaction, so two simultaneous reservations for the
 * same payment cannot both win — exactly one survives. The guard is released
 * when the request reaches a terminal state (projected or failed).
 */
export type ReservePlan =
  | { ok: true; guardRef: FirebaseFirestore.DocumentReference; requestRef: FirebaseFirestore.DocumentReference; guard: Record<string, unknown>; request: RefundRequest }
  | { ok: false; reason: string; code: "same_reservation" | "conflict" | "invalid" };

/**
 * READ phase of a reservation, to run inside a caller's transaction BEFORE any write. Deterministic
 * refusals (bad amount, over-refundable, an active reservation already exists) are returned as
 * {ok:false}, never thrown, so a caller that must still commit its own work can do so and flag it.
 * Infrastructure errors (transaction conflicts, read failures) still throw.
 */
export async function planReserveInTx(
  tx: FirebaseFirestore.Transaction,
  db: Firestore,
  i: { payment: Payment; amountPaise: number; reason: string; createdBy: string },
): Promise<ReservePlan> {
  const amount = Math.round(i.amountPaise);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: "refund amount must be a positive integer (paise)", code: "invalid" };
  // D4: financial truth is re-read INSIDE the transaction. The caller's
  // Payment is only a hint for which doc to load - a stale snapshot (e.g.
  // read before another refund projected) must never size a reservation.
  const freshSnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(i.payment.id));
  if (!freshSnap.exists) return { ok: false, code: "invalid", reason: `payment ${i.payment.id} not found` };
  const payment = freshSnap.data() as Payment;
  if (payment.tenantId !== i.payment.tenantId) {
    return { ok: false, code: "invalid", reason: `payment ${i.payment.id} tenant does not match the caller's payment` };
  }
  const refundable = refundablePaise(payment);
  if (amount > refundable) {
    return { ok: false, code: "invalid", reason: `refund of ${amount} exceeds the refundable ${refundable} on payment ${i.payment.id}` };
  }
  const guardRef = requestsCol(db).doc(`active_${payment.id}`);
  const now = new Date().toISOString();
  // Transactional reads: a losing racer's snapshot conflicts with the
  // winner's guard create, retries, and then sees the guard here.
  // A manual-refund obligation (admin cancel with no provider id) claims refund_<paymentId>: never open a provider refund on top of it.
  const manualClaim = await tx.get(db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payment.id}`));
  if (manualClaim.exists) return { ok: false, code: "conflict", reason: `payment ${payment.id} already has a manual refund obligation` };
  const guardSnap = await tx.get(guardRef);
  const allSnap = await tx.get(requestsCol(db).where("paymentId", "==", payment.id));
  const active = allSnap.docs
    .map((d) => d.data() as RefundRequest)
    .find((r) => r.status === "reserved" || r.status === "submitted" || r.status === "accepted" || r.status === "ambiguous");
  if (guardSnap.exists || active) {
    // The SAME payment, FULL amount and reason already reserved is satisfied (idempotent). Anything else is a conflict.
    const same = !!active && active.paymentId === payment.id && active.amountPaise === amount && active.reason === i.reason && (active.status === "reserved" || active.status === "submitted" || active.status === "accepted");
    const id = active?.id ?? (guardSnap.data() as { requestId?: string } | undefined)?.requestId ?? "unknown";
    return { ok: false, code: same ? "same_reservation" : "conflict", reason: `payment ${payment.id} already has an active refund request (${id})` };
  }
  // Count only real rr_* requests (never the transient guard) so ids stay
  // unique even after a guard is released on a terminal request.
  const priorCount = allSnap.docs.filter((d) => d.id.startsWith("rr_")).length;
  const requestId = `rr_${payment.id}_${priorCount + 1}`;
  const request: RefundRequest = {
    id: requestId,
    tenantId: payment.tenantId,
    studioId: payment.studioId,
    paymentId: payment.id,
    jobId: payment.jobId,
    bookingId: payment.bookingId,
    amountPaise: amount,
    reason: i.reason,
    status: "reserved",
    providerRefundId: null,
    projectionNeeded: false,
    leaseBy: null,
    leaseAt: null,
    lastError: null,
    createdBy: i.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, guardRef, requestRef: requestsCol(db).doc(requestId), guard: { paymentId: payment.id, requestId, createdAt: now }, request };
}

/** WRITE phase: only after every read of the transaction is done. */
export function applyReserveInTx(tx: FirebaseFirestore.Transaction, plan: Extract<ReservePlan, { ok: true }>): { requestId: string } {
  tx.create(plan.guardRef, plan.guard);
  tx.create(plan.requestRef, plan.request);
  return { requestId: plan.request.id };
}

export async function reserveRefund(
  db: Firestore,
  i: { payment: Payment; amountPaise: number; reason: string; createdBy: string },
): Promise<{ requestId: string }> {
  return db.runTransaction(async (tx) => {
    const plan = await planReserveInTx(tx, db, i);
    if (!plan.ok) throw new Error(plan.reason);
    return applyReserveInTx(tx, plan);
  });
}

/** Terminal release of the active-reservation guard (projected / failed). */
async function releaseGuard(db: Firestore, paymentId: string): Promise<void> {
  await requestsCol(db).doc(`active_${paymentId}`).delete().catch(() => undefined);
}

/**
 * Projects one provider-accepted refund onto the payment, job and booking in
 * a single transaction. Idempotent via projectionNeeded. NEVER touches the
 * issued invoice: credit-note/tax treatment is an owner/accountant hold, so
 * the payment carries invoiceReviewNeeded instead of a fabricated void.
 */
async function projectRefund(db: Firestore, request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }): Promise<void> {
  const now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(request.ref);
    const fresh = reqSnap.data() as RefundRequest | undefined;
    // Idempotent + monotonic: only a submitted/accepted request with a pending
    // projection may project; anything else (already projected, failed, or a
    // reopened hold) is left exactly as the newer state wrote it.
    if (!fresh || !fresh.projectionNeeded) return;
    if (fresh.status !== "submitted" && fresh.status !== "accepted") return;
    const paymentRef = db.collection(COLLECTIONS.payments()).doc(fresh.paymentId);
    const paySnap = await tx.get(paymentRef);
    if (!paySnap.exists) throw new Error(`payment ${fresh.paymentId} missing during refund projection`);
    const payment = paySnap.data() as Payment;
    // D6: the request's related-record identity must agree with the payment's
    // own linkage before anything is written - a request pointing at a job or
    // booking the payment does not belong to is a data-integrity stop, not a
    // projection.
    if (payment.tenantId !== fresh.tenantId) throw new Error(`refund projection rejected: request tenant ${fresh.tenantId} != payment tenant ${payment.tenantId}`);
    if (fresh.jobId && payment.jobId !== fresh.jobId) throw new Error(`refund projection rejected: request job ${fresh.jobId} != payment job ${payment.jobId}`);
    if (fresh.bookingId && payment.bookingId !== fresh.bookingId) throw new Error(`refund projection rejected: request booking ${fresh.bookingId} != payment booking ${payment.bookingId}`);
    // Related-record invariant: the actual job/booking documents must exist,
    // belong to the same tenant as the payment, and agree on linkage - all
    // read inside this transaction before any write.
    if (fresh.jobId) {
      const jobSnap = await tx.get(db.collection(COLLECTIONS.jobs()).doc(fresh.jobId));
      if (!jobSnap.exists) throw new Error(`refund projection rejected: job ${fresh.jobId} missing`);
      const job = jobSnap.data() as ServiceJob;
      if (job.tenantId !== payment.tenantId) throw new Error(`refund projection rejected: job ${fresh.jobId} tenant ${job.tenantId} != payment tenant ${payment.tenantId}`);
      if (fresh.bookingId && job.bookingId !== fresh.bookingId) throw new Error(`refund projection rejected: job ${fresh.jobId} booking ${job.bookingId} != request booking ${fresh.bookingId}`);
    }
    if (fresh.bookingId) {
      const bookingSnap = await tx.get(db.collection(COLLECTIONS.bookings()).doc(fresh.bookingId));
      if (!bookingSnap.exists) throw new Error(`refund projection rejected: booking ${fresh.bookingId} missing`);
      const booking = bookingSnap.data() as Booking;
      if (booking.tenantId !== payment.tenantId) throw new Error(`refund projection rejected: booking ${fresh.bookingId} tenant ${booking.tenantId} != payment tenant ${payment.tenantId}`);
    }
    const newRefunded = (payment.refundAmount ?? 0) + fresh.amountPaise;
    const check = verifyRefundAccounting({ capturedPaise: payment.amount, refundedPaise: newRefunded });
    if (!check.ok) throw new Error(`refund projection rejected: ${check.reason}`);
    tx.update(paymentRef, {
      status: check.label,
      refundAmount: newRefunded,
      razorpayRefundId: fresh.providerRefundId ?? payment.razorpayRefundId,
      refundedAt: now,
      ...(payment.invoiceId ? { invoiceReviewNeeded: true } : {}),
      updatedAt: now,
    });
    if (fresh.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(fresh.jobId), {
        paymentStatus: check.label === "refunded" ? "refunded" : "partial",
        updatedAt: now,
      });
    }
    if (fresh.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(fresh.bookingId), {
        paymentStatus: check.label === "refunded" ? "refunded" : "partial",
        refundStatus: "initiated",
        updatedAt: now,
      });
    }
    tx.update(request.ref, { status: "projected", projectionNeeded: false, updatedAt: now });
    tx.delete(db.collection(COLLECTIONS.refundRequests()).doc(`active_${fresh.paymentId}`));
  });
}

/**
 * One runner pass over open requests, optionally scoped to one tenant (D5:
 * an admin may only ever process their own tenant's requests).
 *
 * Submission protocol (D2): a reserved request is claimed TRANSACTIONALLY
 * (reserved -> submitting with a lease token) before any provider call, so
 * two overlapping runners cannot both submit the same request - the loser's
 * claim transaction retries, sees "submitting", and skips. A request left in
 * "submitting" with a stale lease means a crashed runner: recovery reconciles
 * through the bound provider lookup and NEVER blindly resubmits.
 *
 * Projection protocol (D3): a successful provider RESPONSE alone never
 * projects. Money is projected only on provider lifecycle evidence of
 * "processed" - the creation response's own status, or the bound lookup.
 * Anything else (pending/accepted/unknown) stays held and is reconciled on
 * later passes. Crash safety: projectionNeeded survives crashes and projects
 * WITHOUT a second provider call.
 */
const SUBMIT_LEASE_STALE_MS = 10 * 60 * 1000;

export async function runRefundOutbox(
  db: Firestore,
  provider: PaymentProvider,
  opts: { limit?: number; tenantId?: string; runnerId?: string; leaseStaleMs?: number } = {},
): Promise<{ submitted: number; projected: number; failed: number }> {
  const limit = opts.limit ?? 10;
  const leaseStaleMs = opts.leaseStaleMs ?? SUBMIT_LEASE_STALE_MS;
  const tenantId = opts.tenantId ?? null;
  const runnerId = opts.runnerId ?? `runner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const open: Array<RefundRequest & { ref: FirebaseFirestore.DocumentReference }> = [];
  for (const status of ["reserved", "submitting", "submitted", "accepted", "ambiguous"] as const) {
    let q: FirebaseFirestore.Query = requestsCol(db).where("status", "==", status);
    if (tenantId) q = q.where("tenantId", "==", tenantId);
    const snap = await q.get();
    for (const doc of snap.docs) open.push({ ...(doc.data() as RefundRequest), ref: doc.ref });
    if (open.length >= limit) break;
  }
  let submitted = 0, projected = 0, failed = 0;
  // Leases THIS invocation won. A provider submit may only ever follow a claim
  // won in this run - never a stored lease that merely matches our identity
  // (two overlapping invocations from the same admin share runner identity).
  const claimedThisRun = new Set<string>();

  // Monotonic, transactional status transitions (D2/D3 race protection): a
  // write lands only while the request is still in an expected from-state, so
  // a slow or stale pass can never overwrite a newer state (e.g. resurrect a
  // projected request back to ambiguous, or double-project). Returns whether
  // THIS pass performed the transition; callers must not act on a lost race.
  const transitionInTx = async (
    request: RefundRequest & { ref: FirebaseFirestore.DocumentReference },
    from: readonly RefundRequestStatus[],
    patch: Record<string, unknown>,
  ): Promise<boolean> => {
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(request.ref);
      const cur = snap.data() as RefundRequest | undefined;
      if (!cur || !from.includes(cur.status)) return false;
      tx.update(request.ref, patch);
      return true;
    });
  };

  // Bound provider evidence for one request, or null when the stored
  // financial snapshot cannot ground an identity binding.
  const boundLookup = async (request: RefundRequest) => {
    if (!provider.findRefundByReference) return { outcome: "unknown" } as const;
    const paySnap = await db.collection(COLLECTIONS.payments()).doc(request.paymentId).get();
    const payment = paySnap.data() as Payment | undefined;
    if (!payment?.razorpayPaymentId || !payment.currency) return { outcome: "unknown" } as const;
    try {
      return await provider.findRefundByReference(request.id, {
        providerPaymentId: payment.razorpayPaymentId, amountPaise: request.amountPaise, currency: payment.currency,
      });
    } catch {
      return { outcome: "unknown" } as const;
    }
  };
  const holdAmbiguous = async (request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }, note: string, now: string) => {
    const won = await transitionInTx(request, ["submitting", "submitted", "accepted", "ambiguous"],
      { status: "ambiguous", leaseBy: null, leaseAt: null, lastError: note, updatedAt: now });
    if (won) { request.status = "ambiguous"; failed++; }
    return won;
  };
  const markSubmitted = async (request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }, providerRefundId: string, now: string) => {
    const won = await transitionInTx(request, ["submitting", "submitted", "accepted", "ambiguous"],
      { status: "submitted", providerRefundId, projectionNeeded: true, leaseBy: null, leaseAt: null, lastError: null, updatedAt: now });
    if (won) {
      request.status = "submitted";
      request.providerRefundId = providerRefundId;
      request.projectionNeeded = true;
      submitted++;
    }
    return won;
  };
  const holdLifecycle = async (request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }, note: string, now: string) => {
    // Provider accepted the refund but has not reported it processed: hold as
    // submitted WITHOUT projectionNeeded; later passes reconcile via lookup.
    const won = await transitionInTx(request, ["submitting"],
      { status: "submitted", projectionNeeded: false, leaseBy: null, leaseAt: null, lastError: note, updatedAt: now });
    if (won) {
      request.status = "submitted";
      request.projectionNeeded = false;
      submitted++;
    }
    return won;
  };

  for (const request of open.slice(0, limit)) {
    const now = new Date().toISOString();
    if (request.status === "reserved") {
      // D2: claim the submission lease before any provider call.
      const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(request.ref);
        const cur = snap.data() as RefundRequest | undefined;
        if (!cur || cur.status !== "reserved") return false;
        tx.update(request.ref, { status: "submitting", leaseBy: runnerId, leaseAt: now, updatedAt: now });
        return true;
      });
      if (!claimed) continue; // another runner won the lease
      claimedThisRun.add(request.id);
      request.status = "submitting";
      request.leaseBy = runnerId;
      request.leaseAt = now;
    }
    if (request.status === "submitting" && !claimedThisRun.has(request.id)) {
      // Another runner's lease: fresh = in flight, leave it alone. Stale =
      // crashed runner: reconcile from provider evidence, never resubmit.
      const stale = !request.leaseAt || (Date.parse(now) - Date.parse(request.leaseAt)) > leaseStaleMs;
      if (!stale) continue;
      const lookup = await boundLookup(request);
      if (lookup.outcome === "found") {
        await markSubmitted(request, lookup.providerRefundId, now);
      } else if (lookup.outcome === "failed_confirmed") {
        await holdAmbiguous(request, `provider refund ${lookup.providerRefundId} reported failed after a crashed submit; held for manual reconciliation (finality not settled by provider docs)`, now);
        continue;
      } else {
        await holdAmbiguous(request, "submit outcome lost with a crashed runner; provider cannot confirm - held, never resubmitted blindly", now);
        continue;
      }
    }
    if (request.status === "submitting" && claimedThisRun.has(request.id)) {
      const paySnap = await db.collection(COLLECTIONS.payments()).doc(request.paymentId).get();
      const payment = paySnap.data() as Payment | undefined;
      try {
        if (!payment || !payment.razorpayPaymentId) throw new Error("payment has no provider payment id to refund");
        const result = await provider.initiateRefund({
          providerPaymentId: payment.razorpayPaymentId,
          amount: request.amountPaise,
          reason: request.reason,
          referenceId: request.id,
        });
        // D3: a 2xx response alone is not money moved. Project only on
        // lifecycle evidence of "processed" (response status or bound lookup).
        if (result.status === "processed") {
          await markSubmitted(request, result.providerRefundId, now);
        } else {
          const lookup = await boundLookup(request);
          if (lookup.outcome === "found") {
            await markSubmitted(request, lookup.providerRefundId, now);
          } else if (lookup.outcome === "failed_confirmed") {
            await holdAmbiguous(request, `provider refund ${lookup.providerRefundId} reported failed; held for manual reconciliation (finality not settled by provider docs)`, now);
            continue;
          } else {
            await holdLifecycle(request, `provider accepted refund ${result.providerRefundId} with status '${result.status ?? "unknown"}'; awaiting processed evidence`, now);
            continue;
          }
        }
      } catch (err) {
        // The submit outcome is ambiguous: the provider may have accepted and
        // the response was lost. Reconcile against the provider using our
        // durable reference id - NEVER resubmit just because local state is
        // missing.
        const lookup = await boundLookup(request);
        if (lookup.outcome === "found") {
          await markSubmitted(request, lookup.providerRefundId, now);
        } else if (lookup.outcome === "failed_confirmed") {
          await holdAmbiguous(request, `provider refund ${lookup.providerRefundId} reported failed; held for manual reconciliation (finality not settled by provider docs)`, now);
          continue;
        } else if (lookup.outcome === "absent_confirmed") {
          // Authoritative negative under the provider's reconciliation
          // contract: the submit never landed. A real failure; balance releases.
          const won = await transitionInTx(request, ["submitting", "ambiguous"],
            { status: "failed", leaseBy: null, leaseAt: null, lastError: err instanceof Error ? err.message : String(err), updatedAt: now });
          if (won) {
            await releaseGuard(db, request.paymentId);
            failed++;
          }
          continue;
        } else {
          // Inconclusive: hold as ambiguous. Never resubmit, never release.
          await holdAmbiguous(request, err instanceof Error ? err.message : String(err), now);
          continue;
        }
      }
    }
    if ((request.status === "submitted" && !request.projectionNeeded) || request.status === "accepted") {
      // Awaiting lifecycle evidence: reconcile via the bound lookup only.
      const lookup = await boundLookup(request);
      if (lookup.outcome === "found") {
        const won = await transitionInTx(request, ["submitted", "accepted"], { projectionNeeded: true, lastError: null, updatedAt: now });
        if (won) request.projectionNeeded = true;
        else continue;
      } else if (lookup.outcome === "failed_confirmed") {
        await holdAmbiguous(request, `provider refund ${lookup.providerRefundId} reported failed; held for manual reconciliation (finality not settled by provider docs)`, now);
        continue;
      } else {
        continue; // still pending/unknown: keep holding
      }
    }
    if (request.status === "ambiguous") {
      // Reconcile an unresolved hold ONLY from provider evidence, bound to the
      // stored provider payment id + reserved amount/currency.
      const lookup = await boundLookup(request);
      if (lookup.outcome === "found") {
        await markSubmitted(request, lookup.providerRefundId, now);
      } else if (lookup.outcome === "failed_confirmed") {
        // Failure notification, not finality: keep the hold, refresh the evidence.
        await transitionInTx(request, ["ambiguous"],
          { status: "ambiguous", lastError: `provider refund ${lookup.providerRefundId} reported failed; held for manual reconciliation (finality not settled by provider docs)`, updatedAt: now });
        continue;
      } else if (lookup.outcome === "absent_confirmed") {
        const won = await transitionInTx(request, ["submitting", "ambiguous"],
          { status: "failed", lastError: "provider confirms no such refund", updatedAt: now });
        if (won) {
          await releaseGuard(db, request.paymentId);
          failed++;
        }
        continue;
      } else {
        continue; // inconclusive: keep holding
      }
    }
    if (request.projectionNeeded) {
      await projectRefund(db, request);
      projected++;
    }
  }
  return { submitted, projected, failed };
}
