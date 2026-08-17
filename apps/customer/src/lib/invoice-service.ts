import { doc, onSnapshot, collection, query, where, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Invoice } from "@autodeck/core";

/**
 * Real-time listener for a single invoice by ID.
 * Firestore rules restrict reads to the invoice's own customerId.
 */
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

/**
 * Real-time listener for the invoice linked to a job (there is at most one) —
 * works identically for a booking-sourced job or a walk-in job.
 *
 * Filters by tenantId and customerId as well as jobId: Firestore rejects a
 * list query outright unless every field the security rule checks is
 * constrained by an equality filter it can verify statically (see
 * job-service.ts's listenToJobForBooking for the full explanation).
 */
export function listenToInvoiceForJob(
  jobId: string,
  tenantId: string,
  customerId: string,
  onData: (invoice: Invoice | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.invoices()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Invoice | undefined) ?? null),
    onError,
  );
}
