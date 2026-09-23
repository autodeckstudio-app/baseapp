"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Invoice, InvoiceStatus, Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../../../lib/auth-context";
import { listenToInvoices } from "../../../lib/invoices-service";
import { useLabels } from "../../../lib/use-labels";
import { InvoicesView } from "../../../experience/OfficeViews";

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

  const names = useLabels(COLLECTIONS.customers(), invoices.map((i) => i.customerId), (d) => (d as Customer).name);

  return (
    <InvoicesView
      invoices={invoices}
      names={names}
      loading={loading}
      error={error}
      status={status}
      onStatus={setStatus}
      search={search}
      onSearch={setSearch}
      onOpen={(id) => router.push(`/invoices/${id}`)}
    />
  );
}
