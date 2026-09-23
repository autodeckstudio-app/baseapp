"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Payment, PaymentStatus, Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToPayments, refundPayment } from "../../../lib/payments-service";
import { useLabels } from "../../../lib/use-labels";
import { studioToday } from "../../../lib/format";
import { PaymentsView } from "../../../experience/OfficeViews";

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

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToPayments(
      claims.tenantId,
      (data) => {
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
    <PaymentsView
      payments={payments}
      names={names}
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
  );
}
