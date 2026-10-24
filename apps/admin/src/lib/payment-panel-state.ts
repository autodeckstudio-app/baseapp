// What the Payment panel on a job/booking page may show and offer. `undefined` means the payment listener has not answered yet.
export type PaymentPanelMode = "loading" | "none" | "present";

export function paymentPanelMode(payment: { id: string } | null | undefined): PaymentPanelMode {
  if (payment === undefined) return "loading";
  return payment === null ? "none" : "present";
}

/** Pay-link and counter-payment controls only exist once the listener has answered, and never for a job that is not unpaid. */
export function canOfferPayment(payment: { status: string } | null | undefined, jobPaymentStatus: string): { link: boolean; counter: boolean } {
  if (payment === undefined || jobPaymentStatus !== "unpaid") return { link: false, counter: false };
  return { link: payment === null || payment.status === "failed" || payment.status === "cancelled", counter: true };
}

export type CoveredVisitSubject = {
  settlementKind?: string;
  membershipWashUsed?: boolean;
  totalAmount?: number;
};

/**
 * A membership-covered visit that still needs its zero settlement. The covered
 * hiding removes the payment link and counter actions for these jobs; without
 * an explicit note the panel would be a silent dead end. The note must point at
 * the working zero-settlement path and must never imply charging the customer:
 * the membership already covers the visit, so there is nothing to collect.
 */
export function coveredVisitSettlementNote(
  job: CoveredVisitSubject | null | undefined,
  booking: CoveredVisitSubject | null | undefined,
): string | null {
  const unsettled = (v: CoveredVisitSubject | null | undefined) =>
    !!v && v.settlementKind !== "membership_covered" && v.membershipWashUsed === true && v.totalAmount === 0;
  if (!unsettled(job) && !unsettled(booking)) return null;
  return "Membership-covered visit - the customer's plan covers it, so there is nothing to collect here. To close it out, settle the visit in the studio app: open the job and use Record cash payment for Rs 0.";
}
