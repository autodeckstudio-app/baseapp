// Pure rules for pickup/drop leg progress. PROVISIONAL: backend contract relayed 26 Oct (updatePickupRequest markLegCompleted), not deployed.
// Marking a leg only records that the leg happened. It never delivers the car, never charges and never closes the request: "Mark done" stays a separate manual step.
export type LegName = "pickup" | "drop";
export type LegInfo = { leg: LegName; label: string; doneAt: string | null };
type LegReq = { kind: string; status: string; pickupCompletedAt?: string | null; dropCompletedAt?: string | null };

export function legsFor(r: LegReq): LegInfo[] {
  const out: LegInfo[] = [];
  if (r.kind !== "drop") out.push({ leg: "pickup", label: "Pickup", doneAt: r.pickupCompletedAt ?? null });
  if (r.kind !== "pickup") out.push({ leg: "drop", label: "Drop back", doneAt: r.dropCompletedAt ?? null });
  return out;
}
/** Only a CONFIRMED request accepts a leg mark, and only for a leg it has. The server refuses the rest. */
export function canMarkLeg(r: LegReq, leg: LegName): boolean {
  if (r.status !== "CONFIRMED") return false;
  const l = legsFor(r).find((x) => x.leg === leg);
  return !!l && l.doneAt === null;
}
/** Sent with the current status; the contract still requires status. */
export function legPayload(requestId: string, leg: LegName) {
  return { requestId, status: "CONFIRMED" as const, markLegCompleted: leg };
}
export function outstandingNote(r: LegReq): string | null {
  if (r.status !== "CONFIRMED") return null;
  const open = legsFor(r).filter((l) => l.doneAt === null);
  if (open.length === 0) return "Both legs are done. Mark the request done when you are ready.";
  if (open.length === legsFor(r).length) return null;
  return `${open.map((l) => l.label).join(" and ")} still to do.`;
}
