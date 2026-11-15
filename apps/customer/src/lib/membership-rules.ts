// The studio's membership rules, in ONE place. Nothing else in the app may state a rule in words.
// CARRY_OVER_RULE: "carry" = unused washes roll over, "expire" = they lapse each cycle. Set to null to say nothing.
// The server enforces what actually happens; this only controls the words shown.
export type CarryOver = "carry" | "expire";
export const CARRY_OVER_RULE: CarryOver | null = "expire"; // owner decision, 17 Oct 2026: unused washes expire
/** Days before the end date when the card starts saying the plan is ending. */
export const ENDING_SOON_DAYS = 7;

export function carryOverLine(rule: CarryOver | null = CARRY_OVER_RULE): string | null {
  if (rule === "carry") return "Unused washes roll over to your next cycle.";
  if (rule === "expire") return "Unused washes do not roll over.";
  return null;
}
