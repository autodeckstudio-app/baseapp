export type MembershipTier = "silver" | "gold" | "platinum";
export type MembershipStatus = "pending" | "active" | "expired" | "cancelled";

export interface Membership {
  id: string;
  tenantId: string;
  customerId: string;
  tier: MembershipTier;
  status: MembershipStatus;
  washesTotal: number;
  washesUsed: number;
  discountPercent: number;
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date
  activatedAt: string | null;
  activatedBy: string | null; // adminId
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipUsage {
  id: string;
  tenantId: string; // REQUIRED — tenant isolation
  membershipId: string;
  customerId: string;
  usageType: "wash" | "discount";
  jobId: string;
  bookingId: string | null;
  valueRedeemed: number; // paise — INR value of discount or wash credit
  usedAt: string;
}
