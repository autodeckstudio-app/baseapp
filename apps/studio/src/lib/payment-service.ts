import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Payment, PaymentMethod, Invoice } from "@autodeck/core";

type RecordManualPaymentInput = { bookingId: string; method: PaymentMethod; manualReference?: string };
type RecordManualPaymentOutput = { paymentId: string; invoiceId: string };

// Studio/admin only — records a cash/UPI/bank-transfer payment collected in
// person. Completes the payment and issues the invoice immediately (no
// customer action involved — a customer can never mark their own payment
// successful; only this function or confirmPaymentMock can).
export async function recordManualPayment(input: RecordManualPaymentInput): Promise<RecordManualPaymentOutput> {
  const fn = httpsCallable<RecordManualPaymentInput, RecordManualPaymentOutput>(functions, "recordManualPayment");
  const result = await fn(input);
  return result.data;
}

type ConfirmPaymentMockInput = { paymentId: string; mockResult: "success" | "failure" };
type ConfirmPaymentMockOutput = { paymentId: string; result: string; idempotent: boolean };

// DEV/EMULATOR ONLY — confirms a customer-initiated pending payment, simulating
// the Razorpay webhook. Studio/admin role required (enforced server-side).
export async function confirmPaymentMock(paymentId: string, mockResult: "success" | "failure"): Promise<ConfirmPaymentMockOutput> {
  const fn = httpsCallable<ConfirmPaymentMockInput, ConfirmPaymentMockOutput>(functions, "confirmPaymentMock");
  const result = await fn({ paymentId, mockResult });
  return result.data;
}

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
