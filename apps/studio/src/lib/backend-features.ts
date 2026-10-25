// Backend availability gates; see apps/admin/src/lib/backend-features.ts.
// Flip a flag to true only in the same change that ships its backend to production;
// until then the action stays hidden rather than failing against a missing function.
// settleMembershipCoveredJob
export const MEMBERSHIP_SETTLEMENT_ENABLED = true;
// issueInspectionPhotoUploadUrl + updateInspection addPhotos (not deployed). Stays false until the backend release.
export const INSPECTION_PHOTOS_ENABLED = false;
// requestAdminApproval / respondToAdminApproval (not deployed). Stays false until the backend release.
export const ADMIN_APPROVAL_ENABLED = false;
// Cash or UPI choice on Record payment. recordManualPayment already accepts method "upi_manual" in source, but this stays false until the user confirms how UPI payments are verified and the backend release is coordinated.
export const UPI_RECORD_ENABLED = false;
// updatePickupRequest markLegCompleted ("pickup" | "drop"), pickupCompletedAt / dropCompletedAt. Provisional, not deployed.
export const PICKUP_LEG_PROGRESS_ENABLED = false;
