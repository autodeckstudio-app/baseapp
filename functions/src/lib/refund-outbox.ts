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
  | { ok: true; guardRef: FirebaseFirestore.DocumentReference; requestRef: FirebaseFirestore.DocumentReference; guard: Record<string, unknown>; request: RefundRequest; legacyClaimRef: FirebaseFirestore.DocumentReference; legacyClaim: Record<string, unknown> }
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
  i: { payment: Payment; amountPaise: number; reason: string; createdBy: string; expectedBookingId?: string | null; expectedJobId?: string | null },
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
  // Exact context binding: the fresh payment must still belong to the very
  // booking/job the caller is acting on. A payment re-linked to a different
  // same-tenant booking since the caller's snapshot is a STOP, not a hint to
  // refund whoever the payment points at now.
  if (i.expectedBookingId !== undefined && payment.bookingId !== i.expectedBookingId) {
    return { ok: false, code: "invalid", reason: `payment ${payment.id} is no longer linked to booking ${i.expectedBookingId} (now ${payment.bookingId ?? "none"})` };
  }
  if (i.expectedJobId !== undefined && payment.jobId !== i.expectedJobId) {
    return { ok: false, code: "invalid", reason: `payment ${payment.id} is no longer linked to job ${i.expectedJobId} (now ${payment.jobId ?? "none"})` };
  }
  const refundable = refundablePaise(payment);
  if (amount > refundable) {
    return { ok: false, code: "invalid", reason: `refund of ${amount} exceeds the refundable ${refundable} on payment ${i.payment.id}` };
  }
  // Related-record preflight INSIDE the reservation transaction: refuse to
  // open a reservation whose job/booking records are missing, foreign-tenant,
  // or inconsistently linked - broken source records must stop money movement
  // before it starts, not after the provider was called.
  if (payment.jobId) {
    const jobSnap = await tx.get(db.collection(COLLECTIONS.jobs()).doc(payment.jobId));
    if (!jobSnap.exists) return { ok: false, code: "invalid", reason: `payment ${payment.id} job ${payment.jobId} missing` };
    const job = jobSnap.data() as ServiceJob;
    if (job.tenantId !== payment.tenantId) return { ok: false, code: "invalid", reason: `payment ${payment.id} job ${payment.jobId} tenant ${job.tenantId} != payment tenant ${payment.tenantId}` };
    if (payment.bookingId && job.bookingId !== payment.bookingId) return { ok: false, code: "invalid", reason: `payment ${payment.id} job ${payment.jobId} booking ${job.bookingId} != payment booking ${payment.bookingId}` };
  }
  if (payment.bookingId) {
    const bookingSnap = await tx.get(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId));
    if (!bookingSnap.exists) return { ok: false, code: "invalid", reason: `payment ${payment.id} booking ${payment.bookingId} missing` };
    const booking = bookingSnap.data() as Booking;
    if (booking.tenantId !== payment.tenantId) return { ok: false, code: "invalid", reason: `payment ${payment.id} booking ${payment.bookingId} tenant ${booking.tenantId} != payment tenant ${payment.tenantId}` };
  }
  const guardRef = requestsCol(db).doc(`active_${payment.id}`);
  const now = new Date().toISOString();
  // Transactional reads: a losing racer's snapshot conflicts with the
  // winner's guard create, retries, and then sees the guard here.
  // A manual-refund obligation (admin cancel with no provider id) claims refund_<paymentId>: never open a provider refund on top of it.
  const legacyClaimRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payment.id}`);
  const manualClaim = await tx.get(legacyClaimRef);
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
  // Evaluated AFTER the active-reservation check so the more specific live
  // conflict wins. A MARKED tombstone with no active reservation belongs to a
  // TERMINAL request: projectors of ANY vintage can leave one behind (the
  // 8e14e774 webhook/runner copies project and delete the guard but do not
  // know about tombstones), so it must never wedge a later legitimate refund
  // - it is swept below by overwriting it with this reservation's own marker
  // in the same transaction. With no active reservation the payment's own
  // refunded/partially_refunded status is what excludes the legacy producer.
  // An UNMARKED doc is a true legacy manual-refund claim: conflict.
  if (manualClaim.exists) {
    const marker = (manualClaim.data() as { outboxRequestId?: string } | undefined)?.outboxRequestId;
    if (typeof marker !== "string") {
      return { ok: false, code: "conflict", reason: `payment ${payment.id} already has a manual refund obligation` };
    }
    // A missing guard alone is NOT proof of a terminal money state: before
    // sweeping, the marker must be well-formed for THIS payment and the
    // referenced request must exist, belong to this payment and be TERMINAL.
    // Anything else fails closed - inconsistent residue is inspected by hand.
    if (!marker.startsWith(`rr_${payment.id}_`)) {
      return { ok: false, code: "conflict", reason: `refund tombstone for payment ${payment.id} references foreign request ${marker}` };
    }
    const markerReq = await tx.get(requestsCol(db).doc(marker));
    if (!markerReq.exists) {
      return { ok: false, code: "conflict", reason: `refund tombstone for payment ${payment.id} references missing request ${marker}` };
    }
    const mr = markerReq.data() as Pick<RefundRequest, "paymentId" | "status">;
    if (mr.paymentId !== payment.id) {
      return { ok: false, code: "conflict", reason: `refund tombstone for payment ${payment.id} references request for payment ${mr.paymentId}` };
    }
    if (mr.status !== "projected" && mr.status !== "failed") {
      return { ok: false, code: "conflict", reason: `refund request ${marker} is ${mr.status}, not terminal` };
    }
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
  // Cross-vintage interlock: the legacy producer's exclusivity token was this
  // paymentEvents/refund_<paymentId> doc, claimed inside its own transaction.
  // Creating it HERE, in the same transaction as the reservation, makes an
  // in-flight legacy invocation conflict-retry onto this doc and abort with
  // already-exists BEFORE its provider call - and this read above refuses a
  // reservation whenever the legacy claim landed first. The marker lets the
  // legacy-claim reconciler skip outbox-owned tombstones and lets a terminal
  // release delete only our own.
  const legacyClaim = { paymentId: payment.id, outboxRequestId: requestId, claimedBy: "refund-outbox", claimedAt: now, bookingId: payment.bookingId ?? null, amountPaise: amount };
  return { ok: true, guardRef, requestRef: requestsCol(db).doc(requestId), guard: { paymentId: payment.id, requestId, createdAt: now }, request, legacyClaimRef, legacyClaim };
}

/** WRITE phase: only after every read of the transaction is done. */
export function applyReserveInTx(tx: FirebaseFirestore.Transaction, plan: Extract<ReservePlan, { ok: true }>): { requestId: string } {
  tx.create(plan.guardRef, plan.guard);
  tx.create(plan.requestRef, plan.request);
  // set (not create): also sweeps a terminal leftover tombstone from a prior
  // request. Cross-vintage exclusion does not depend on create semantics -
  // the legacy producer's claim transaction READ this doc, so this write
  // alone forces its retry onto the marker.
  tx.set(plan.legacyClaimRef, plan.legacyClaim);
  return { requestId: plan.request.id };
}

export async function reserveRefund(
  db: Firestore,
  i: { payment: Payment; amountPaise: number; reason: string; createdBy: string; expectedBookingId?: string | null; expectedJobId?: string | null },
): Promise<{ requestId: string }> {
  return db.runTransaction(async (tx) => {
    const plan = await planReserveInTx(tx, db, i);
    if (!plan.ok) throw new Error(plan.reason);
    return applyReserveInTx(tx, plan);
  });
}

/** Terminal release of the active-reservation guard + cross-vintage tombstone
 * (failed only). ATOMIC and ownership-checked: both docs are deleted in one
 * transaction ONLY while they still belong to THIS terminal request - a slow
 * cleanup must never remove a newer reservation's guard or tombstone, and a
 * true legacy claim (no marker) is never deleted here. */
async function releaseGuard(db: Firestore, paymentId: string, requestId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const guardRef = requestsCol(db).doc(`active_${paymentId}`);
    const tombRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${paymentId}`);
    const [g, t] = await Promise.all([tx.get(guardRef), tx.get(tombRef)]);
    if (g.exists && (g.data() as { requestId?: string }).requestId === requestId) tx.delete(guardRef);
    if (t.exists && (t.data() as { outboxRequestId?: string }).outboxRequestId === requestId) tx.delete(tombRef);
  }).catch(() => undefined);
}

/**
 * Binds a webhook event's affirmative "processed" evidence to ITS OWN
 * request, transactionally, BEFORE any submission is considered.
 *
 * Why: when the provider already processed the refund while the local
 * request is still reserved/submitting, the truth is that the money moved -
 * the request must ADOPT that provider refund id and project it. Blindly
 * running the reserved->submit flow would create a SECOND provider refund
 * for the same money.
 *
 * STRICT and self-sufficient: the caller's earlier ownership check happened
 * in a DIFFERENT transaction, and the request/payment may have changed
 * since. Adoption therefore re-validates the complete binding against the
 * CURRENT documents - request<->payment identity, tenant, provider payment
 * id, exact integer amount, exact currency - and fails closed with zero
 * writes on anything missing or conflicting. A terminal request still gets
 * the full binding check before its verdict, so a mismatched event can
 * never hide behind an early return.
 */
export async function adoptProcessedRefundEvidence(
  db: Firestore,
  i: {
    requestId: string;
    providerRefundId: string;
    providerPaymentId: string | null;
    amountPaise: number | null;
    currency: string | null;
  },
): Promise<"adopted" | "already_projected" | "already_bound" | "conflict" | "missing"> {
  return db.runTransaction(async (tx) => {
    const ref = requestsCol(db).doc(i.requestId);
    const snap = await tx.get(ref);
    if (!snap.exists) return "missing";
    const cur = snap.data() as RefundRequest;
    const paySnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(cur.paymentId));
    const payment = paySnap.data() as Payment | undefined;
    if (!payment) return "conflict";
    // Complete binding against CURRENT docs - every axis required, none
    // defaulted. Missing evidence never agrees.
    const bound =
      !!i.providerRefundId &&
      !!i.providerPaymentId && !!payment.razorpayPaymentId && i.providerPaymentId === payment.razorpayPaymentId &&
      payment.tenantId === cur.tenantId &&
      cur.jobId === payment.jobId && cur.bookingId === payment.bookingId &&
      typeof i.amountPaise === "number" && Number.isInteger(i.amountPaise) && i.amountPaise > 0 &&
      i.amountPaise === cur.amountPaise &&
      !!i.currency && !!payment.currency && i.currency === payment.currency;
    if (!bound) return "conflict";
    if (cur.status === "projected") {
      return cur.providerRefundId === i.providerRefundId ? "already_projected" : "conflict";
    }
    if (cur.status === "failed") return "conflict";
    if (cur.providerRefundId && cur.providerRefundId !== i.providerRefundId) return "conflict";
    // Already accounted by another path (webhook generic, legacy handler):
    // never re-bind for a second projection of the same money.
    const ledgerSnap = await tx.get(
      db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${cur.paymentId}_${i.providerRefundId}`),
    );
    if (ledgerSnap.exists) return "conflict";
    if (cur.providerRefundId === i.providerRefundId && cur.status === "submitted" && cur.projectionNeeded) {
      return "already_bound";
    }
    tx.update(ref, {
      status: "submitted",
      providerRefundId: i.providerRefundId,
      projectionNeeded: true,
      leaseBy: null,
      leaseAt: null,
      lastError: null,
      updatedAt: new Date().toISOString(),
    });
    return "adopted";
  });
}

/**
 * Projects one provider-accepted refund onto the payment, job and booking in
 * a single transaction. Idempotent via projectionNeeded. NEVER touches the
 * issued invoice: credit-note/tax treatment is an owner/accountant hold, so
 * the payment carries invoiceReviewNeeded instead of a fabricated void.
 */
async function projectRefund(db: Firestore, request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }): Promise<boolean> {
  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(request.ref);
    const fresh = reqSnap.data() as RefundRequest | undefined;
    // Idempotent + monotonic: only a submitted/accepted request with a pending
    // projection may project; anything else (already projected, failed, or a
    // reopened hold) is left exactly as the newer state wrote it.
    if (!fresh || !fresh.projectionNeeded) return false;
    if (fresh.status !== "submitted" && fresh.status !== "accepted") return false;
    // Identity before money: a projection without the bound provider refund id
    // would write a null-identity ledger entry and silently skip the per-refund
    // cross-path dedup below. Hold instead (the caller turns this into a
    // visible ambiguous hold, never a crash).
    if (!fresh.providerRefundId) throw new Error("refund projection rejected: request has no bound provider refund id");
    const paymentRef = db.collection(COLLECTIONS.payments()).doc(fresh.paymentId);
    const paySnap = await tx.get(paymentRef);
    if (!paySnap.exists) throw new Error(`payment ${fresh.paymentId} missing during refund projection`);
    const payment = paySnap.data() as Payment;
    // D6: the request's related-record identity must agree with the payment's
    // own linkage before anything is written - a request pointing at a job or
    // booking the payment does not belong to is a data-integrity stop, not a
    // projection.
    if (payment.tenantId !== fresh.tenantId) throw new Error(`refund projection rejected: request tenant ${fresh.tenantId} != payment tenant ${payment.tenantId}`);
    if (fresh.jobId !== payment.jobId) throw new Error(`refund projection rejected: request job ${fresh.jobId} != payment job ${payment.jobId}`);
    if (fresh.bookingId !== payment.bookingId) throw new Error(`refund projection rejected: request booking ${fresh.bookingId} != payment booking ${payment.bookingId}`);
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
    // Cross-vintage tombstone lifecycle: read BEFORE any write in this
    // transaction. The tombstone exists to exclude the legacy producer while
    // this reservation is ACTIVE; once the projection commits, the payment's
    // own refunded/partially_refunded status blocks the legacy producer, so
    // the tombstone is released with the guard - otherwise it would wedge
    // legitimate later partial refunds of the same payment.
    const tombRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${payment.id}`);
    const tombSnap = await tx.get(tombRef);
    const releaseTombstone = tombSnap.exists
      && (tombSnap.data() as { outboxRequestId?: string }).outboxRequestId === fresh.id;
    const activeGuardRef = db.collection(COLLECTIONS.refundRequests()).doc(`active_${fresh.paymentId}`);
    const activeGuardSnap = await tx.get(activeGuardRef);
    const releaseActiveGuard = activeGuardSnap.exists
      && (activeGuardSnap.data() as { requestId?: string }).requestId === fresh.id;
    // Cross-path per-refund identity: if this provider refund was already
    // accounted by another path (webhook generic, legacy handler), project
    // nothing and hold - the same money must never be counted twice.
    if (fresh.providerRefundId) {
      const ledgerRef = db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${payment.id}_${fresh.providerRefundId}`);
      const ledgerSnap = await tx.get(ledgerRef);
      if (ledgerSnap.exists) {
        const prior = ledgerSnap.data() as { source?: string; requestId?: string };
        // My own prior projection (crash recovery on a non-atomic store, or a
        // replayed projection): idempotent no-op. A FOREIGN entry (webhook
        // generic path, legacy handler, another request) means this provider
        // refund was already accounted elsewhere - hold, never double-count.
        if (prior.source === "outbox" && prior.requestId === fresh.id) return false;
        throw new Error(`refund projection rejected: provider refund ${fresh.providerRefundId} already accounted by ${prior.source ?? "unknown"}`);
      }
    }
    const newRefunded = (payment.refundAmount ?? 0) + fresh.amountPaise;
    const check = verifyRefundAccounting({ capturedPaise: payment.amount, refundedPaise: newRefunded });
    if (!check.ok) throw new Error(`refund projection rejected: ${check.reason}`);
    tx.update(paymentRef, {
      status: check.label,
      refundAmount: newRefunded,
      razorpayRefundId: fresh.providerRefundId ?? payment.razorpayRefundId,
      refundedAt: now,
      // Invoiced payments keep needing invoice review after a refund; a
      // no-invoice flag (e.g. a late capture on a cancelled booking) is
      // resolved BY this refund, so it clears and leaves the review queue.
      invoiceReviewNeeded: payment.invoiceId ? true : false,
      updatedAt: now,
    });
    if (fresh.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(fresh.jobId), {
        paymentStatus: check.label === "refunded" ? "refunded" : "partial",
        updatedAt: now,
      });
    }
    if (fresh.bookingId) {
      // Requested -> processed: projection happens ONLY on exact provider
      // "processed" evidence, so the booking now carries the real refunded
      // amount and the provider refund id - never a planned figure.
      tx.update(db.collection(COLLECTIONS.bookings()).doc(fresh.bookingId), {
        paymentStatus: check.label === "refunded" ? "refunded" : "partial",
        refundStatus: "processed",
        refundedPaise: newRefunded,
        refundId: fresh.providerRefundId ?? null,
        updatedAt: now,
      });
    }
    if (fresh.providerRefundId) {
      tx.set(db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${payment.id}_${fresh.providerRefundId}`), {
        paymentId: payment.id, providerRefundId: fresh.providerRefundId,
        amountPaise: fresh.amountPaise, currency: payment.currency,
        source: "outbox", requestId: fresh.id, createdAt: now,
      });
    }
    tx.update(request.ref, { status: "projected", projectionNeeded: false, updatedAt: now });
    if (releaseActiveGuard) tx.delete(activeGuardRef);
    if (releaseTombstone) tx.delete(tombRef);
    return true;
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
  opts: { limit?: number; tenantId?: string; runnerId?: string; leaseStaleMs?: number; submit?: boolean; requestId?: string } = {},
): Promise<{ submitted: number; projected: number; failed: number }> {
  const limit = opts.limit ?? 10;
  const leaseStaleMs = opts.leaseStaleMs ?? SUBMIT_LEASE_STALE_MS;
  const tenantId = opts.tenantId ?? null;
  // submit:false = reconcile-only pass (event-driven drains): reserved
  // requests are left untouched, so an event for ONE refund can never submit
  // unrelated reservations. Submission ownership lives with the reservation
  // commit's post-transaction drain and the manual runner, both submit:true.
  const allowSubmit = opts.submit !== false;
  const runnerId = opts.runnerId ?? `runner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const open: Array<RefundRequest & { ref: FirebaseFirestore.DocumentReference }> = [];
  if (opts.requestId) {
    // Single-request pass: process exactly the bound request, nothing else.
    const snap = await requestsCol(db).doc(opts.requestId).get();
    if (snap.exists) {
      const r = snap.data() as RefundRequest;
      const active = ["reserved", "submitting", "submitted", "accepted", "ambiguous"] as const;
      if ((active as readonly string[]).includes(r.status) && (!tenantId || r.tenantId === tenantId)) {
        open.push({ ...r, ref: snap.ref });
      }
    }
  } else {
    for (const status of ["reserved", "submitting", "submitted", "accepted", "ambiguous"] as const) {
      let q: FirebaseFirestore.Query = requestsCol(db).where("status", "==", status);
      if (tenantId) q = q.where("tenantId", "==", tenantId);
      const snap = await q.get();
      for (const doc of snap.docs) open.push({ ...(doc.data() as RefundRequest), ref: doc.ref });
      if (open.length >= limit) break;
    }
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
  const holdLifecycle = async (request: RefundRequest & { ref: FirebaseFirestore.DocumentReference }, providerRefundId: string, note: string, now: string) => {
    // Provider accepted the refund but has not reported it processed: hold as
    // submitted WITHOUT projectionNeeded; later passes reconcile via lookup.
    // The bound providerRefundId is persisted NOW: without it a later
    // projection would write a ledger entry with a null identity, defeating
    // the per-refund cross-path dedup.
    const won = await transitionInTx(request, ["submitting"],
      { status: "submitted", providerRefundId, projectionNeeded: false, leaseBy: null, leaseAt: null, lastError: note, updatedAt: now });
    if (won) {
      request.status = "submitted";
      request.projectionNeeded = false;
      submitted++;
    }
    return won;
  };

  for (const request of open.slice(0, limit)) {
    const now = new Date().toISOString();
    if (request.status === "reserved" && !allowSubmit) continue; // reconcile-only pass: never submits
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
      // Pre-effect integrity preflight: records that went bad AFTER
      // reservation (deleted/foreign/re-linked job or booking) hold the
      // request BEFORE the provider is ever called. The in-transaction
      // recheck in projectRefund remains the authority at write time.
      const preflightBad = await (async (): Promise<string | null> => {
        // A malformed request must never reach the provider: the referenceId
        // is the reconciliation anchor, so a missing id would submit an
        // unbindable refund.
        if (typeof request.id !== "string" || !request.id) return "request id missing";
        if (!payment) return `payment ${request.paymentId} missing`;
        if (payment.tenantId !== request.tenantId) return `payment tenant ${payment.tenantId} != request tenant ${request.tenantId}`;
        // Strict nullable linkage equality: the request must point at exactly
        // the payment's own job/booking - a different existing same-tenant
        // pair is tampering, not a refund.
        if (request.jobId !== payment.jobId) return `request job ${request.jobId} != payment job ${payment.jobId}`;
        if (request.bookingId !== payment.bookingId) return `request booking ${request.bookingId} != payment booking ${payment.bookingId}`;
        // Financial state revalidated at submit time, not just reservation:
        // the payment may have been refunded or altered since.
        if (payment.status !== "completed" && (payment.status as string) !== "partially_refunded") {
          return `payment status '${payment.status}' is not refundable`;
        }
        if (refundablePaise(payment) < request.amountPaise) {
          return `refundable ${refundablePaise(payment)} now below reserved ${request.amountPaise}`;
        }
        if (payment.method !== "razorpay_payment_link") return `payment method '${payment.method}' has no provider refund rail`;
        if (!payment.razorpayPaymentId) return "payment has no provider payment id to refund";
        // The identity binding for every later reconciliation needs the stored
        // currency: never submit what we could not reconcile.
        if (!payment.currency) return "payment has no stored currency to bind a reconciliation";
        if (request.jobId) {
          const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(request.jobId).get();
          if (!jobSnap.exists) return `job ${request.jobId} missing`;
          const job = jobSnap.data() as ServiceJob;
          if (job.tenantId !== payment.tenantId) return `job ${request.jobId} tenant ${job.tenantId} != payment tenant ${payment.tenantId}`;
          if (job.bookingId !== request.bookingId) return `job ${request.jobId} booking ${job.bookingId} != request booking ${request.bookingId}`;
        }
        if (request.bookingId) {
          const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(request.bookingId).get();
          if (!bookingSnap.exists) return `booking ${request.bookingId} missing`;
          const booking = bookingSnap.data() as Booking;
          if (booking.tenantId !== payment.tenantId) return `booking ${request.bookingId} tenant ${booking.tenantId} != payment tenant ${payment.tenantId}`;
        }
        return null;
      })();
      if (preflightBad) {
        await holdAmbiguous(request, `integrity preflight failed before any provider call: ${preflightBad}; held for data repair`, now);
        continue;
      }
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
            await holdLifecycle(request, result.providerRefundId, `provider accepted refund ${result.providerRefundId} with status '${result.status ?? "unknown"}'; awaiting processed evidence`, now);
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
            await releaseGuard(db, request.paymentId, request.id);
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
        const won = await transitionInTx(request, ["submitted", "accepted"], { projectionNeeded: true, providerRefundId: lookup.providerRefundId, lastError: null, updatedAt: now });
        if (won) { request.projectionNeeded = true; request.providerRefundId = lookup.providerRefundId; }
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
          await releaseGuard(db, request.paymentId, request.id);
          failed++;
        }
        continue;
      } else {
        continue; // inconclusive: keep holding
      }
    }
    if (request.projectionNeeded) {
      // Counts only a projection this pass actually committed - a lost race
      // against a concurrent pass is a no-op, not a projection.
      try {
        if (await projectRefund(db, request)) projected++;
      } catch (err) {
        // A projection rejection (foreign per-refund ledger entry, broken
        // related records, over-refund arithmetic) is a HOLD, not a crash:
        // one bad request must never wedge the whole pass, and the durable
        // hold keeps the obligation visible for reconciliation.
        await holdAmbiguous(request, `projection held: ${err instanceof Error ? err.message : String(err)}`, now);
      }
    }
  }
  return { submitted, projected, failed };
}
