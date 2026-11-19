export type MembershipTier = "starter" | "silver" | "gold" | "platinum";
export type MembershipStatus = "pending" | "active" | "expired" | "cancelled";

// Admin-managed template. Snapshotted onto a Membership at purchase time —
// the same catalogue/snapshot pattern as Service -> Booking/ServiceJob.
// Editing a plan never rewrites already-purchased Memberships.
export interface MembershipPlan {
  id: string;
  tenantId: string;
  tier: MembershipTier;
  name: string; // e.g. "Silver"
  priceInPaise: number; // monthly price
  includedWashes: number;
  discountPercent: number; // applied to non-wash-eligible services
  freePickups?: number; // pickup and drop requests per month whose fee is waived. Missing = 0
  prioritySlot?: boolean; // member gets the priority slot. Missing = false
  // Interior refreshes per month (vacuuming, dashboard/door-panel wipe and
  // interior glass; never shampoo or deep cleaning - owner-approved definition
  // 18 Nov 2026). A plan benefit recorded by staff against a visit job, NOT a
  // catalogue service and NOT priced against one. Missing = 0.
  includedInteriorRefreshes?: number;
  // Services this plan's included washes cover (owner-approved ladder
  // 18 Nov 2026: all washes are Regular Wash). When present, ONLY these
  // services consume a wash; the global Service.membershipWashEligible flag
  // no longer decides for purchases under this plan. Missing = legacy
  // behavior: any service with membershipWashEligible=true qualifies.
  washServiceIds?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  tenantId: string;
  customerId: string;
  planId: string; // reference only; terms below are the snapshot
  tier: MembershipTier;
  status: MembershipStatus;
  // Terms — snapshotted from MembershipPlan at purchase; immutable after activation
  washesTotal: number;
  washesUsed: number;
  discountPercent: number;
  pickupsTotal?: number; // snapshot of plan.freePickups. Missing = 0
  pickupsUsed?: number;
  prioritySlot?: boolean; // snapshot of plan.prioritySlot
  refreshesTotal?: number; // snapshot of plan.includedInteriorRefreshes. Missing = 0
  refreshesUsed?: number; // staff-recorded interior refreshes consumed this term
  // Snapshot of plan.washServiceIds. Present = only these services consume a
  // wash, regardless of the global service flag. Missing = legacy behavior
  // (Service.membershipWashEligible decides), preserving entitlements of
  // memberships bought before plan-level binding existed.
  washServiceIds?: string[];
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date
  activatedAt: string | null;
  activatedBy: string | null; // adminId
  /** Set on a plan bought as an upgrade: the active membership this one replaces when it is paid. Unused washes on that one are forfeited. */
  upgradeFromMembershipId?: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
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

/**
 * One staff-recorded interior refresh consumption. Kept OUT of the `usage`
 * subcollection on purpose: the wash/discount money paths assert exactly one
 * usage row per job (visit-membership-extras, visit-covered-cancellation), so
 * a refresh row there would break those exactness checks whenever a member
 * uses the refresh during a membership-covered wash visit. Counters live on
 * the Membership snapshot (refreshesTotal/refreshesUsed).
 */
export interface MembershipRefreshUsage {
  id: string;
  tenantId: string; // REQUIRED - tenant isolation
  membershipId: string;
  customerId: string;
  jobId: string; // the visit job the refresh was performed on
  usedAt: string;
  usedBy: string; // staff uid who recorded it
  restoredAt: string | null; // set when an admin restores the credit
  restoredBy: string | null;
}
