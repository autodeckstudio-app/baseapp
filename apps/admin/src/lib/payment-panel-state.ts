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

import { MEMBERSHIP_SETTLEMENT_ENABLED } from "./backend-features";

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
  // Gate ON: the MembershipSettlement panel on this page carries the settle action.
  // Showing the old Rs-0 instruction next to it would offer two competing paths, and
  // once the recordManualPayment guard deploys the old route rejects covered jobs.
  if (MEMBERSHIP_SETTLEMENT_ENABLED) return null;
  // Gate OFF (pre-release): the studio zero route is still the working path.
  return "Membership-covered visit - the customer's plan covers it, so there is nothing to collect here. To close it out, settle the visit in the studio app: open the job and use Record cash payment for Rs 0.";
}

/**
 * True exactly when the gated MembershipSettlement panel renders for this pair
 * (flag ON, covered, unsettled, still open). The Payment panel then yields the
 * covered-unsettled state to that single panel so the status and its one action
 * live in one tile. Keep in sync with components/MembershipSettlement.tsx.
 */
export function coveredSettlePanelVisible(
  job: (CoveredVisitSubject & { status?: string }) | null | undefined,
  booking: (CoveredVisitSubject & { status?: string }) | null | undefined,
): boolean {
  if (!MEMBERSHIP_SETTLEMENT_ENABLED) return false;
  if (!job || !booking) return false;
  if (job.settlementKind === "membership_covered") return false;
  if (booking.membershipWashUsed !== true) return false;
  if (booking.totalAmount !== 0 || job.totalAmount !== 0) return false;
  if (job.status === "CANCELLED" || booking.status === "CANCELLED" || booking.status === "EXPIRED") return false;
  return true;
}
