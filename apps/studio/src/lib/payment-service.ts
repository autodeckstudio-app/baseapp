import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Payment, PaymentMethod, Invoice } from "@autodeck/core";

type RecordManualPaymentInput = { jobId: string; method: PaymentMethod; manualReference?: string };
type RecordManualPaymentOutput = { paymentId: string; invoiceId: string };

// Studio/admin only — records a cash/UPI/bank-transfer payment collected in
// person, keyed by jobId so it works identically for a booking-sourced job
// or a walk-in job. Completes the payment and issues the invoice immediately
// (no customer action involved — a customer can never mark their own
// payment successful; only this function or confirmManualPayment can).
export async function recordManualPayment(input: RecordManualPaymentInput): Promise<RecordManualPaymentOutput> {
  const fn = httpsCallable<RecordManualPaymentInput, RecordManualPaymentOutput>(functions, "recordManualPayment");
  const result = await fn(input);
  return result.data;
}

type ConfirmManualPaymentInput = { paymentId: string };
type ConfirmManualPaymentOutput = { paymentId: string; invoiceId: string | null; alreadyCompleted: boolean };

// Studio/admin only — confirms an EXISTING pending cash/manual payment the
// customer already initiated from the app (production path). Online
// (razorpay_payment_link) payments are rejected server-side — those complete
// only via the payment provider, never manually.
export async function confirmManualPayment(paymentId: string): Promise<ConfirmManualPaymentOutput> {
  const fn = httpsCallable<ConfirmManualPaymentInput, ConfirmManualPaymentOutput>(functions, "confirmManualPayment");
  const result = await fn({ paymentId });
  return result.data;
}

// Filters by tenantId as well as jobId: the /payments rule requires
// ownTenant(resource.data) unconditionally (regardless of role), so
// Firestore rejects the list query outright unless tenantId is also
// constrained by an equality filter it can verify statically.
export function listenToPaymentForJob(
  jobId: string,
  tenantId: string,
  onData: (payment: Payment | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.payments()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Payment | undefined) ?? null),
    onError,
  );
}

export function listenToInvoiceForJob(
  jobId: string,
  tenantId: string,
  onData: (invoice: Invoice | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.invoices()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Invoice | undefined) ?? null),
    onError,
  );
}
