"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Payment, PaymentStatus, Customer, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToPayments, refundPayment } from "../../../lib/payments-service";
import { useLabels } from "../../../lib/use-labels";
import { studioToday } from "../../../lib/format";
import { PaymentsView, RefundWorkPanel } from "../../../experience/OfficeViews";
import { listRefundWork, runRefundOutbox, type RefundWork } from "../../../lib/refund-work-service";

export default function PaymentsPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [search, setSearch] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refundWork, setRefundWork] = useState<RefundWork | null>(null);
  const [refundWorkLoading, setRefundWorkLoading] = useState(true);
  const [refundWorkError, setRefundWorkError] = useState<string | null>(null);
  const [runningOutbox, setRunningOutbox] = useState(false);

  async function refreshRefundWork() {
    setRefundWorkLoading(true);
    try {
      setRefundWork(await listRefundWork());
      setRefundWorkError(null);
    } catch (err) {
      setRefundWorkError(err instanceof Error ? err.message : "Refund work unavailable.");
    } finally {
      setRefundWorkLoading(false);
    }
  }

  useEffect(() => {
    if (!claims) return;
    void refreshRefundWork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims]);

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
      work={refundWork}
      loading={refundWorkLoading}
      error={refundWorkError}
      running={runningOutbox}
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
