// Read-only leg progress for the admin pickup card. Lines appear only when a leg has a recorded time. Nothing here changes status, price or payment.
type LegReq = { kind: "pickup" | "drop" | "both"; status: string; pickupCompletedAt?: string | null; dropCompletedAt?: string | null };
const ok = (v?: string | null): v is string => !!v && !Number.isNaN(new Date(v).getTime());

export function doneLegLines(r: LegReq, fmt: (iso: string) => string): [string, string][] {
  if (r.status !== "CONFIRMED" && r.status !== "DONE") return [];
  const out: [string, string][] = [];
  if (r.kind !== "drop" && ok(r.pickupCompletedAt)) out.push(["Pickup done", fmt(r.pickupCompletedAt)]);
  if (r.kind !== "pickup" && ok(r.dropCompletedAt)) out.push(["Drop done", fmt(r.dropCompletedAt)]);
  return out;
}
/** For a CONFIRMED two-leg request with one leg recorded, say which is still outstanding. Never implies delivery or payment. */
export function outstandingLegNote(r: LegReq): string | null {
  if (r.status !== "CONFIRMED" || r.kind !== "both") return null;
  const p = ok(r.pickupCompletedAt), d = ok(r.dropCompletedAt);
  if (p && !d) return "Drop still to do";
  if (d && !p) return "Pickup still to do";
  return null;
}
