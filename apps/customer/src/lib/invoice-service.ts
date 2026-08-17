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
 * Real-time listener for the invoice linked to a booking (there is at most one).
 * Firestore rules restrict reads to the invoice's own customerId.
 */
export function listenToInvoiceForBooking(
  bookingId: string,
  onData: (invoice: Invoice | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.invoices()), where("bookingId", "==", bookingId));
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Invoice | undefined) ?? null),
    onError,
  );
}
