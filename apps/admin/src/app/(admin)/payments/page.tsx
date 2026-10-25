"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Payment, PaymentStatus, Customer, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToPayments, refundPayment } from "../../../lib/payments-service";
import { useLabels } from "../../../lib/use-labels";
import { studioToday } from "../../../lib/format";
import { PaymentsView, RefundWorkPanel } from "../../../experience/OfficeViews";
import { listRefundWork, runRefundOutbox, reconcileRefundClaims, type RefundWork } from "../../../lib/refund-work-service";

export default function PaymentsPage() {
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
  const [refundWork, setRefundWork] = useState<RefundWork | null>(null);
  // Retained-claim rows are PAGED on the server: accumulate every page seen
  // in this review cycle keyed by paymentId. A row never disappears just
  // because the scan cursor advanced past it; fresh pages update known rows
  // with the latest truth, and rows the server reports resolved are dropped
  // as resolved (that is truth, not cursor advance).
  const [legacyAccum, setLegacyAccum] = useState<Map<string, import("../../../lib/refund-work-service").LegacyRefundClaim>>(new Map());
  // Identity generation: bumped whenever the signed-in identity/tenant
  // changes. A response from a previous generation is dropped, so a late
  // old-identity response can never repopulate the new identity's rows.
  const identityGenRef = useRef(0);
  const [refundWorkLoading, setRefundWorkLoading] = useState(true);
  const [refundWorkError, setRefundWorkError] = useState<string | null>(null);
  const [runningOutbox, setRunningOutbox] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  async function refreshRefundWork() {
    const gen = identityGenRef.current;
    setRefundWorkLoading(true);
    try {
      // Ask for the authoritative truth of every row we already show: paged
      // scans never return resolved/released claims, so known rows would
      // otherwise stay stale "held" forever after an actual reconcile.
      const work = await listRefundWork([...legacyAccum.keys()]);
      if (gen !== identityGenRef.current) return; // stale identity response
      setRefundWork(work);
      setLegacyAccum((prev) => {
        const next = new Map(prev);
        for (const c of work.legacyClaims) next.set(c.paymentId, c);
        for (const t of work.claimTruth) {
          if (t.state === "resolved" || t.state === "released") next.delete(t.paymentId);
          else {
            const row = next.get(t.paymentId);
            if (row) next.set(t.paymentId, { ...row, reconcileState: t.state, reconcileNote: t.note });
          }
        }
        return next;
      });
      setRefundWorkError(null);
    } catch (err) {
      setRefundWorkError(err instanceof Error ? err.message : "Refund work unavailable.");
    } finally {
      setRefundWorkLoading(false);
    }
  }

  useEffect(() => {
    if (!claims) return;
    identityGenRef.current += 1; // new identity/tenant: new review cycle
    setLegacyAccum(new Map());
    void refreshRefundWork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims?.tenantId, user?.uid]);

  async function handleReconcileClaims() {
    setReconciling(true);
    setMessage(null);
    try {
      const r = await reconcileRefundClaims();
      setMessage(`Claim reconciliation: ${r.projected + r.converged + r.alreadyAccounted} accounted (${r.alreadyAccounted} already recorded), ${r.released} released, ${r.held} held for review${r.exhausted ? "" : " (more records to scan - continue the scan)"}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Claim reconciliation failed.");
    } finally {
      setReconciling(false);
      void refreshRefundWork();
    }
  }

  async function handleRunOutbox() {
    setRunningOutbox(true);
    setMessage(null);
    try {
      const r = await runRefundOutbox();
      setMessage(`Outbox run: ${r.submitted} sent to provider, ${r.projected} completed, ${r.failed} held for review.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Outbox run failed.");
    } finally {
      setRunningOutbox(false);
      void refreshRefundWork();
    }
  }

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
      onReconcile={() => void handleReconcileClaims()}
      onContinueScan={() => void refreshRefundWork()}
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
