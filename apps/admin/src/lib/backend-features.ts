// Backend availability gates. Each flag names the callable(s) it waits on.
// Flip a flag to true only in the same change that ships its backend to production;
// until then the action stays hidden rather than failing against a missing function.
// resolveNoShow / previewNoShowResolution / getNoShowResolution / recordNoShowContact
export const NO_SHOW_REVIEW_ENABLED = false;
// settleMembershipCoveredJob
export const MEMBERSHIP_SETTLEMENT_ENABLED = true;
// getAccountantMoney
export const ACCOUNTANT_MONEY_ENABLED = false;
// requestAdminApproval / respondToAdminApproval / adminApprovalRequests (staff ask, office decides). Provisional contract, not deployed.
export const ADMIN_APPROVAL_REVIEW_ENABLED = true;

// Local integration only, waits for coordinated receipt/cancel/report backend qualification and release.
export const OFFLINE_RECEIPT_REGISTER_ENABLED = false;

export const INVOICE_ISSUER_ENABLED = false;
export const INVOICE_PDF_ENABLED = false;
// Cash intake/review + provider reconciliation require an approved financial
// activation batch with all three callables. Preparation only, never flipped here.
export const CASH_RECONCILIATION_ENABLED = true;
