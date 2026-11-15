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
// "ppf" and "ceramic" are cosmetic protections a customer may self-declare
// (source "customer"); the legal/financial kinds above remain AutoDeck-entered.
export type ProtectionKind = "insurance" | "fasttag" | "puc" | "rc" | "extended_warranty" | "ppf" | "ceramic" | "other";
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
  // Who entered the record. "customer" = self-declared in the app (ppf/ceramic
  // only, never AutoDeck-verified work). Absent on older documents = entered
  // by AutoDeck/admin; treat a missing value as "autodeck".
  source?: "customer" | "autodeck";
  // Declared warranty length in whole years (e.g. PPF "5 year warranty").
  // Never used to derive an expiry on its own: without a start date there is
  // no expiry to show. Absent on older documents.
  warrantyYears?: number | null;
  // PPF coverage scope. Absent = whole-car (the only kind of record older
  // data and full-body installs have). Partial scopes ("high_impact",
  // "full_front") are never superseded by - and never supersede - a
  // full-body record; only a full-body install supersedes them.
  coverage?: "high_impact" | "full_front" | "full_body" | null;
  // Service lifecycle. Absent = "current" (all older records). "superseded"
  // and "removed" records are history: kept, never deleted, and excluded
  // from current-state displays.
  lifecycle?: "current" | "superseded" | "removed";
  installedByJobId?: string | null;
  supersededByJobId?: string | null;
  removedByJobId?: string | null;
  lifecycleAt?: string | null;
  verifiedBy: string | null; // adminId
  verifiedAt: string | null;
  notes: string | null;
  // Monotonic edit-version: starts at 1 on create, +1 per accepted update,
  // stamped inside the write transaction (wall-clock updatedAt is NOT a
  // safe version - two writes can share a millisecond). Absent on records
  // written before versioning existed; those take the explicit repair path.
  revision?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Delivery-time performed-work declaration (staff-declared, never inferred) ───
// The exact contract advanceJobStatus enforces on the DELIVERED transition:
// an explicit list of ACTUAL protection events performed on the visit. A
// purchased service is not performed work, so nothing here references a
// catalog id. [] is the explicit "no protection work of any kind"; an absent
// field means the choice was never made (the backend rejects it).
export type ProtectionCosmeticKind = "ppf" | "ceramic";
export type ProtectionCoverageScope = "full_body" | "full_front" | "high_impact";

export type ProtectionInstallSpec = {
  kind: ProtectionCosmeticKind;
  coverage: ProtectionCoverageScope;
  brand: string | null;
  warrantyYears: number | null;
};

export type ProtectionWorkEvent =
  | ({ action: "install" } & ProtectionInstallSpec)
  // Targeted events carry expectedRevision: the revision of the record the
  // staff member was looking at (legacy unversioned records are 0). The
  // backend fails closed when the record has moved on. A replace is
  // like-for-like only: same kind and same coverage scope as the target;
  // anything else must be declared as a remove plus an install.
  | ({ action: "replace"; targetProtectionId: string; expectedRevision: number } & ProtectionInstallSpec)
  | { action: "remove"; targetProtectionId: string; expectedRevision: number };
