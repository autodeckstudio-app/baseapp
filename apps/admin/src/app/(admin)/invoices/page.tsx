"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Invoice, InvoiceStatus, Customer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { useAdminAuth } from "../../../lib/auth-context";
import { listVisitInvoices,type VisitInvoiceRow } from "../../../lib/visit-invoice-service";
import { listenToInvoices } from "../../../lib/invoices-service";
import { useLabels } from "../../../lib/use-labels";
import { InvoicesView } from "../../../experience/OfficeViews";

export default function InvoicesPage() {
  const { user,claims } = useAdminAuth();
  const scope=[user?.uid,claims?.tenantId,claims?.role].join("|");
  const live=useRef(scope);live.current=scope;
  const [resolved,setResolved]=useState("");
  const [visitResolved,setVisitResolved]=useState("");
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [visitInvoices,setVisitInvoices]=useState<VisitInvoiceRow[]>([]);
  const [visitLoading,setVisitLoading]=useState(true);
  const [visitError,setVisitError]=useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!claims) return undefined;
    const current=scope;setLoading(true);setInvoices([]);
    return listenToInvoices(
      claims.tenantId,
      (data) => {
        if(live.current!==current)return;setResolved(current);
        setError(null);
        setInvoices(data);
        setLoading(false);
      },
      (err) => {
        if(live.current!==current)return;setResolved(current);
        setError(err.message);
        setLoading(false);
      },
    );
  }, [claims,scope]);

  useEffect(()=>{let alive=true;const current=scope;setVisitInvoices([]);setVisitError(null);setVisitLoading(true);if(!claims)return;void listVisitInvoices().then(rows=>{if(alive&&live.current===current){setVisitResolved(current);setVisitInvoices(rows);setVisitLoading(false)}}).catch(e=>{if(alive&&live.current===current){setVisitResolved(current);setVisitError(e instanceof Error?e.message:'Visit invoice history unavailable');setVisitLoading(false)}});return()=>{alive=false}},[claims,scope]);
  const names = useLabels(COLLECTIONS.customers(), invoices.map((i) => i.customerId), (d) => (d as Customer).name);

  return (
    <InvoicesView
      invoices={resolved!==scope||visitResolved!==scope?[]:[...invoices,...visitInvoices.map(i=>({...i,shared:true}))].sort((a,b)=>(b.issuedAt??"").localeCompare(a.issuedAt??""))}
      names={names}
      loading={resolved!==scope||visitResolved!==scope||loading||visitLoading}
      error={resolved!==scope||visitResolved!==scope?null:error??visitError}
      status={status}
      onStatus={setStatus}
      search={search}
      onSearch={setSearch}
      onOpen={(id,shared) => router.push(shared?`/invoices/shared/${id}`:`/invoices/${id}`)}
    />
  );
}
