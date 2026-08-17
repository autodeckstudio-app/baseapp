import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Payment, PaymentMethod } from "@autodeck/core";

type InitiatePaymentInput = { bookingId: string; method: PaymentMethod };
type InitiatePaymentOutput = { paymentId: string; paymentUrl: string | null; status: string };

// Development uses MockPaymentProvider — no real Razorpay charge occurs.
// Payment only becomes "completed" once studio/admin confirms it
// (confirmPaymentMock / recordManualPayment) — the customer app never has
// access to a function that can mark its own payment successful.
export async function initiatePayment(bookingId: string, method: PaymentMethod): Promise<InitiatePaymentOutput> {
  const fn = httpsCallable<InitiatePaymentInput, InitiatePaymentOutput>(functions, "initiatePayment");
  const result = await fn({ bookingId, method });
  return result.data;
}

/**
 * Real-time listener for the most recent payment on a booking.
 * Firestore rules restrict reads to the payment's own customerId.
 */
export function listenToPaymentForBooking(
  bookingId: string,
  onData: (payment: Payment | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.payments()),
    where("bookingId", "==", bookingId),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Payment | undefined) ?? null),
    onError,
  );
}
