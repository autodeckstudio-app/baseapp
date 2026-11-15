/** Presentation only. Server validates consumed membership linkage before settlement/delivery. */
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
