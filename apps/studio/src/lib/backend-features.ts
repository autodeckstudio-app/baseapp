// Backend availability gates; see apps/admin/src/lib/backend-features.ts.
// Flip a flag to true only in the same change that ships its backend to production;
// until then the action stays hidden rather than failing against a missing function.
// settleMembershipCoveredJob
export const MEMBERSHIP_SETTLEMENT_ENABLED = false;
