export type OnlinePayOutcome = "paid" | "pending" | "failed" | "refunded" | "partially_refunded" | "dismissed";

/**
 * Maps a server-settled Payment status to a terminal pay outcome, or null while
 * the payment is still in flight. Only "completed" is money captured. Full and
 * partial refunds stay DISTINCT outcomes: a full refund voids the invoice, a
 * partial one leaves obligations standing - neither is "paid", and neither may
 * be presented as settling what the customer owes.
 */
export function terminalPayOutcome(status: string | null | undefined): OnlinePayOutcome | null {
  if (status === "completed") return "paid";
  if (status === "refunded") return "refunded";
  if (status === "partially_refunded") return "partially_refunded";
  if (status === "failed" || status === "cancelled") return "failed";
  return null;
}

/**
 * Done-screen copy for an online membership payment. The payment outcome states
 * FACTS about money only. Entitlement ("stays active" vs "not active") comes
 * solely from the live membership listener, passed here as activeTier (null = no
 * active membership). Never derive entitlement from the payment outcome: a
 * failed/refunded UPGRADE payment leaves an existing membership active, and a
 * refunded payment never activates anything.
 *
 * Owner policy (Meet, 30 Oct 2026): membership refunds are always FULL, and a
 * full refund stops that membership's benefits. So with no other active
 * membership the refunded branch says the membership is not active (covers both
 * never-activated and deactivated-by-refund); the partially_refunded branch is
 * defensive only - partial membership refunds are not offered under this policy.
 */
export function membershipOnlinePayCopy(outcome: OnlinePayOutcome | null, activeTier: string | null): { title: string; body: string } {
  if (outcome === "refunded") {
    const stays = activeTier
      ? `Your current ${activeTier} membership stays active.`
      : "Any membership linked to this payment is not active.";
    return { title: "Payment refunded", body: `This payment was refunded in full. ${stays} Call the studio if you did not expect this.` };
  }
  if (outcome === "partially_refunded") {
    const stays = activeTier ? `Your current ${activeTier} membership stays active.` : "No membership was activated by it.";
    return { title: "Payment partially refunded", body: `Part of this payment was refunded. ${stays} Call the studio about this payment.` };
  }
  if (outcome === "failed") {
    return { title: "Payment failed", body: `The payment did not go through. ${activeTier ? `Your current ${activeTier} membership stays active.` : "No membership was activated by it."} Tap Pay online to try again.` };
  }
  return { title: "Almost done", body: "Complete payment to activate. Closed the payment window? Tap Pay online to reopen it. Membership activates on its own once verified - benefits stay locked until then." };
}
