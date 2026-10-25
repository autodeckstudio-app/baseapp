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
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
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
    const invoiceSnap = payment.invoiceId
      ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId))
      : null;

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
  | "already_accounted"// payment already refunded/accounted by another path; claim marked resolved
  | "held"             // unknown/pending/mismatch: claim retained with a visible note, zero financial writes
  | "skipped";         // no claim, or nothing to reconcile

/** Reconcile ONE retained legacy claim. Read-only at the provider. */
export async function reconcileLegacyRefundClaim(
  db: Firestore,
  provider: PaymentProvider,
  paymentId: string,
  actor: AuthorizedUser,
): Promise<LegacyClaimOutcome> {
  const now = new Date().toISOString();
  const claimRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${paymentId}`);
  const annotate = async (state: string, note: string, extra: Record<string, unknown> = {}) => {
    await claimRef.set({ reconcileState: state, reconcileNote: note, reconcileAt: now, ...extra }, { merge: true }).catch(() => undefined);
  };

  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) return "skipped";
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
  if (!paymentSnap.exists) {
    await annotate("held", `payment ${paymentId} missing; claim retained for data repair`);
    return "held";
  }
  const payment = paymentSnap.data() as Payment;

  // Another path may already have accounted the money (webhook projection,
  // outbox). Verify against the ledger rather than trusting status alone.
  if (payment.status !== "completed" || (payment.refundAmount ?? 0) !== 0) {
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).where("paymentId", "==", paymentId).limit(1).get();
    if (!ledger.empty) {
      await annotate("resolved", `payment already accounted (${payment.status}, refunded ${payment.refundAmount ?? 0}); ledger entry ${ledger.docs[0]!.id}`);
      return "already_accounted";
    }
    await annotate("held", `payment state '${payment.status}' refunded ${payment.refundAmount ?? 0} has no ledger entry; held for reconciliation, zero writes`);
    return "held";
  }

  if (!payment.razorpayPaymentId || !payment.currency || !provider.findRefundByReference) {
    await annotate("held", "cannot bind provider evidence (missing provider payment id or currency); claim retained");
    return "held";
  }
  let lookup: Awaited<ReturnType<NonNullable<PaymentProvider["findRefundByReference"]>>>;
  try {
    lookup = await provider.findRefundByReference(`refund_${paymentId}`, {
      providerPaymentId: payment.razorpayPaymentId, amountPaise: payment.amount, currency: payment.currency,
    });
  } catch {
    await annotate("held", "provider lookup failed; claim retained, will reconcile later");
    return "held";
  }

  if (lookup.outcome === "absent_confirmed") {
    // Authoritative: the provider never accepted this refund. Safe to release.
    await claimRef.delete().catch(() => undefined);
    return "released_absent";
  }
  if (lookup.outcome !== "found" || !lookup.providerRefundId) {
    // unknown or failed notification: not finality. Hold with visibility.
    await annotate("held", `provider outcome '${lookup.outcome}'; claim retained, no refund submitted, no writes`);
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
      { providerRefundId: lookup.providerRefundId });
    return converged ? "converged" : "projected";
  } catch (err) {
    await annotate("held", `projection held: ${err instanceof Error ? err.message : String(err)}`);
    return "held";
  }
}

/** Sweep a tenant's retained legacy claims. Bounded; never submits refunds. */
export async function reconcileLegacyRefundClaims(
  db: Firestore,
  provider: PaymentProvider,
  opts: { tenantId: string; limit?: number; actor: AuthorizedUser },
): Promise<{ projected: number; converged: number; released: number; held: number; alreadyAccounted: number }> {
  const limit = opts.limit ?? 20;
  const counts = { projected: 0, converged: 0, released: 0, held: 0, alreadyAccounted: 0 };
  // Claim docs are paymentEvents/refund_<paymentId>; other event ids never
  // carry that prefix, so a documentId range selects exactly the claims.
  const snap = await db.collection(COLLECTIONS.paymentEvents())
    .where("__name__", ">=", "refund_")
    .where("__name__", "<", "refund`")
    .limit(limit * 3)
    .get();
  let done = 0;
  for (const doc of snap.docs) {
    if (done >= limit) break;
    const paymentId = doc.id.slice("refund_".length);
    if (!paymentId) continue;
    // Only unresolved claims for THIS tenant: a claim whose payment is still
    // completed and unrefunded, or which has no resolution marker yet.
    const state = (doc.data() as { reconcileState?: string }).reconcileState;
    if (state === "resolved") continue;
    const paySnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
    if (!paySnap.exists || (paySnap.data() as Payment).tenantId !== opts.tenantId) continue;
    const outcome = await reconcileLegacyRefundClaim(db, provider, paymentId, opts.actor);
    done++;
    if (outcome === "projected") counts.projected++;
    else if (outcome === "converged") counts.converged++;
    else if (outcome === "released_absent") counts.released++;
    else if (outcome === "already_accounted") counts.alreadyAccounted++;
    else if (outcome === "held") counts.held++;
  }
  return counts;
}
