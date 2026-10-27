/** Rules for the staff "Record payment" step. The server always takes the amount from the job total, so this screen only ever records the exact full amount. */
export type RecordMethod = "cash" | "upi_manual";

export function recordAmountLine(totalPaise: number): string {
  const rupees = totalPaise / 100;
  return `Records the full amount: Rs ${Number.isInteger(rupees) ? rupees.toLocaleString("en-IN") : rupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`;
}

/** Shown under the QR on the UPI record sheet. Verified against the owner-supplied standee on 27 Oct 2026; the decoded payload is preserved byte-identical in assets/brand/upi-qr.png: upi://pay?pa=9898679711@okbizaxis&pn=Autodeck&mc=5541&aid=uGICAgMCkjf-KJA&ver=01&mode=01&tr=BCR2DN4TTST53JA7 - no locked amount. */
export const UPI_PAYEE_LINE = "Scan to pay AutoDeck - UPI 9898679711@okbizaxis";

export type CollectMethod = "cash" | "upi_manual" | "bank_transfer";

/** Same receipt guard as the job Record payment step, for the membership desk: the money must be seen (cash in hand, or arrived in the account) and account arrivals need the reference so the office can match them. Displaying the QR never implies the payment arrived. */
/** What a membership-desk receipt confirmation is bound to: who is paying, for which plan, at what amount. If any of these change after the staff member saw the money, the receipt no longer belongs to this sale. */
export type ReceiptBinding = { customerKey: string; planId: string; amountPaise: number };

export function receiptMatches(binding: ReceiptBinding | null, current: ReceiptBinding): boolean {
  return binding !== null && binding.customerKey === current.customerKey && binding.planId === current.planId && binding.amountPaise === current.amountPaise;
}

export function canCollectPayment(i: { method: CollectMethod; verified: boolean; reference: string }): string | null {
  if (!i.verified) return i.method === "cash" ? "Confirm you have the cash in hand first." : "Check the payment arrived in the AutoDeck account first.";
  if (i.method !== "cash" && i.reference.trim().length < 6) return "Enter the payment reference so the office can match it.";
  return null;
}

export const WRONG_AMOUNT_NOTE = "If the customer paid a different amount, do not record it here. Ask the office.";

/** Staff must confirm they saw the money arrive before anything is recorded. UPI also needs the transaction reference so the office can match it to the bank. */
export function canRecordPayment(i: { method: RecordMethod; verified: boolean; reference: string }): string | null {
  if (!i.verified) return i.method === "upi_manual" ? "Check the payment arrived in the AutoDeck account first." : "Confirm you have the cash in hand first.";
  if (i.method === "upi_manual" && i.reference.trim().length < 6) return "Enter the UPI reference from the payment.";
  return null;
}

export function recordInput(jobId: string, i: { method: RecordMethod; reference: string }): { jobId: string; method: RecordMethod; manualReference?: string } {
  const ref = i.reference.trim();
  return { jobId, method: i.method, ...(i.method === "upi_manual" && ref ? { manualReference: ref } : {}) };
}

const SERVER_SAFE = /(failed-precondition|permission-denied|already-exists|invalid-argument)$/;
/** Shows the server's plain message only for rule refusals (already paid, pending payment, not allowed). Anything else, like a network or internal error, gets a safe line that tells staff to check the payment before retrying. */
export function payErrorNote(e: unknown, mode: "record" | "confirm"): string {
  const code = typeof (e as { code?: unknown })?.code === "string" ? (e as { code: string }).code : "";
  const msg = e instanceof Error ? e.message.trim() : "";
  if (SERVER_SAFE.test(code) && msg) return msg;
  return mode === "record" ? "Could not record the payment. Check the job's payment status, then try again." : "Could not confirm the payment. Check the job's payment status, then try again.";
}
