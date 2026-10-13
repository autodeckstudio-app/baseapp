export type StaffAccessStatus = "pending" | "approved" | "rejected";

/**
 * A signed-in person asking for studio access. Document id is the person's
 * Firebase uid, so each account has at most one request. The person writes
 * only the pending request; approval and rejection happen in the admin app.
 */
export interface StaffAccessRequest {
  uid: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string;
  status: StaffAccessStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}
