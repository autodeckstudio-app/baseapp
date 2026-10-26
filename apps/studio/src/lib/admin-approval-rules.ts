// Pure rules for staff requests to admin (provisional backend contract, see admin-approval.ts). A decision is recorded only; nothing is refunded, discounted or repriced.
export type AdminRequestTarget = "job" | "booking" | "pickup_request" | "none";
export type AdminRequestInput = { targetType: AdminRequestTarget; targetId?: string; reason: string; amountPaise?: number };

export const ADMIN_REQUEST_NOTE = "This asks the office to decide. It does not change any price or payment.";

export function checkAdminRequest(i: AdminRequestInput): string | null {
  if (i.reason.trim().length < 5) return "Say what you need approved, in a few words.";
  if (i.targetType !== "none" && !i.targetId) return "Pick the job, booking or pickup this is about.";
  if (i.amountPaise !== undefined && (!Number.isInteger(i.amountPaise) || i.amountPaise < 0)) return "Enter a valid amount.";
  return null;
}


export type AdminRequestDoc = {
  id: string; tenantId: string; studioId: string;
  targetType: AdminRequestTarget; targetId: string | null; reason: string;
  amountPaise: number | null; status: "pending" | "approved" | "rejected";
  responseNote?: string | null; createdAt?: { toMillis?: () => number } | string | number | null;
};

function ms(v: AdminRequestDoc["createdAt"]): number {
  if (v && typeof v === "object" && typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  return 0;
}

/** The backend query cannot order by createdAt for staff, so filter to this target and sort newest first here. */
export function requestsForTarget(all: AdminRequestDoc[], targetType: AdminRequestTarget, targetId: string): AdminRequestDoc[] {
  return all.filter((r) => r.targetType === targetType && r.targetId === targetId).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
}

/** Plain words for a decision. A decision is a record only, so the words never say anything was refunded, discounted or changed. */
export function decisionLabel(r: Pick<AdminRequestDoc, "status" | "responseNote">): { title: string; detail: string | null } {
  if (r.status === "approved") return { title: "Office said yes", detail: r.responseNote?.trim() || null };
  if (r.status === "rejected") return { title: "Office said no", detail: r.responseNote?.trim() || null };
  return { title: "Waiting for the office", detail: null };
}
