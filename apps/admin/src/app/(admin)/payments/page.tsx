"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Payment, PaymentStatus, Customer } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToPayments, refundPayment } from "../../../lib/payments-service";
import { StatusBadge } from "../../../components/StatusBadge";
import { formatPaise, formatDateTime } from "../../../lib/format";
import { useLabels } from "../../../lib/use-labels";
import { COLLECTIONS } from "@autodeck/database";

const STATUSES: PaymentStatus[] = ["pending", "processing", "completed", "failed", "cancelled", "refunded"];

export default function PaymentsPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [search, setSearch] = useState("");
  const [refunding, setRefunding] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

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

  const customerNames = useLabels(COLLECTIONS.customers(), payments.map((p) => p.customerId), (d) => (d as Customer).name);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (status && p.status !== status) return false;
      if (q) {
        const haystack = [p.id, p.customerId, p.jobId, p.bookingId, customerNames[p.customerId]].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [payments, status, search, customerNames]);

  async function handleRefund(paymentId: string) {
    setRefunding(paymentId);
    setActionResult(null);
    try {
      await refundPayment(paymentId, reason || "Admin-initiated refund");
      setActionResult("Refund completed.");
      setConfirmId(null);
      setReason("");
    } catch (err) {
      setActionResult(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setRefunding(null);
    }
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Payments</h1>
      {actionResult && <p>{actionResult}</p>}

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input placeholder="Search customer / job / booking ID" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtered.length} of {payments.length}</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No payments match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Customer</th><th>Status</th><th>Method</th><th>Amount</th><th>Invoice</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{formatDateTime(p.createdAt)}</td>
                <td>{customerNames[p.customerId] ?? p.customerId}</td>
                <td><StatusBadge label={p.status} /></td>
                <td>{p.method}</td>
                <td>{formatPaise(p.amount)}</td>
                <td>{p.invoiceId ? <button onClick={() => router.push(`/invoices/${p.invoiceId}`)}>View</button> : "—"}</td>
                <td>
                  {p.status === "completed" && (
                    confirmId === p.id ? (
                      <span style={{ display: "flex", gap: 4 }}>
                        <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: 120 }} />
                        <button onClick={() => void handleRefund(p.id)} disabled={refunding === p.id || !reason.trim()}>
                          {refunding === p.id ? "…" : "Confirm"}
                        </button>
                        <button onClick={() => { setConfirmId(null); setReason(""); }}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmId(p.id)}>Refund</button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
