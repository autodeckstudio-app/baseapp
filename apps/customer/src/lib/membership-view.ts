// Pure view maths for the membership screens. No network, no rules: wash counts and prices come from the server's records.
import type { Membership, MembershipPlan, MembershipUsage } from "@autodeck/core";
import { ENDING_SOON_DAYS } from "./membership-rules";

type M = Pick<Membership, "status" | "washesTotal" | "washesUsed" | "endDate">;

/** Whole calendar days from `today` (YYYY-MM-DD, India) to the end date. Null when there is no end date. */
export function daysLeft(endDate: string | null, today: string): number | null {
  if (!endDate) return null;
  const a = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

export type CardState = { total: number; left: number; used: number; pct: number; days: number | null; endingSoon: boolean; ended: boolean; noWashes: boolean };

export function cardState(m: M, today: string): CardState {
  const total = Math.max(0, m.washesTotal);
  const used = Math.min(total, Math.max(0, m.washesUsed));
  const left = total - used;
  const days = daysLeft(m.endDate, today);
  const ended = m.status === "expired" || (days !== null && days < 0);
  return { total, left, used, pct: total > 0 ? Math.round((left / total) * 100) : 0, days, endingSoon: !ended && days !== null && days <= ENDING_SOON_DAYS, ended, noWashes: total > 0 && left === 0 };
}

/** "12 days left", "Ends today", "Ended". */
export function daysLabel(s: CardState): string | null {
  if (s.ended) return "Ended";
  if (s.days === null) return null;
  if (s.days === 0) return "Ends today";
  return s.days === 1 ? "1 day left" : `${s.days} days left`;
}

/** Value (paise) the member has had back. Wash credits and discounts are kept apart so nothing is overstated. */
export function valueRedeemed(usage: Pick<MembershipUsage, "usageType" | "valueRedeemed">[]): { total: number; washes: number; washValue: number; discountValue: number } {
  let washes = 0, washValue = 0, discountValue = 0;
  for (const u of usage) {
    const v = Number.isFinite(u.valueRedeemed) && u.valueRedeemed > 0 ? u.valueRedeemed : 0;
    if (u.usageType === "wash") { washes++; washValue += v; } else discountValue += v;
  }
  return { total: washValue + discountValue, washes, washValue, discountValue };
}

export type CompareCol = { id: string; name: string; price: number; washes: number; discount: number; perWash: number | null; best: boolean; current: boolean };

/** Plans side by side, cheapest first. perWash is the plan price divided by its washes, computed only for display. */
export function compareCols(plans: MembershipPlan[], currentPlanId: string | null): CompareCol[] {
  const cols = plans.filter((p) => p.active !== false).sort((a, b) => a.priceInPaise - b.priceInPaise).map((p) => ({
    id: p.id, name: p.name, price: p.priceInPaise, washes: p.includedWashes, discount: p.discountPercent,
    perWash: p.includedWashes > 0 ? Math.round(p.priceInPaise / p.includedWashes) : null, best: false, current: p.id === currentPlanId,
  }));
  const rates = cols.map((c) => c.perWash).filter((x): x is number => x !== null);
  const min = rates.length ? Math.min(...rates) : null;
  if (min !== null && new Set(rates).size > 1) for (const c of cols) c.best = c.perWash === min;
  return cols;
}

/** "5% off other services", or null when the plan has no discount (never show "0% off"). */
export function discountLine(pct: number): string | null {
  return pct > 0 ? `${pct}% off other services` : null;
}
