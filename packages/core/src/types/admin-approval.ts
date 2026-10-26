// Staff-to-admin approval requests. DISTINCT from ApprovalRequest (job.ts):
// that flow is staff asking the CUSTOMER to authorize chargeable additional
// work on a job and is preserved unchanged. This flow is a studio staff
// member asking an ADMIN of the same tenant for a decision — e.g. an
// exception the staff role is not trusted to make alone. It carries no
// automatic financial effect: an "approved" decision is a recorded,
// audited answer, never a charge, refund, discount or price change.

export type AdminApprovalTargetType = "job" | "booking" | "pickup_request" | "none";

export type AdminApprovalStatus = "pending" | "approved" | "rejected";

export interface AdminApprovalRequest {
  id: string;
  tenantId: string;
  studioId: string;
  /** What the request is about. "none" carries no targetId. */
  targetType: AdminApprovalTargetType;
  targetId: string | null;
  /** Free-text reason from the requesting staff member. */
  reason: string;
  /**
   * Optional paise amount for context only (e.g. the cash figure in
   * question). Display context for the deciding admin — never applied to
   * any job, invoice or payment by this flow.
   */
  amountPaise: number | null;
  requestedBy: string; // uid of the studio/admin user who created it
  status: AdminApprovalStatus;
  respondedAt: string | null;
  respondedBy: string | null; // admin/superadmin uid
  responseNote: string | null;
  createdAt: string;
  updatedAt: string;
}
