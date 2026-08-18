import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Payment, PaymentMethod } from "@autodeck/core";

type InitiatePaymentInput = { jobId: string; method: PaymentMethod };
type InitiatePaymentOutput = { paymentId: string; paymentUrl: string | null; status: string };

// Keyed by jobId — the payable operational job — so this works identically
// whether the job came from a booking or a walk-in. Development uses
// MockPaymentProvider — no real Razorpay charge occurs. Payment only becomes
// "completed" once studio/admin confirms it (confirmManualPayment /
// recordManualPayment) — the customer app never has access to a function
// that can mark its own payment successful.
export async function initiatePayment(jobId: string, method: PaymentMethod): Promise<InitiatePaymentOutput> {
  const fn = httpsCallable<InitiatePaymentInput, InitiatePaymentOutput>(functions, "initiatePayment");
  const result = await fn({ jobId, method });
  return result.data;
}

/**
 * Real-time listener for the most recent payment on a job.
 *
 * Filters by tenantId and customerId as well as jobId: Firestore rejects a
 * list query outright unless every field the security rule checks is
 * constrained by an equality filter it can verify statically (see
 * job-service.ts's listenToJobForBooking for the full explanation).
 */
export function listenToPaymentForJob(
  jobId: string,
  tenantId: string,
  customerId: string,
  onData: (payment: Payment | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.payments()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Payment | undefined) ?? null),
    onError,
  );
}
