// Studio-local copy of the covered-visit display label (same semantics as
// membershipCoveredLabel in @autodeck/core on later branches; kept local so
// this surgical change does not touch packages/core).
export function membershipCoveredLabel(v: {
  settlementKind?: string;
  membershipWashUsed?: boolean;
  totalAmount?: number;
}): string | null {
  return v.settlementKind === "membership_covered"
    ? "Membership-covered"
    : v.membershipWashUsed && v.totalAmount === 0
      ? "Membership-covered, not yet settled"
      : null;
}
