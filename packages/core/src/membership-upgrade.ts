/**
 * Upgrade price. ONE place, used by the server callable and the app, so they cannot disagree.
 *
 * PRICING IS ON HOLD: the owner found a loophole (use every wash of the old plan, pay only the difference, get a
 * fresh dearer plan). A fix is proposed (new price minus unused washes x Rs 900) and awaits the owner's yes.
 * Until it is confirmed this still returns the plain difference. Do not deploy or ship the upgrade before it is settled.
 */
export const UPGRADE_PRICING_CONFIRMED = false;

export interface UpgradePriceInput {
  currentPlanPricePaise: number;
  newPlanPricePaise: number;
  /** Washes left on the current plan. Forfeited on upgrade. */
  unusedWashes: number;
}

/** Amount to pay in paise, or null when the new plan is not dearer (not an upgrade). */
export function upgradePricePaise(i: UpgradePriceInput): number | null {
  const d = i.newPlanPricePaise - i.currentPlanPricePaise;
  return d > 0 ? d : null;
}

/** Washes lost on upgrade: what is left on the current plan, never negative. */
export function washesLostOnUpgrade(m: { washesTotal: number; washesUsed: number }): number {
  return Math.max(0, m.washesTotal - m.washesUsed);
}
