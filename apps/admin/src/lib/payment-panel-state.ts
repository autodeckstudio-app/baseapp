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
