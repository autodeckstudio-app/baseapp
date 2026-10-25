/** Rules for the staff "Record payment" step. The server always takes the amount from the job total, so this screen only ever records the exact full amount. */
export type RecordMethod = "cash" | "upi_manual";

export function recordAmountLine(totalPaise: number): string {
  const rupees = totalPaise / 100;
  return `Records the full amount: Rs ${Number.isInteger(rupees) ? rupees.toLocaleString("en-IN") : rupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`;
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
