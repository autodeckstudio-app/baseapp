// Backend availability gates. Each flag names the callable(s) it waits on.
// Flip a flag to true only in the same change that ships its backend to production;
// until then the action stays hidden rather than failing against a missing function.
// resolveNoShow / previewNoShowResolution / getNoShowResolution / recordNoShowContact
export const NO_SHOW_REVIEW_ENABLED = false;
// settleMembershipCoveredJob
export const MEMBERSHIP_SETTLEMENT_ENABLED = true;
// getAccountantMoney
export const ACCOUNTANT_MONEY_ENABLED = false;
