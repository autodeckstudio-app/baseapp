"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Invoice, InvoiceStatus, Customer } from "@autodeck/core";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToInvoices } from "../../../lib/invoices-service";
import { StatusBadge } from "../../../components/StatusBadge";
import { formatPaise, formatDateTime } from "../../../lib/format";
import { useLabels } from "../../../lib/use-labels";
import { COLLECTIONS } from "@autodeck/database";

const STATUSES: InvoiceStatus[] = ["draft", "issued", "paid", "void"];

export default function InvoicesPage() {
  const { claims } = useAdminAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!claims) return undefined;
    setLoading(true);
    return listenToInvoices(
      claims.tenantId,
      (data) => {
        setInvoices(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims]);

  const customerNames = useLabels(COLLECTIONS.customers(), invoices.map((i) => i.customerId), (d) => (d as Customer).name);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status && inv.status !== status) return false;
      if (q) {
        const haystack = [inv.invoiceNumber, inv.id, inv.customerId, customerNames[inv.customerId]].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, status, search, customerNames]);

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Invoices</h1>

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input placeholder="Search invoice # / customer" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtered.length} of {invoices.length}</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No invoices match these filters.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Number</th><th>Customer</th><th>Status</th><th>GST</th><th>Total</th><th>Issued</th></tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="row-link" onClick={() => router.push(`/invoices/${inv.id}`)}>
                <td>{inv.invoiceNumber}</td>
                <td>{customerNames[inv.customerId] ?? inv.customerId}</td>
                <td><StatusBadge label={inv.status} /></td>
                <td>{formatPaise(inv.tax)}</td>
                <td>{formatPaise(inv.total)}</td>
                <td>{formatDateTime(inv.issuedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
