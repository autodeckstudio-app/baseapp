// Backend availability gates; see apps/admin/src/lib/backend-features.ts.
// Flip a flag to true only in the same change that ships its backend to production;
// until then the action stays hidden rather than failing against a missing function.
// settleMembershipCoveredJob
export const MEMBERSHIP_SETTLEMENT_ENABLED = true;
// issueInspectionPhotoUploadUrl + updateInspection addPhotos: backend deployed 2026-10-26
// (updateInspection-00006-kew + storage rules release incl. lower/camel metadata-key
// compatibility) and proven live end-to-end on the real tenant: signed PUT, actual
// Firebase JS SDK getBlob, attach persistence, 20-photo cap deny.
export const INSPECTION_PHOTOS_ENABLED = true;
// requestAdminApproval / respondToAdminApproval: backend deployed 2026-10-26 and proven
// live via the admin session (request -> approve, idempotent repeat, resolved-finality
// deny). The studio-role-only studioId scoping branch is emulator-verified only.
export const ADMIN_APPROVAL_ENABLED = true;
// Cash or UPI choice on Record payment. recordManualPayment accepts method "upi_manual", and the owner supplied the verified merchant QR on 27 Oct 2026 (decoded pa=9898679711@okbizaxis, pn=Autodeck, no locked amount; cropped copy at assets/brand/upi-qr.png). Owner-approved claim-only policy: staff never enter an amount or a reference and never confirm UPI themselves - the server derives the exact bill total, staff only show the QR and send the claim, and only the office marks it paid after checking the account (a claim stays pending, never paid, until then). Backend released 2026-10-28 (claim-only recordManualPayment path + office-only confirmManualPayment). Membership-desk UPI claims are NOT behind this flag; they activate with the Studio build itself.
export const UPI_RECORD_ENABLED = true;
// updatePickupRequest markLegCompleted ("pickup" | "drop"), pickupCompletedAt / dropCompletedAt.
// Backend deployed 2026-10-26. Released on emulator/source evidence only: live runtime is
// deliberately unproven because a synthetic pickup request cannot be hidden from the live
// admin pickups listener (tenant-wide query) - do not create one to test it.
export const PICKUP_LEG_PROGRESS_ENABLED = true;
