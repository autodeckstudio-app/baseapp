export type TenantPlan = "starter" | "growth" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  plan: TenantPlan;
  active: boolean;
  // Optional override for how long a pending (unpaid) membership purchase may
  // sit before the expiry sweep cancels it. Absent = MEMBERSHIP_PENDING_EXPIRY_HOURS (48).
  membershipPendingExpiryHours?: number;
  createdAt: string; // ISO timestamp
}
