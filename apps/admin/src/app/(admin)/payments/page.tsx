"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Payment, PaymentStatus, Customer, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToPayments, refundPayment } from "../../../lib/payments-service";
import { useLabels } from "../../../lib/use-labels";
import { studioToday } from "../../../lib/format";
import { PaymentsView, RefundWorkPanel } from "../../../experience/OfficeViews";
import { listRefundWork, runRefundOutbox, reconcileRefundClaims, refundActionsEnabled } from "../../../lib/refund-work-service";
import { runRefundAction } from "../../../lib/refund-work-actions";
import { createRefundWorkCycle, type RefundWorkCycle } from "../../../lib/refund-work-cycle";

function PaymentsPageContent() {
  const { claims, user } = useAdminAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearch(q);
  }, [searchParams]);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Identity-scoped review cycle (login, tenant switch AND logout all reset
  // it): a delayed response from a previous identity can never repopulate
  // the new identity's rows, surface its error, or move its spinner, and a
  // fresh identity never sends the previous cycle's known claim ids.
  const cycleRef = useRef<RefundWorkCycle | null>(null);
  if (cycleRef.current === null) cycleRef.current = createRefundWorkCycle(listRefundWork);
  const cycle = cycleRef.current;
  const [, setCycleTick] = useState(0);
  useEffect(() => cycle.subscribe(() => setCycleTick((t) => t + 1)), [cycle]);
  const { accum: legacyAccum, work: refundWork, loading: refundWorkLoading, error: refundWorkError } = cycle.getState();
  const [runningOutbox, setRunningOutbox] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    // Identity change resets the cycle AND the action surface: a stale
    // action's callbacks are generation-guarded no-ops, so without this
    // reset the new identity would inherit a stuck Running/Reconciling
    // spinner and the previous identity's result message.
    setRunningOutbox(false);
    setReconciling(false);
    setMessage(null);
    cycle.reset(!!claims);
  }, [claims?.tenantId, user?.uid, cycle]);

  function handleReconcileClaims() {
    void runRefundAction(
      cycle,
      reconcileRefundClaims,
      (r) => `Claim reconciliation: ${r.projected + r.converged + r.alreadyAccounted} accounted (${r.alreadyAccounted} already recorded), ${r.released} released, ${r.held} held for review${r.exhausted ? "" : " (more records to scan - continue the scan)"}.`,
      "Claim reconciliation failed.",
      { setBusy: setReconciling, setMessage },
    );
  }

  function handleRunOutbox() {
    void runRefundAction(
      cycle,
      runRefundOutbox,
      (r) => `Outbox run: ${r.submitted} sent to provider, ${r.projected} completed, ${r.failed} held for review.`,
      "Outbox run failed.",
      { setBusy: setRunningOutbox, setMessage },
    );
  }

  // Unmount: pending list/action callbacks become no-ops, nothing setStates
  // into a dead view.
  useEffect(() => () => cycle.dispose(), [cycle]);

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToPayments(
      claims.tenantId,
      (data) => {
        setError(null);
        setPayments(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  const names = useLabels(COLLECTIONS.customers(), payments.map((p) => p.customerId), (d) => (d as Customer).name);

  const invoiceNos = useLabels(COLLECTIONS.invoices(), payments.map((p) => p.invoiceId ?? "").filter(Boolean), (d) => (d as Invoice).invoiceNumber ?? "");

  async function handleRefund(paymentId: string, reason: string) {
    setRefundingId(paymentId);
    setMessage(null);
    try {
      // Server-side callable re-checks role, amount and state; the UI only asks.
      await refundPayment(paymentId, reason);
      setMessage("Refund done.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setRefundingId(null);
    }
  }

  return (
    <>
    <RefundWorkPanel
      work={refundWork ? { ...refundWork, legacyClaims: [...legacyAccum.values()] } : refundWork}
      loading={refundWorkLoading}
      error={refundWorkError}
      running={runningOutbox}
      reconciling={reconciling}
      actionsEnabled={refundActionsEnabled}
      onReconcile={() => void handleReconcileClaims()}
      onContinueScan={() => void cycle.refresh()}
      names={names}
      onRun={() => void handleRunOutbox()}
      onOpenInvoice={(id) => router.push(`/invoices/${id}`)}
    />
    <PaymentsView
      payments={payments}
      names={names}
      invoiceNos={invoiceNos}
      loading={loading}
      error={error}
      status={status}
      onStatus={setStatus}
      search={search}
      onSearch={setSearch}
      message={message}
      refundingId={refundingId}
      onRefund={(id, reason) => void handleRefund(id, reason)}
      onOpenInvoice={(id) => router.push(`/invoices/${id}`)}
      today={studioToday()}
    />
    </>
  );
}

/** useSearchParams requires a Suspense boundary for static prerendering in
 * production builds (Next 15 CSR-bailout rule). */
export default function PaymentsPage() {
  return (
    <Suspense fallback={<p className="ax-muted">Loading payments...</p>}>
      <PaymentsPageContent />
    </Suspense>
  );
}
