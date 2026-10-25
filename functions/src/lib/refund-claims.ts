// Legacy refund claims: initiateRefund claims exclusivity with a durable
// paymentEvents/refund_<paymentId> doc BEFORE calling the provider. When the
// provider outcome is unknown the claim is RETAINED (never silently released)
// so no second refund can be submitted - but before this module nothing ever
// reconciled such a retained claim: staff were stranded on "already
// initiated" forever. This module is the RECONCILIATION-ONLY path: it
// verifies provider evidence bound to the claim's deterministic referenceId
// and either projects truthful processed money, releases the claim on
// authoritative absence, or holds with a visible note. It NEVER submits a
// new refund: provider.initiateRefund is not called from anywhere here.
//
// Safety contract (review findings):
//  - Every claim mutation is transactional and bound to the claim's identity
//    token (claimedAt + updateTime captured when the claim was read). A
//    released-then-recreated claim is a NEW claim: stale reconciliation can
//    neither delete it nor annotate it, and a released claim is never
//    recreated by an annotate (no set-merge).
//  - "already accounted" requires a paymentRefunds ledger entry that fully
//    covers THIS claim's binding (exact amount + currency). Partial or
//    conflicting ledger rows HOLD visibly; they never resolve the claim.
//  - Sweeps and lists paginate with a cursor past other tenants' and resolved
//    claims (bounded by maxScan), so a tenant's unresolved rows cannot be
//    starved behind the first page. tenantId backfilled onto claims comes
//    only from the verified payment doc - never guessed.
//  - Projection verifies linked invoice/job/booking docs fresh inside the
//    transaction (tenant + linkage). Mismatch = zero financial writes.
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Payment, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { writeAuditLog } from "../middleware/audit.js";
import type { AuthorizedUser } from "@autodeck/auth";
import type { PaymentProvider } from "./payment-provider.js";

/**
 * The single-shot legacy refund projection, shared by initiateRefund (which
 * submits to the provider first) and the claim reconciler (which never
 * submits; it projects only provider-confirmed processed money). `payment`
 * is the caller's pre-transaction snapshot: any identity drift against the
 * fresh read is a HOLD with zero writes.
 */
export async function projectLegacyRefund(
  db: Firestore,
  i: { paymentId: string; payment: Payment; providerRefundId: string | null; reason: string; user: AuthorizedUser; now: string; claim?: { paymentId: string; claimedAt: string | null; updateTimeSeconds: number | null; updateTimeNanoseconds: number | null; claimToken?: string } },
): Promise<{ converged: boolean }> {
  const { paymentId, payment, providerRefundId, reason, user, now } = i;
  let converged = false;
  await db.runTransaction(async (tx) => {
    // All reads must happen before any writes within a Firestore transaction.
    // The payment is re-read INSIDE this transaction: another path (webhook
    // event, outbox projection) may have accounted money since the snapshot.
    const freshSnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(paymentId));
    if (!freshSnap.exists) throw new HttpsError("not-found", "Payment not found.");
    const fresh = freshSnap.data() as Payment;
    const identityDrift =
      fresh.tenantId !== payment.tenantId ||
      fresh.amount !== payment.amount ||
      fresh.currency !== payment.currency ||
      fresh.razorpayPaymentId !== payment.razorpayPaymentId ||
      fresh.invoiceId !== payment.invoiceId ||
      fresh.jobId !== payment.jobId ||
      fresh.bookingId !== payment.bookingId;
    if (identityDrift) {
      throw new HttpsError(
        "unavailable",
        "Payment identity changed while the refund was in flight; held for reconciliation. The refund claim is retained.",
      );
    }
    // The claim (when the reconciler drives this projection) is reread inside
    // the SAME transaction BEFORE any resolution path and must still be the
    // exact generation that was reconciled: a released/recreated claim or one
    // resolved by a concurrent pass means this pass is stale - hold with zero
    // financial writes. A same-generation "held" note from an earlier pass is
    // still eligible (that is the pending->held->processed retry path).
    const claimRef = i.claim
      ? db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${i.claim.paymentId}`)
      : null;
    const claimSnap = claimRef ? await tx.get(claimRef) : null;
    if (claimRef && i.claim) {
      if (!claimSnap?.exists) throw new HttpsError("unavailable", "Refund claim was released while reconciling; held with zero financial writes.");
      const cur = claimSnap.data() as { claimedAt?: string; reconcileState?: string };
      const generationDrift =
        (cur.claimedAt ?? null) !== i.claim.claimedAt ||
        cur.reconcileState === "resolved" ||
        // An invocation that wrote a nonce INTO its claim transaction never
        // adopts a same-clock recreation: the nonce must match too.
        (i.claim.claimToken !== undefined &&
          (cur as { claimToken?: string }).claimToken !== i.claim.claimToken) ||
        (i.claim.updateTimeSeconds != null &&
          (!claimSnap.updateTime ||
            claimSnap.updateTime.seconds !== i.claim.updateTimeSeconds ||
            claimSnap.updateTime.nanoseconds !== i.claim.updateTimeNanoseconds));
      if (generationDrift) {
        throw new HttpsError("unavailable", "Refund claim changed while reconciling; held with zero financial writes.");
      }
    }
    if (providerRefundId) {
      const ledgerSnap = await tx.get(
        db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${paymentId}_${providerRefundId}`),
      );
      if (ledgerSnap.exists) {
        const prior = ledgerSnap.data() as { paymentId?: string; amountPaise?: number; currency?: string | null };
        if (prior.paymentId !== paymentId || prior.amountPaise !== payment.amount ||
            (prior.currency ?? null) !== (payment.currency ?? null)) {
          throw new HttpsError(
            "unavailable",
            `Existing accounting for provider refund ${providerRefundId} conflicts with this payment; held for reconciliation. The refund claim is retained.`,
          );
        }
        converged = true;
        return;
      }
    }
    if (fresh.status !== "completed" || (fresh.refundAmount ?? 0) !== 0) {
      throw new HttpsError(
        "unavailable",
        `Payment state changed while the refund was in flight (status '${fresh.status}', refunded ${fresh.refundAmount ?? 0}); held for reconciliation. The refund claim is retained.`,
      );
    }
    // Linked docs are read fresh INSIDE the transaction and verified before
    // any write: a linked doc from another tenant, an invoice linked to a
    // different booking, or a dangling job/booking reference means the
    // snapshot cannot be trusted - hold with ZERO financial writes.
    const invoiceSnap = payment.invoiceId
      ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId))
      : null;
    const jobSnap = payment.jobId
      ? await tx.get(db.collection(COLLECTIONS.jobs()).doc(payment.jobId))
      : null;
    const bookingSnap = payment.bookingId
      ? await tx.get(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId))
      : null;
    const linkErr = (what: string) => new HttpsError(
      "unavailable",
      `Linked ${what} failed tenant/linkage verification; held for reconciliation with zero financial writes. The refund claim is retained.`,
    );
    if (payment.invoiceId) {
      if (!invoiceSnap?.exists) throw linkErr(`invoice ${payment.invoiceId} (missing)`);
      const inv = invoiceSnap.data() as Invoice;
      if (inv.tenantId !== payment.tenantId) throw linkErr(`invoice ${payment.invoiceId}`);
      if (payment.jobId && inv.jobId !== payment.jobId) throw linkErr(`invoice ${payment.invoiceId}`);
      if (payment.bookingId && inv.bookingId !== payment.bookingId) throw linkErr(`invoice ${payment.invoiceId}`);
      if (inv.paymentId && inv.paymentId !== paymentId) throw linkErr(`invoice ${payment.invoiceId}`);
    }
    if (payment.jobId) {
      if (!jobSnap?.exists) throw linkErr(`job ${payment.jobId} (missing)`);
      const job = jobSnap.data() as { tenantId?: string; bookingId?: string | null };
      if (job.tenantId !== payment.tenantId) throw linkErr(`job ${payment.jobId}`);
      if (payment.bookingId && job.bookingId !== payment.bookingId) throw linkErr(`job ${payment.jobId}`);
    }
    if (payment.bookingId) {
      if (!bookingSnap?.exists) throw linkErr(`booking ${payment.bookingId} (missing)`);
      if ((bookingSnap.data() as { tenantId?: string }).tenantId !== payment.tenantId) throw linkErr(`booking ${payment.bookingId}`);
    }

    tx.update(db.collection(COLLECTIONS.payments()).doc(paymentId), {
      status: "refunded",
      razorpayRefundId: providerRefundId,
      refundAmount: fresh.amount,
      refundedAt: now,
      updatedAt: now,
    });
    if (providerRefundId) {
      tx.set(db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${paymentId}_${providerRefundId}`), {
        paymentId, providerRefundId,
        amountPaise: fresh.amount, currency: fresh.currency ?? null,
        source: "legacy", createdAt: now,
      });
    }
    if (payment.invoiceId && invoiceSnap?.exists) {
      const invoice = invoiceSnap.data() as Invoice;
      if (invoice.status !== "void") {
        tx.update(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId), {
          status: "void",
          voidedAt: now,
          voidedReason: `Refund initiated: ${reason}`,
          updatedAt: now,
        });
        writeAuditLog(tx, {
          action: "invoice.voided",
          entityType: "Invoice",
          entityId: payment.invoiceId,
          user,
          studioId: payment.studioId,
          after: { status: "void", reason },
        });
      }
    }
    if (payment.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(payment.jobId), { paymentStatus: "refunded", updatedAt: now });
    }
    if (payment.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId), { paymentStatus: "refunded", updatedAt: now });
    }
    writeAuditLog(tx, {
      action: "payment.refunded",
      entityType: "Payment",
      entityId: paymentId,
      user,
      studioId: payment.studioId,
      after: { status: "refunded", reason, refundAmount: payment.amount, providerRefundId },
    });
  });
  return { converged };
}

export type LegacyClaimOutcome =
  | "projected"        // provider evidence: processed; money accounted, claim marked resolved
  | "converged"        // the same provider refund was already accounted; no double count
  | "released_absent"  // authoritative provider absence: claim released, retry possible
  | "already_accounted"// full-coverage ledger entry verified against the claim binding; claim marked resolved
  | "held"             // unknown/pending/mismatch/race: claim retained with a visible note, zero financial writes
  | "skipped";         // no claim, or nothing to reconcile

/** Identity token binding one reconciliation pass to the exact claim
 * generation it read: claimedAt plus the claim doc's FULL-PRECISION
 * updateTime (seconds+nanos, never millis). A released-then-recreated claim
 * has a new updateTime even when claimedAt repeats, so stale work can
 * neither delete nor annotate it. */
type ClaimToken = { claimedAt: string | null; updateTime: import("firebase-admin/firestore").Timestamp | null };

function tokenMatches(snap: import("firebase-admin/firestore").DocumentSnapshot, token: ClaimToken): boolean {
  if (!snap.exists) return false;
  const cur = snap.data() as { claimedAt?: string };
  if ((cur.claimedAt ?? null) !== token.claimedAt) return false;
  if (token.updateTime) {
    if (!snap.updateTime) return false;
    if (snap.updateTime.seconds !== token.updateTime.seconds || snap.updateTime.nanoseconds !== token.updateTime.nanoseconds) return false;
  }
  return true;
}

/** Reconcile ONE retained legacy claim. Read-only at the provider. */
export async function reconcileLegacyRefundClaim(
  db: Firestore,
  provider: PaymentProvider,
  paymentId: string,
  actor: AuthorizedUser,
): Promise<LegacyClaimOutcome> {
  const now = new Date().toISOString();
  const claimRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${paymentId}`);
  const paymentRef = db.collection(COLLECTIONS.payments()).doc(paymentId);

  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) return "skipped";
  // Outbox-owned tombstone: managed by the refund-outbox lifecycle, not a
  // legacy claim - never reconcile it here.
  if (typeof (claimSnap.data() as { outboxRequestId?: string }).outboxRequestId === "string") return "skipped";
  const token: ClaimToken = {
    claimedAt: (claimSnap.data() as { claimedAt?: string }).claimedAt ?? null,
    updateTime: claimSnap.updateTime ?? null,
  };

  // Transactional token-bound annotate: updates the claim only if it still
  // exists and is still the SAME generation this pass reconciled. Never
  // recreates a released claim (no set-merge), never overwrites a newer one.
  const annotate = async (state: string, note: string, extra: Record<string, unknown> = {}) => {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef);
      if (!tokenMatches(snap, token)) return;
      tx.update(claimRef, { reconcileState: state, reconcileNote: note, reconcileAt: now, ...extra });
    }).catch(() => undefined);
  };

  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    await annotate("held", `payment ${paymentId} missing; claim retained for data repair`);
    return "held";
  }
  const payment = paymentSnap.data() as Payment;
  // tenantId is backfilled onto the claim only from this verified payment
  // doc (never guessed), so future sweeps can tenant-scope without the read.
  const tenantExtra = typeof payment.tenantId === "string" ? { tenantId: payment.tenantId } : {};

  const ledgerRefFor = (providerRefundId: string) =>
    db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${paymentId}_${providerRefundId}`);

  // Transactional, token-bound resolution for the already-accounted paths:
  // rereads the claim (exact generation), the payment (fresh binding), and
  // the exact ledger entry (identity + full coverage) inside ONE transaction
  // before marking resolved. Any drift -> no write, held.
  const finalizeResolved = async (ledgerId: string, expected: { amountPaise: number; currency: string | null; providerRefundId: string }, note: string) => {
    let ok = false;
    await db.runTransaction(async (tx) => {
      const [cSnap, pSnap, lSnap] = await Promise.all([tx.get(claimRef), tx.get(paymentRef), tx.get(db.collection(COLLECTIONS.paymentRefunds()).doc(ledgerId))]);
      if (!tokenMatches(cSnap, token)) return;
      if (!pSnap.exists || !lSnap.exists) return;
      const pf = pSnap.data() as Payment;
      if (pf.tenantId !== payment.tenantId || pf.amount !== payment.amount || pf.currency !== payment.currency ||
          pf.razorpayPaymentId !== payment.razorpayPaymentId || pf.status !== payment.status ||
          (pf.refundAmount ?? 0) !== (payment.refundAmount ?? 0) || pf.razorpayRefundId !== payment.razorpayRefundId) return;
      const lf = lSnap.data() as { paymentId?: string; amountPaise?: number; currency?: string | null; providerRefundId?: string };
      if (lf.paymentId !== paymentId || lf.providerRefundId !== expected.providerRefundId ||
          lf.amountPaise !== expected.amountPaise || (lf.currency ?? null) !== expected.currency) return;
      tx.update(claimRef, {
        reconcileState: "resolved", reconcileNote: note, reconcileAt: now,
        providerRefundId: expected.providerRefundId, ...tenantExtra,
      });
      ok = true;
    }).catch(() => undefined);
    return ok;
  };

  // Another path may already have accounted the money (webhook projection,
  // outbox). Full coverage alone does NOT establish THIS claim's outcome:
  // resolution requires exact identity evidence - either the payment's own
  // recorded provider refund id with its exact ledger entry, or provider
  // confirmation for THIS claim's deterministic referenceId plus its exact
  // ledger entry. Partial or conflicting rows always HOLD visibly.
  if (payment.status !== "completed" || (payment.refundAmount ?? 0) !== 0) {
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).where("paymentId", "==", paymentId).limit(10).get();
    const rows = ledger.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { amountPaise?: number; currency?: string | null; providerRefundId?: string }),
    }));
    const conflict = rows.find((r) => typeof r.amountPaise !== "number" || (r.currency ?? null) !== (payment.currency ?? null));
    if (conflict) {
      await annotate("held", `ledger entry ${conflict.id} conflicts with this claim's binding (amount/currency); held for reconciliation, zero writes`, tenantExtra);
      return "held";
    }
    // (a) Exact projection identity: the payment's recorded provider refund id
    // and its own ledger entry with full coverage.
    if (payment.razorpayRefundId) {
      const own = rows.find((r) => r.id === `pr_${paymentId}_${payment.razorpayRefundId}` && r.amountPaise === payment.amount
        && (r as { source?: string }).source === "legacy");
      if (own) {
        const ok = await finalizeResolved(own.id, { amountPaise: payment.amount, currency: payment.currency ?? null, providerRefundId: payment.razorpayRefundId },
          `verified provider refund ${payment.razorpayRefundId} fully accounted (ledger ${own.id}); matches this claim's exact identity, amount and currency`);
        if (ok) return "already_accounted";
        await annotate("held", "accounting drifted while resolving; held, zero writes", tenantExtra);
        return "held";
      }
    }
    // (b) Provider-side confirmation bound to THIS claim's referenceId.
    if (payment.razorpayPaymentId && payment.currency && provider.findRefundByReference) {
      let lookup: Awaited<ReturnType<NonNullable<PaymentProvider["findRefundByReference"]>>>;
      try {
        lookup = await provider.findRefundByReference(`refund_${paymentId}`, {
          providerPaymentId: payment.razorpayPaymentId, amountPaise: payment.amount, currency: payment.currency,
        });
      } catch {
        await annotate("held", "provider lookup failed while verifying accounting; claim retained", tenantExtra);
        return "held";
      }
      if (lookup.outcome === "found" && lookup.providerRefundId) {
        const own = rows.find((r) => r.id === `pr_${paymentId}_${lookup.providerRefundId}` && r.amountPaise === payment.amount);
        if (own) {
          const ok = await finalizeResolved(own.id, { amountPaise: payment.amount, currency: payment.currency ?? null, providerRefundId: lookup.providerRefundId },
            `provider confirmed refund ${lookup.providerRefundId} processed for this claim's reference; fully accounted (ledger ${own.id})`);
          if (ok) return "already_accounted";
          await annotate("held", "accounting drifted while resolving; held, zero writes", tenantExtra);
          return "held";
        }
        await annotate("held", `provider confirms refund ${lookup.providerRefundId} processed for this claim's reference but no full ledger entry exists; held for projection review, zero writes`, tenantExtra);
        return "held";
      }
      if (lookup.outcome === "absent_confirmed" && payment.status === "refunded" && (payment.refundAmount ?? 0) === payment.amount) {
        const full = rows.find((r) => r.amountPaise === payment.amount && typeof r.providerRefundId === "string");
        if (full) {
          const ok = await finalizeResolved(full.id, { amountPaise: payment.amount, currency: payment.currency ?? null, providerRefundId: full.providerRefundId! },
            `provider confirms this claim's refund was never accepted; payment already fully refunded by ledger ${full.id} (providerRefundId ${full.providerRefundId}); claim outcome superseded, money accounted exactly once`);
          if (ok) return "already_accounted";
          await annotate("held", "accounting drifted while resolving; held, zero writes", tenantExtra);
          return "held";
        }
      }
      if (rows.length > 0) {
        await annotate("held", `only partial/unbound ledger entries (${rows.map((r) => `${r.id}:${r.amountPaise ?? "?"}`).join(", ")}) and no provider confirmation for this claim's reference; held, zero writes`, tenantExtra);
        return "held";
      }
      await annotate("held", `payment state '${payment.status}' refunded ${payment.refundAmount ?? 0} with no ledger entry and provider outcome '${lookup.outcome}'; held for reconciliation, zero writes`, tenantExtra);
      return "held";
    }
    await annotate("held", `payment state '${payment.status}' refunded ${payment.refundAmount ?? 0} cannot be verified (missing provider binding); held, zero writes`, tenantExtra);
    return "held";
  }

  if (!payment.razorpayPaymentId || !payment.currency || !provider.findRefundByReference) {
    await annotate("held", "cannot bind provider evidence (missing provider payment id or currency); claim retained", tenantExtra);
    return "held";
  }
  let lookup: Awaited<ReturnType<NonNullable<PaymentProvider["findRefundByReference"]>>>;
  try {
    lookup = await provider.findRefundByReference(`refund_${paymentId}`, {
      providerPaymentId: payment.razorpayPaymentId, amountPaise: payment.amount, currency: payment.currency,
    });
  } catch {
    await annotate("held", "provider lookup failed; claim retained, will reconcile later", tenantExtra);
    return "held";
  }

  if (lookup.outcome === "absent_confirmed") {
    // Authoritative: the provider never accepted this refund. Release is ONE
    // transaction that rereads BOTH the claim (exact generation, full-precision
    // updateTime, unresolved) AND the payment (fresh binding identical to what
    // the provider lookup was bound to). Any drift -> no delete.
    let released = false;
    await db.runTransaction(async (tx) => {
      const [cSnap, pSnap] = await Promise.all([tx.get(claimRef), tx.get(paymentRef)]);
      if (!tokenMatches(cSnap, token)) return;
      const cur = cSnap.data() as { reconcileState?: string };
      if (cur.reconcileState === "resolved") return;
      if (!pSnap.exists) return;
      const pf = pSnap.data() as Payment;
      if (pf.tenantId !== payment.tenantId || pf.amount !== payment.amount || pf.currency !== payment.currency ||
          pf.razorpayPaymentId !== payment.razorpayPaymentId || pf.status !== payment.status) return;
      tx.delete(claimRef);
      released = true;
    }).catch(() => undefined);
    if (!released) {
      // The claim or payment changed while we were reconciling; leave the
      // claim untouched and visible for the next pass. annotate is a no-op if
      // a newer claim generation now lives here.
      await annotate("held", "release raced with a newer claim or payment state; claim retained, will reconcile later", tenantExtra);
      return "held";
    }
    return "released_absent";
  }
  if (lookup.outcome !== "found" || !lookup.providerRefundId) {
    // unknown or failed notification: not finality. Hold with visibility.
    await annotate("held", `provider outcome '${lookup.outcome}'; claim retained, no refund submitted, no writes`, tenantExtra);
    return "held";
  }
  // Processed money confirmed by the provider, bound by payment id + amount +
  // currency + the claim's deterministic referenceId. Project it truthfully;
  // the projection transaction rereads the claim generation itself.
  try {
    const { converged } = await projectLegacyRefund(db, {
      paymentId, payment, providerRefundId: lookup.providerRefundId,
      reason: "reconciled from retained refund claim", user: actor, now,
      claim: { paymentId, claimedAt: token.claimedAt, updateTimeSeconds: token.updateTime ? token.updateTime.seconds : null, updateTimeNanoseconds: token.updateTime ? token.updateTime.nanoseconds : null },
    });
    await annotate("resolved", converged
      ? `provider refund ${lookup.providerRefundId} already accounted; converged without double counting`
      : `provider refund ${lookup.providerRefundId} confirmed processed and projected`,
      { providerRefundId: lookup.providerRefundId, ...tenantExtra });
    return converged ? "converged" : "projected";
  } catch (err) {
    await annotate("held", `projection held: ${err instanceof Error ? err.message : String(err)}`, tenantExtra);
    return "held";
  }
}

/** Sweep a tenant's retained legacy claims. Bounded per pass; never submits
 * refunds. Progress is PERSISTED (paymentEvents/reconcileSweep_<tenantId>)
 * so unresolved rows beyond one pass's scan bound are reached by the next
 * pass instead of starving forever. A completed cycle clears the cursor so
 * later passes rescan from the start for newly retained claims. */
export async function reconcileLegacyRefundClaims(
  db: Firestore,
  provider: PaymentProvider,
  opts: { tenantId: string; limit?: number; maxScan?: number; actor: AuthorizedUser },
): Promise<{ projected: number; converged: number; released: number; held: number; alreadyAccounted: number; scanned: number; exhausted: boolean }> {
  const limit = opts.limit ?? 20;
  const maxScan = opts.maxScan ?? 500;
  const counts = { projected: 0, converged: 0, released: 0, held: 0, alreadyAccounted: 0, scanned: 0, exhausted: false };
  const stateRef = db.collection(COLLECTIONS.paymentEvents()).doc(`reconcileSweep_${opts.tenantId}`);
  const state = (await stateRef.get()).data() as { lastId?: string } | undefined;
  const startedAfter: string | null = typeof state?.lastId === "string" ? state.lastId : null;
  let afterId: string | null = startedAfter;

  // Claim docs are paymentEvents/refund_<paymentId>; other event ids never
  // carry that prefix, so a documentId range selects exactly the claims.
  let scanned = 0;
  let done = 0;
  let lastSeen: string | null = null;
  let visited: string | null = null;
  let hitEnd = false;
  while (done < limit && scanned < maxScan && !hitEnd) {
    let q = db.collection(COLLECTIONS.paymentEvents())
      .where("__name__", ">=", "refund_")
      .where("__name__", "<", "refund`")
      .orderBy("__name__");
    if (afterId) q = q.where("__name__", ">", afterId);
    const snap = await q.limit(100).get();
    if (snap.empty) { hitEnd = true; break; }
    scanned += snap.size;
    lastSeen = snap.docs[snap.size - 1]!.id;
    afterId = lastSeen;
    let brokeOnLimit = false;
    for (const doc of snap.docs) {
      if (done >= limit) { brokeOnLimit = true; break; }
      visited = doc.id;
      const paymentId = doc.id.slice("refund_".length);
      if (!paymentId) continue;
      const data = doc.data() as { reconcileState?: string; tenantId?: string; outboxRequestId?: string };
      // Outbox-owned tombstones (created by planReserveInTx as the
      // cross-vintage interlock) are managed by the refund-outbox lifecycle:
      // their provider evidence is keyed by the outbox request id, not the
      // legacy refund_<paymentId> reference, so this sweep must never verify,
      // release, or annotate them.
      if (typeof data.outboxRequestId === "string") continue;
      if (data.reconcileState === "resolved") continue;
      if (typeof data.tenantId === "string" && data.tenantId !== opts.tenantId) continue;
      if (typeof data.tenantId !== "string") {
        const paySnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
        if (!paySnap.exists || (paySnap.data() as Payment).tenantId !== opts.tenantId) continue;
      }
      const outcome = await reconcileLegacyRefundClaim(db, provider, paymentId, opts.actor);
      done++;
      if (outcome === "projected") counts.projected++;
      else if (outcome === "converged") counts.converged++;
      else if (outcome === "released_absent") counts.released++;
      else if (outcome === "already_accounted") counts.alreadyAccounted++;
      else if (outcome === "held") counts.held++;
    }
    if (!brokeOnLimit && snap.size < 100) hitEnd = true;
  }
  counts.scanned = scanned;
  counts.exhausted = hitEnd && done < limit;
  if (counts.exhausted) {
    await stateRef.delete().catch(() => undefined);
  } else {
    // Persist the last doc actually VISITED (not the page tail): when the
    // reconciliation limit breaks mid-page, the rest of the page is still
    // scanned by the next pass instead of being skipped forever.
    const progress = visited ?? lastSeen;
    if (progress && progress !== startedAfter) {
      await stateRef.set({ lastId: progress, updatedAt: new Date().toISOString(), tenantId: opts.tenantId }).catch(() => undefined);
    }
  }
  return counts;
}
