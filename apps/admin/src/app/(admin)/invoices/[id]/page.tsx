"use client";

import { goBackOrTo } from "../../../../lib/go-back";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Invoice, Customer, Vehicle, Payment } from "@autodeck/core";
import { useAdminAuth } from "../../../../lib/auth-context";
import { listenToInvoice, voidInvoice } from "../../../../lib/invoices-service";
import { getCustomer, getVehicle } from "../../../../lib/bookings-service";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import { InvoiceView } from "../../../../experience/InvoiceView";
import { getStudioConfig } from "../../../../lib/studio-service";
import { FIRST_STUDIO_ID } from "@autodeck/core";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, claims } = useAdminAuth();
  const scope=[id,user?.uid,claims?.tenantId,claims?.role].join("|");
  const live=useRef(scope);live.current=scope;
  const [resolved,setResolved]=useState("");

  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [voiding, setVoiding] = useState(false);
  const [studioName, setStudioName] = useState("AutoDeck");

  useEffect(() => {
    void getStudioConfig(FIRST_STUDIO_ID).then((c) => { if (c?.name) setStudioName(c.name); }).catch(() => undefined);
  }, []);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    setInvoice(undefined);setError(null);setCustomer(null);setVehicle(null);setPayment(null);setStatus(null);
    const current=scope;
    return listenToInvoice(id, value=>{if(live.current===current){setInvoice(value);setResolved(current)}}, (err) => {if(live.current===current)setError(err.message)});
  }, [id,scope]);

  useEffect(() => {
    if (!invoice) return undefined;
    let alive=true;const current=scope;
    void getCustomer(invoice.customerId).then(c=>{if(alive&&live.current===current)setCustomer(c)}).catch(()=>undefined);
    void getVehicle(invoice.vehicleId).then(v=>{if(alive&&live.current===current)setVehicle(v)}).catch(()=>undefined);
    if (!claims || !invoice.paymentId) return ()=>{alive=false};
    const q = query(collection(db, COLLECTIONS.payments()), where("tenantId", "==", claims.tenantId), where("invoiceId", "==", invoice.id));
    const stop=onSnapshot(q, (snap) => {if(alive&&live.current===current)setPayment(snap.empty ? null : (snap.docs[0]?.data() as Payment))}, (err) => {if(alive&&live.current===current)setError(err.message)});
    return()=>{alive=false;stop()};
  }, [invoice, claims,scope]);

  async function handleVoid(reason: string) {
    if (!invoice) return;
    setVoiding(true);
    setStatus(null);
    try {
      await voidInvoice(invoice.id, reason);
      // Server callable re-checks role and refuses paid invoices.
      setStatus("Invoice voided.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't void the invoice.");
    } finally {
      setVoiding(false);
    }
  }

  if (error) return <div className="ax-panel ax-empty" role="alert"><p className="ax-title">Couldn&apos;t load this invoice</p><p>{error}</p></div>;
  if (invoice === undefined||resolved!==scope) return <div className="ax-page"><div className="ax-skel" style={{ height: 480 }} /></div>;
  if (invoice === null) return <div className="ax-panel ax-empty"><p className="ax-title">Invoice not found</p><p>Check the number and try again.</p></div>;

  return (
    <InvoiceView
      key={scope}
      invoice={invoice}
      customer={customer}
      vehicle={vehicle}
      payment={payment}
      studioName={studioName}
      message={status}
      voiding={voiding}
      onVoid={(r) => void handleVoid(r)}
      onBack={() => goBackOrTo(router, "/invoices")}
      onOpen={(href) => router.push(href)}
    />
  );
}
