"use client";

import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Invoice } from "@autodeck/core";

const LIST_LIMIT = 300;

/** Live, tenant-wide invoice feed — newest first. Customer/vehicle/job/booking/
 * status filters are applied client-side. */
export function listenToInvoices(
  tenantId: string,
  onData: (invoices: Invoice[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.invoices()),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(LIST_LIMIT),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Invoice)), onError);
}

export function listenToInvoice(
  invoiceId: string,
  onData: (invoice: Invoice | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.invoices(), invoiceId),
    (snap) => onData(snap.exists() ? (snap.data() as Invoice) : null),
    onError,
  );
}

type VoidInvoiceInput = { invoiceId: string; reason: string };
type VoidInvoiceOutput = { invoiceId: string; voided: boolean };

// Admin-only. The Cloud Function itself refuses to void a "paid" invoice
// (refund the payment first) — this wrapper does not duplicate that rule,
// it only surfaces whatever error the server returns.
export async function voidInvoice(invoiceId: string, reason: string): Promise<VoidInvoiceOutput> {
  const fn = httpsCallable<VoidInvoiceInput, VoidInvoiceOutput>(functions, "voidInvoice");
  const result = await fn({ invoiceId, reason });
  return result.data;
}
