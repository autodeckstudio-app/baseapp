// Pure rules for the office review of staff requests. A decision is a record only: nothing is refunded, discounted, repriced or paid by deciding.
export type OfficeRequestStatus = "pending" | "approved" | "rejected";
export type OfficeRequestTarget = "job" | "booking" | "pickup_request" | "none";
export interface OfficeRequestRow {
  id: string; tenantId: string; studioId: string;
  targetType: OfficeRequestTarget; targetId: string | null;
  reason: string; amountPaise: number | null;
  requestedBy?: string; status: OfficeRequestStatus;
  respondedAt?: unknown; respondedBy?: string | null; responseNote?: string | null;
  createdAt?: unknown;
}

export const DECISION_NOTE = "This records your decision for the staff member. It does not refund, discount or change any price or payment.";
export const STATUS_WORDS: Record<OfficeRequestStatus, string> = { pending: "Waiting", approved: "Approved", rejected: "Not approved" };

function ms(v: unknown): number {
  if (v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function") return (v as { toMillis: () => number }).toMillis();
  if (typeof v === "number") return v;
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  return 0;
}
/** The tenant-only admin query has no orderBy, so newest-first happens here. */
export function sortNewestFirst(rows: OfficeRequestRow[]): OfficeRequestRow[] {
  return [...rows].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
}
export function targetLink(r: Pick<OfficeRequestRow, "targetType" | "targetId">): { href: string; label: string } | null {
  if (!r.targetId || !/^[A-Za-z0-9_-]+$/.test(r.targetId)) return r.targetType === "pickup_request" ? { href: "/pickups", label: "Open pickups" } : null;
  if (r.targetType === "job") return { href: `/jobs/${r.targetId}`, label: "Open job" };
  if (r.targetType === "booking") return { href: `/bookings/${r.targetId}`, label: "Open booking" };
  if (r.targetType === "pickup_request") return { href: "/pickups", label: "Open pickups" };
  return null;
}
export function checkDecision(decision: string, note: string): string | null {
  if (decision !== "approved" && decision !== "rejected") return "Choose approve or decline.";
  if (note.length > 300) return "Keep the note under 300 characters.";
  return null;
}
