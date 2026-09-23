"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Invoice, Customer, Vehicle, Payment } from "@autodeck/core";
import { useAdminAuth } from "../../../../lib/auth-context";
import { listenToInvoice, voidInvoice } from "../../../../lib/invoices-service";
import { getCustomer, getVehicle } from "../../../../lib/bookings-service";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import { InvoiceView } from "../../../../experience/InvoiceView";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [voiding, setVoiding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return listenToInvoice(id, setInvoice, (err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!invoice) return undefined;
    void getCustomer(invoice.customerId).then(setCustomer);
    void getVehicle(invoice.vehicleId).then(setVehicle);
    if (!claims || !invoice.paymentId) return undefined;
    const q = query(collection(db, COLLECTIONS.payments()), where("tenantId", "==", claims.tenantId), where("invoiceId", "==", invoice.id));
    return onSnapshot(q, (snap) => setPayment(snap.empty ? null : (snap.docs[0]?.data() as Payment)), (err) => setError(err.message));
  }, [invoice, claims]);

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

  if (error) return <div className="ad-panel ad-empty" role="alert"><p className="ad-title">Couldn&apos;t load this invoice</p><p>{error}</p></div>;
  if (invoice === undefined) return <div className="ad-page"><div className="ad-skel" style={{ height: 480 }} /></div>;
  if (invoice === null) return <div className="ad-panel ad-empty"><p className="ad-title">Invoice not found</p><p>Check the number and try again.</p></div>;

  return (
    <InvoiceView
      invoice={invoice}
      customer={customer}
      vehicle={vehicle}
      payment={payment}
      studioName="AutoDeck"
      message={status}
      voiding={voiding}
      onVoid={(r) => void handleVoid(r)}
      onBack={() => router.push("/invoices")}
      onOpen={(href) => router.push(href)}
    />
  );
}
