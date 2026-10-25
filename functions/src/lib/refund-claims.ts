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
  i: { paymentId: string; payment: Payment; providerRefundId: string | null; reason: string; user: AuthorizedUser; now: string },
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
    if (payment.invoiceId && invoiceSnap?.exists) {
      const inv = invoiceSnap.data() as Invoice;
      if (inv.tenantId !== payment.tenantId) throw linkErr(`invoice ${payment.invoiceId}`);
      if (payment.bookingId && inv.bookingId && inv.bookingId !== payment.bookingId) {
        throw linkErr(`invoice ${payment.invoiceId}`);
      }
    }
    if (payment.jobId) {
      if (!jobSnap?.exists) throw linkErr(`job ${payment.jobId} (missing)`);
      if ((jobSnap.data() as { tenantId?: string }).tenantId !== payment.tenantId) throw linkErr(`job ${payment.jobId}`);
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
 * generation it read. A released-then-recreated claim has a new claimedAt
 * and updateTime, so stale work can neither delete nor annotate it. */
type ClaimToken = { claimedAt: string | null; updateTimeMs: number | null };

/** Reconcile ONE retained legacy claim. Read-only at the provider. */
export async function reconcileLegacyRefundClaim(
  db: Firestore,
  provider: PaymentProvider,
  paymentId: string,
  actor: AuthorizedUser,
): Promise<LegacyClaimOutcome> {
  const now = new Date().toISOString();
  const claimRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${paymentId}`);

  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) return "skipped";
  const token: ClaimToken = {
    claimedAt: (claimSnap.data() as { claimedAt?: string }).claimedAt ?? null,
    updateTimeMs: claimSnap.updateTime ? claimSnap.updateTime.toMillis() : null,
  };

  // Transactional token-bound annotate: updates the claim only if it still
  // exists and is still the SAME generation this pass reconciled. Never
  // recreates a released claim (no set-merge), never overwrites a newer one.
  const annotate = async (state: string, note: string, extra: Record<string, unknown> = {}) => {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef);
      if (!snap.exists) return;
      const cur = snap.data() as { claimedAt?: string };
      if ((cur.claimedAt ?? null) !== token.claimedAt) return;
      if (token.updateTimeMs != null && snap.updateTime && snap.updateTime.toMillis() !== token.updateTimeMs) return;
      tx.update(claimRef, { reconcileState: state, reconcileNote: note, reconcileAt: now, ...extra });
    }).catch(() => undefined);
  };

  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
  if (!paymentSnap.exists) {
    await annotate("held", `payment ${paymentId} missing; claim retained for data repair`);
    return "held";
  }
  const payment = paymentSnap.data() as Payment;
  // tenantId is backfilled onto the claim only from this verified payment
  // doc (never guessed), so future sweeps can tenant-scope without the read.
  const tenantExtra = typeof payment.tenantId === "string" ? { tenantId: payment.tenantId } : {};

  // Another path may already have accounted the money (webhook projection,
  // outbox). Only a ledger entry that FULLY covers this claim's binding
  // (exact amount + currency for this payment) establishes the outcome; a
  // partial refund for something else does not, and a conflicting row is a
  // data problem - both HOLD visibly instead of resolving.
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
    const full = rows.find((r) => r.amountPaise === payment.amount);
    if (full) {
      await annotate("resolved", `full refund verified in ledger entry ${full.id} (providerRefundId ${full.providerRefundId ?? "n/a"}, ${full.amountPaise} ${payment.currency ?? ""}); matches the claim binding`,
        { providerRefundId: full.providerRefundId ?? null, ...tenantExtra });
      return "already_accounted";
    }
    if (rows.length > 0) {
      await annotate("held", `only partial/other ledger entries (${rows.map((r) => `${r.id}:${r.amountPaise}`).join(", ")}); they do not establish this full claim's outcome; held, zero writes`, tenantExtra);
      return "held";
    }
    await annotate("held", `payment state '${payment.status}' refunded ${payment.refundAmount ?? 0} has no ledger entry; held for reconciliation, zero writes`, tenantExtra);
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
    // Authoritative: the provider never accepted this refund. Release is
    // transactional and token-bound: reread inside the transaction and delete
    // only if the SAME claim generation is still there and another path has
    // not already resolved it. A released-then-recreated claim is a NEW
    // refund in flight and is never deleted here.
    let released = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef);
      if (!snap.exists) return;
      const cur = snap.data() as { claimedAt?: string; reconcileState?: string };
      if ((cur.claimedAt ?? null) !== token.claimedAt) return;
      if (cur.reconcileState === "resolved") return;
      tx.delete(claimRef);
      released = true;
    }).catch(() => undefined);
    if (!released) {
      // The claim changed while we were reconciling; leave it untouched and
      // visible for the next pass. annotate is a no-op if it is a new claim.
      await annotate("held", "release raced with a newer claim state; claim retained, will reconcile later", tenantExtra);
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
  // currency + the claim's deterministic referenceId. Project it truthfully.
  try {
    const { converged } = await projectLegacyRefund(db, {
      paymentId, payment, providerRefundId: lookup.providerRefundId,
      reason: "reconciled from retained refund claim", user: actor, now,
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

/** Sweep a tenant's retained legacy claims. Bounded; never submits refunds.
 * Paginates with a cursor so other tenants' claims (or already-resolved
 * ones) ahead in id order cannot starve this tenant's unresolved rows. */
export async function reconcileLegacyRefundClaims(
  db: Firestore,
  provider: PaymentProvider,
  opts: { tenantId: string; limit?: number; maxScan?: number; actor: AuthorizedUser },
): Promise<{ projected: number; converged: number; released: number; held: number; alreadyAccounted: number }> {
  const limit = opts.limit ?? 20;
  const maxScan = opts.maxScan ?? 500;
  const counts = { projected: 0, converged: 0, released: 0, held: 0, alreadyAccounted: 0 };
  // Claim docs are paymentEvents/refund_<paymentId>; other event ids never
  // carry that prefix, so a documentId range selects exactly the claims.
  let cursor: QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let done = 0;
  while (done < limit && scanned < maxScan) {
    let q = db.collection(COLLECTIONS.paymentEvents())
      .where("__name__", ">=", "refund_")
      .where("__name__", "<", "refund`")
      .orderBy("__name__")
      .limit(100);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    scanned += snap.size;
    cursor = snap.docs[snap.size - 1]!;
    for (const doc of snap.docs) {
      if (done >= limit) break;
      const paymentId = doc.id.slice("refund_".length);
      if (!paymentId) continue;
      // Only unresolved claims for THIS tenant. A backfilled tenantId lets us
      // skip foreign claims without a payment read; without it we verify via
      // the payment doc (and the reconcile pass backfills it).
      const data = doc.data() as { reconcileState?: string; tenantId?: string };
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
    if (snap.size < 100) break;
  }
  return counts;
}
