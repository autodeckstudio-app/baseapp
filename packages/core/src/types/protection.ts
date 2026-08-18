// Legal/financial vehicle protections — insurance, FastTag, PUC, RC, extended
// warranty declarations — distinct from AutoDeck service Warranty records
// (doc06 §6.2 Protection). Exact shape per doc06, with one addition:
// `tenantId` is required on every tenant-scoped document per the
// cross-cutting multi-tenant rule (doc19 §19.2) even though doc06's original
// per-entity sketch omitted it — matching the same tenantId-on-subcollection
// pattern already used for MembershipUsage.
//
// Phase 2D decision: unlike doc06's Ownership Matrix ("Customer: CF
// (declare)"), this build's approved security model makes Protection
// admin/Cloud-Function-created only — customers have read-only access, no
// self-declare flow. See Phase 2D HANDOFF for the explicit instruction this
// follows.
export type ProtectionKind = "insurance" | "fasttag" | "puc" | "rc" | "extended_warranty" | "other";
export type ProtectionStatus = "unverified" | "verified" | "expired";

export interface Protection {
  id: string;
  tenantId: string;
  vehicleId: string;
  customerId: string;
  kind: ProtectionKind;
  provider: string | null;
  policyNumber: string | null;
  startDate: string | null; // ISO date
  expiryDate: string | null; // ISO date
  documentUrl: string | null; // Storage signed URL — V2+; null in this build
  status: ProtectionStatus;
  verifiedBy: string | null; // adminId
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
