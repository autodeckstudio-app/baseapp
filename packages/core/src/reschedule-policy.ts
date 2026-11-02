// Customer reschedule rules (basket item 6, adopted 2 Nov).
//
// Adopted rule: WASH services (category "washing") - one free move, up to
// 4 hours before the start; inside that window, contact the studio.
//
// The wash confirmation was wash-specific. Every other category - including
// non-wash services that happen to share the cancellation policy's "short"
// band - keeps the legacy rule (2 moves / 24h) so the adopted policy is not
// silently extended beyond what was confirmed. Unknown/missing categories
// also keep legacy behavior.
//
// Premium (pay-at-studio) services: the adopted second half of item 6 is a
// reschedule REQUEST at least 24 hours ahead with Admin approval. That flow
// is a preview capability pending migration/backward-compat review and
// activation; until it lands, premium keeps this legacy self-serve rule.
// The legacy path here is transitional, NOT the adopted final policy.
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS } from "./constants.js";

export const RESCHEDULE_WASH_MAX_COUNT = 1;
export const RESCHEDULE_WASH_CUTOFF_HOURS = 4;
export const RESCHEDULE_LEGACY_MAX_COUNT = MAX_CUSTOMER_RESCHEDULES;
export const RESCHEDULE_LEGACY_CUTOFF_HOURS = CANCELLATION_FREE_WINDOW_HOURS;

export type RescheduleRule = { maxCount: number; cutoffHours: number };

// Only the confirmed wash category gets the new rule (menu group "wash" = ["washing"]).
const WASH_CATEGORY = "washing";

export function rescheduleRule(category: string | null | undefined): RescheduleRule {
  if (category === WASH_CATEGORY) {
    return { maxCount: RESCHEDULE_WASH_MAX_COUNT, cutoffHours: RESCHEDULE_WASH_CUTOFF_HOURS };
  }
  return { maxCount: RESCHEDULE_LEGACY_MAX_COUNT, cutoffHours: RESCHEDULE_LEGACY_CUTOFF_HOURS };
}
