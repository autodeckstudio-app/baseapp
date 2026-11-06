import { approvedConsultPaymentBinding } from "./consult-approval-binding.js";
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore, Transaction } from "firebase-admin/firestore";
type Job = {
  serviceId?: string;
  id: string;
  tenantId: string;
  customerId: string;
  bookingId?: string | null;
  totalAmount: number;
  priceBreakdown?: { pickupFee?: number; dropFee?: number };
};
export function assertConsultPaymentApproved(
  job: Job,
  booking: Record<string, unknown> | undefined,
  storedApproval?: unknown,
  deltas: unknown[] = [],
) {
  if (!job.bookingId) return;
  if (
    !booking ||
    booking["tenantId"] !== job.tenantId ||
    booking["customerId"] !== job.customerId
  )
    throw new HttpsError(
      "failed-precondition",
      "Booking payment scope could not be verified.",
    );
  if (["CANCELLED", "EXPIRED"].includes(String(booking["status"])))
    throw new HttpsError(
      "failed-precondition",
      "This booking is no longer open for payment.",
    );
  if (
    booking["priceOnRequest"] !== true &&
    booking["requiresPriceApproval"] !== true
  )
    return;
  if (booking["quoteStatus"] !== "approved")
    throw new HttpsError(
      "failed-precondition",
      "The customer must approve the current quote before payment.",
    );
  try {
    return approvedConsultPaymentBinding(storedApproval, deltas, {
      bookingId: job.bookingId,
      jobId: job.id,
      tenantId: job.tenantId,
      customerId: job.customerId,
      pickupFeePaise: job.priceBreakdown?.pickupFee ?? 0,
      dropFeePaise: job.priceBreakdown?.dropFee ?? 0,
      totalAmountPaise: job.totalAmount,
    });
  } catch {
    throw new HttpsError(
      "failed-precondition",
      "Current quote, approved work or pickup fees changed. Fresh customer approval is required before payment.",
    );
  }
}
/** Read the immutable receipt, never use the mutable booking copy as authority.
 * With a transaction, all these reads join its conflict set before writes.
 */
export async function readConsultPaymentBinding(
  db: Firestore,
  tx: Transaction | undefined,
  job: Job,
  booking: Record<string, unknown> | undefined,
) {
  if (!job.bookingId && job.serviceId) {
    const ref = db.collection("services").doc(job.serviceId),
      service = (tx ? await tx.get(ref) : await ref.get()).data();
    if (!service || service["tenantId"] !== job.tenantId)
      throw new HttpsError(
        "failed-precondition",
        "Service payment scope could not be verified.",
      );
    if (service["priceOnRequest"] === true)
      throw new HttpsError(
        "failed-precondition",
        "This walk-in consult has no customer-approved quote. Ask the office to set up the approval before payment.",
      );
  }
  if (
    (booking?.["priceOnRequest"] !== true &&
      booking?.["requiresPriceApproval"] !== true) ||
    booking?.["quoteStatus"] !== "approved"
  )
    return assertConsultPaymentApproved(job, booking);
  const marker = booking["consultQuoteApproval"] as
    { quoteHash?: unknown } | undefined;
  if (
    typeof marker?.quoteHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(marker.quoteHash)
  )
    return assertConsultPaymentApproved(job, booking);
  const ref = db.collection("consultQuoteApprovals").doc(marker.quoteHash),
    query = db
      .collection("consultApprovedDeltas")
      .where("jobId", "==", job.id)
      .limit(501);
  const approved = tx ? await tx.get(ref) : await ref.get(),
    deltaRows = tx ? await tx.get(query) : await query.get();
  if (deltaRows.size > 500)
    throw new HttpsError(
      "failed-precondition",
      "Approved work needs office review before payment.",
    );
  return assertConsultPaymentApproved(
    job,
    booking,
    approved.data(),
    deltaRows.docs
      .map((x) => x.data())
      .filter((x) => x["quoteHash"] === marker.quoteHash),
  );
}
export function assertPaymentConsultBinding(
  payment: unknown,
  binding: ReturnType<typeof assertConsultPaymentApproved>,
) {
  if (!binding) return;
  const p = payment as {
    amount?: unknown;
    consultApprovalBindingHash?: unknown;
  };
  if (
    p.amount !== binding.amountPaise ||
    p.consultApprovalBindingHash !== binding.approvalBindingHash
  )
    throw new HttpsError(
      "failed-precondition",
      "Payment does not match the current approved quote. Office review is required.",
    );
}
