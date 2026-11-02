// Phase 5B P1-13 coverage meta-test.
//
// enforceAppCheck is NOT exposed on the built onCall function object at
// runtime (it's consumed internally by the Functions Framework/options
// builder and never copied onto func.__endpoint or func.__trigger — verified
// by inspecting node_modules/firebase-functions/lib/v2/providers/https.js
// and options.js). There is therefore no way to assert "this callable
// enforces App Check" by importing it and introspecting an object. The only
// honest way to test this is to read each function's own source text and
// check for the literal enforcement wiring — this file does exactly that,
// against the real functions/src/functions directory on disk, so it can
// never silently drift from what's actually deployed.
//
// This test enforces three separate guarantees:
//  1. Every callable classified ENFORCED actually contains
//     `enforceAppCheck: shouldEnforceAppCheck()` in its onCall() options.
//  2. Every callable classified NEVER_PUBLIC carries NO `enforceAppCheck`
//     wiring, with a guest-surface rationale. Everything else is ENFORCED:
//     the flag is wired but inert while shouldEnforceAppCheck() is false
//     (APP_CHECK_ENFORCE unset). Setting that env on an unsampled service
//     before the customer/studio apps ship attestation providers rejects
//     100% of genuine mobile traffic - the staged rollout (monitor mode,
//     client attestation, then env per service) is approval-gated.
//  3. The three classification lists (ENFORCED / EXCLUDED_NON_CALLABLE /
//     DEFERRED) are complete and disjoint against the real file listing —
//     so a brand-new function file is forced to be classified here before
//     this test will pass, instead of silently landing with no App Check
//     decision made at all.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FUNCTIONS_DIR = join(__dirname, "../../functions");

function listTsFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listTsFilesRecursive(full));
    } else if (entry.endsWith(".ts")) {
      files.push(relative(FUNCTIONS_DIR, full).split("\\").join("/"));
    }
  }
  return files.sort();
}

// Admin-only callables (verified via assertRole/role-array checks restricted
// to "admin"/"superadmin" — health.ts included; a Batch 3 hardening review
// found it had NO auth check at all despite its own comment and a Phase 3D
// rate-limit-exemption comment both assuming it required authentication,
// fixed in Batch 4 by adding the same assertRole check every other function
// in this list already has). Only the admin web app calls any of these, and
// the admin app gets a genuine free App Check provider (ReCaptchaV3Provider)
// with no native/EAS blocker.
const ENFORCED = [
  "approval/cancelApproval.ts",
  "approval/createApproval.ts",
  "approval/expireStaleApprovals.ts",
  "approval/requestAdminApproval.ts",
  "approval/respondToAdminApproval.ts",
  "approval/respondToApproval.ts",
  "attendance/checkInAttendance.ts",
  "attendance/checkOutAttendance.ts",
  "attendance/endAttendanceBreak.ts",
  "attendance/getEmployeeAttendance.ts",
  "attendance/getStudioAttendance.ts",
  "attendance/markAttendance.ts",
  "attendance/startAttendanceBreak.ts",
  "auth/cancelAccountDeletion.ts",
  "auth/createWalkinCustomer.ts",
  "auth/requestAccountDeletion.ts",
  "auth/resolveClaims.ts",
  "auth/setupCustomerProfile.ts",
  "auth/updateCustomerContact.ts",
  "booking/adminCancelBooking.ts",
  "booking/cancelBooking.ts",
  "booking/createBooking.ts",
  "booking/getAvailability.ts",
  "booking/getServiceReviews.ts",
  "booking/noShowReview.ts",
  "booking/pickupRequests.ts",
  "booking/purgeTestBookings.ts",
  "booking/decideBookingRescheduleRequest.ts",
  "booking/requestBookingReschedule.ts",
  "booking/rescheduleBooking.ts",
  "booking/respondToBookingQuote.ts",
  "booking/setBookingQuote.ts",
  "booking/submitReview.ts",
  "carsale/carsale.ts",
  "customer/licensePhoto.ts",
  "customer/recordWebVital.ts",
  "dailyclose/getDailyClose.ts",
  "dailyclose/performDailyClose.ts",
  "employee/addStaffMember.ts",
  "employee/deactivateStaffMember.ts",
  "employee/updateStaffRole.ts",
  "expense/createExpense.ts",
  "expense/deleteExpense.ts",
  "expense/listExpenses.ts",
  "expense/updateExpense.ts",
  "files/getPrivateFileUrl.ts",
  "gallery/addGalleryImage.ts",
  "gallery/deleteGalleryImage.ts",
  "gallery/listGalleryImages.ts",
  "gallery/updateGalleryImage.ts",
  "gift/gift.ts",
  "health.ts",
  "inspection/finalizeInspection.ts",
  "inspection/issueInspectionPhotoUploadUrl.ts",
  "inspection/startInspection.ts",
  "inspection/updateInspection.ts",
  "inventory/addInventoryItem.ts",
  "inventory/listInventoryItems.ts",
  "inventory/listInventoryTxns.ts",
  "inventory/recordInventoryTxn.ts",
  "inventory/updateInventoryItem.ts",
  "invoice/voidInvoice.ts",
  "job/advanceJobStatus.ts",
  "job/assignBay.ts",
  "job/cancelWalkinJob.ts",
  "job/createWalkinJob.ts",
  "job/getStudioJobs.ts",
  "job/settleMembershipCoveredJob.ts",
  "job/standbyBooking.ts",
  "membership/activateMembership.ts",
  "membership/cancelMembership.ts",
  "membership/confirmMembershipPayment.ts",
  "membership/createMembershipPlan.ts",
  "membership/createWalkinMembership.ts",
  "membership/expireStaleMemberships.ts",
  "membership/getMembershipPlans.ts",
  "membership/getMembershipUsage.ts",
  "membership/getMyMemberships.ts",
  "membership/purchaseMembership.ts",
  "membership/setMembershipPlanActive.ts",
  "membership/updateMembershipPlan.ts",
  "membership/upgradeMembership.ts",
  "notification/markNotificationRead.ts",
  "offer/createOffer.ts",
  "offer/issueOfferUploadUrl.ts",
  "offer/listOffers.ts",
  "offer/updateOffer.ts",
  "office/getAccountantMoney.ts",
  "office/getOfficeDashboard.ts",
  "office/getOfficeReport.ts",
  "papers/listPapers.ts",
  "papers/myPaperEdits.ts",
  "papers/reviewPaper.ts",
  "papers/submitMyPaper.ts",
  "papers/submitPaper.ts",
  "papers/updatePaper.ts",
  "payment/confirmManualPayment.ts",
  "payment/confirmPaymentMock.ts",
  "payment/createCheckoutOrder.ts",
  "payment/initiatePayment.ts",
  "payment/initiateRefund.ts",
  "payment/listRefundWork.ts",
  "payment/processRefundOutbox.ts",
  "payment/reconcileRefundClaims.ts",
  "payment/recordManualPayment.ts",
  "payment/requestBookingRefund.ts",
  "payment/settleManualRefund.ts",
  "payment/verifyCheckoutPayment.ts",
  "protection/createMyProtection.ts",
  "protection/createProtection.ts",
  "protection/updateMyProtection.ts",
  "protection/updateProtection.ts",
  "push/registerPushToken.ts",
  "service/calculatePrice.ts",
  "service/createService.ts",
  "service/getServiceCatalogue.ts",
  "service/setServiceActive.ts",
  "service/updateService.ts",
  "story/createStory.ts",
  "story/deleteStory.ts",
  "story/issueStoryUploadUrl.ts",
  "story/listStories.ts",
  "story/updateStory.ts",
  "studio/addHoliday.ts",
  "studio/getStudioInfo.ts",
  "studio/removeHoliday.ts",
  "studio/updateStudioSettings.ts",
  "studio/upsertBay.ts",
  "vehicle/archiveVehicle.ts",
  "vehicle/createVehicle.ts",
  "vehicle/deleteVehicle.ts",
  "vehicle/issueVehiclePhotoUploadUrl.ts",
  "vehicle/publishVehiclePhoto.ts",
  "vehicle/removeMyVehicleImage.ts",
  "vehicle/restoreVehicle.ts",
  "vehicle/updateVehicle.ts",
].sort();

// Not an onCall callable at all — a Firestore trigger (onDocumentCreated)
// or, as of Phase 5C Batch 1, a time-triggered onSchedule function. App
// Check has no meaning for either: there is no client request to attach a
// token to, and onSchedule functions have no public invocation endpoint at
// all (unlike onCall/onRequest) — they cannot become publicly callable
// regardless of App Check.
const EXCLUDED_NON_CALLABLE = [
  "approval/expireStaleApprovalsScheduled.ts",
  "booking/flagMissedBookingsScheduled.ts",
  "membership/expireStaleMembershipsScheduled.ts",
  "membership/expireStalePendingMembershipsScheduled.ts",
  "booking/expirePendingBookingsScheduled.ts",
  "notification/onAuditLogCreated.ts",
  "notification/winbackScheduled.ts",
  "notification/bookingRemindersScheduled.ts",
  "notification/expiryRemindersScheduled.ts",
  "push/onNotificationPush.ts",
  "auth/processAccountDeletionsScheduled.ts",
  "carsale/listing-photo.ts", // public onRequest (anonymous photo GETs), like razorpayWebhook: App Check cannot apply
  "payment/razorpayWebhook.ts",
].sort();

// Public surfaces that must NEVER enforce App Check: the caller is a guest
// with no sign-in and no attestation-capable client (guest storefront
// ordering). Every other callable requires auth in code today - including
// the read paths an earlier review note called "public/guest"
// (getMembershipPlans, getMyMemberships, getServiceCatalogue, getStudioInfo,
// getAvailability): they call extractUser and reject anonymous calls, so
// once the apps attest they can enforce like everything else. Webhooks and
// non-callable triggers are EXCLUDED_NON_CALLABLE above.
const NEVER_PUBLIC = [
  "shop/placeGuestOrder.ts",
].sort();

describe("Phase 5B P1-13: App Check coverage", () => {
  it("classification lists are complete and disjoint against the real filesystem", () => {
    const actualFiles = listTsFilesRecursive(FUNCTIONS_DIR);
    const classified = [...ENFORCED, ...EXCLUDED_NON_CALLABLE, ...NEVER_PUBLIC].sort();

    const classifiedSet = new Set(classified);
    expect(classifiedSet.size).toBe(classified.length); // no duplicates across lists

    const actualSet = new Set(actualFiles);
    const missingFromClassification = actualFiles.filter((f) => !classifiedSet.has(f));
    const classifiedButMissingOnDisk = classified.filter((f) => !actualSet.has(f));

    expect(missingFromClassification, "found on disk but not classified in this test — classify it as ENFORCED, NEVER_PUBLIC, or EXCLUDED_NON_CALLABLE").toEqual([]);
    expect(classifiedButMissingOnDisk, "classified in this test but no longer exists on disk — remove it from the classification").toEqual([]);
  });

  it.each(ENFORCED)("%s enforces App Check via shouldEnforceAppCheck()", (relPath) => {
    const source = readFileSync(join(FUNCTIONS_DIR, relPath), "utf8");
    expect(source).toContain("enforceAppCheck: shouldEnforceAppCheck()");
    expect(source).toMatch(/import\s*\{\s*shouldEnforceAppCheck\s*\}\s*from\s*["'].*lib\/environment\.js["']/);
  });

  it.each(NEVER_PUBLIC)("%s never enforces App Check (guest surface, no attestation-capable client)", (relPath) => {
    const source = readFileSync(join(FUNCTIONS_DIR, relPath), "utf8");
    expect(source).not.toContain("enforceAppCheck");
  });

  it.each(EXCLUDED_NON_CALLABLE)("%s is not an onCall callable", (relPath) => {
    const source = readFileSync(join(FUNCTIONS_DIR, relPath), "utf8");
    expect(source).not.toMatch(/\bonCall\(/);
  });
});
