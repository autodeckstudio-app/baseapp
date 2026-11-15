// Read-only: which legs the studio has recorded as done. Rows appear only when a timestamp is present, so older requests render exactly as before.
// This never implies the car is delivered or paid for. Those stay separate steps.
type LegReq = { kind: "pickup" | "drop" | "both"; status: string; pickupCompletedAt?: string | null; dropCompletedAt?: string | null };

export function completedLegRows(r: LegReq): { title: string; at: string }[] {
  if (r.status !== "CONFIRMED" && r.status !== "DONE") return [];
  const rows: { title: string; at: string }[] = [];
  if (r.kind !== "drop" && r.pickupCompletedAt && !Number.isNaN(new Date(r.pickupCompletedAt).getTime())) rows.push({ title: "Car picked up", at: r.pickupCompletedAt });
  if (r.kind !== "pickup" && r.dropCompletedAt && !Number.isNaN(new Date(r.dropCompletedAt).getTime())) rows.push({ title: "Car dropped back", at: r.dropCompletedAt });
  return rows;
}
