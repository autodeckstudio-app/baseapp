/**
 * Upgrade price. ONE place, used by the server callable and the app, so they cannot disagree.
 *
 * Owner rule (relayed by the parent, 18 Oct): pay only the price difference when NOTHING has been used on the current
 * plan (zero washes and zero pickups). If any wash or pickup was used, pay the full new plan price. Either way the old
 * plan ends when the upgrade is paid and unused washes and pickups are forfeited (no credit, no carry-over).
 */
export const UPGRADE_PRICING_CONFIRMED = true;

export interface UpgradePriceInput {
  currentPlanPricePaise: number;
  newPlanPricePaise: number;
  washesUsed: number;
  pickupsUsed: number;
}

/** Amount to pay in paise, or null when the new plan is not dearer (not an upgrade). */
export function upgradePricePaise(i: UpgradePriceInput): number | null {
  if (i.newPlanPricePaise <= i.currentPlanPricePaise) return null;
  const untouched = i.washesUsed === 0 && i.pickupsUsed === 0;
  return untouched ? i.newPlanPricePaise - i.currentPlanPricePaise : i.newPlanPricePaise;
}

/** True when the customer pays the full new price because something was used on the current plan. */
export function upgradePaysFullPrice(m: { washesUsed: number; pickupsUsed?: number }): boolean {
  return m.washesUsed > 0 || (m.pickupsUsed ?? 0) > 0;
}

/** Washes lost on upgrade: what is left on the current plan, never negative. */
export function washesLostOnUpgrade(m: { washesTotal: number; washesUsed: number }): number {
  return Math.max(0, m.washesTotal - m.washesUsed);
}

/** Free pickups lost on upgrade, never negative. */
export function pickupsLostOnUpgrade(m: { pickupsTotal?: number; pickupsUsed?: number }): number {
  return Math.max(0, (m.pickupsTotal ?? 0) - (m.pickupsUsed ?? 0));
}
