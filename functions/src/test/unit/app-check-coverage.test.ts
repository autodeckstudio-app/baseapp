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
//  2. Every callable classified DEFERRED does NOT contain any
//     `enforceAppCheck` wiring — so a future PR that starts enforcing App
//     Check on a customer/studio-reachable callable (which would silently
//     break every mobile client, since neither Expo app has any App Check
//     provider — see the Batch 3 report) MUST touch this test and move the
//     file to ENFORCED as a conscious act, not slip in unnoticed.
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
// to "admin"/"superadmin", or — for health.ts — no auth check at all, which
// makes App Check the only protection available). Only the admin web app
// calls any of these, and the admin app gets a genuine free App Check
// provider (ReCaptchaV3Provider) with no native/EAS blocker.
const ENFORCED = [
  "approval/expireStaleApprovals.ts",
  "employee/addStaffMember.ts",
  "employee/deactivateStaffMember.ts",
  "employee/updateStaffRole.ts",
  "health.ts",
  "invoice/voidInvoice.ts",
  "membership/activateMembership.ts",
  "membership/cancelMembership.ts",
  "membership/createMembershipPlan.ts",
  "membership/expireStaleMemberships.ts",
  "membership/setMembershipPlanActive.ts",
  "membership/updateMembershipPlan.ts",
  "payment/initiateRefund.ts",
  "protection/createProtection.ts",
  "protection/updateProtection.ts",
  "service/createService.ts",
  "service/setServiceActive.ts",
  "service/updateService.ts",
  "studio/addHoliday.ts",
  "studio/removeHoliday.ts",
  "studio/updateStudioSettings.ts",
  "studio/upsertBay.ts",
].sort();

// Not an onCall callable at all — a Firestore trigger (onDocumentCreated).
// App Check has no meaning for background triggers; there is no client
// request to attach a token to.
const EXCLUDED_NON_CALLABLE = ["notification/onAuditLogCreated.ts"].sort();

// Reachable by the customer and/or studio Expo apps. Deliberately NOT
// enforced yet: neither Expo app has a working App Check provider without a
// native/EAS Build migration (@react-native-firebase/app-check + Play
// Integrity + DeviceCheck/App Attest config) — see the Batch 3 stop report.
// Enforcing App Check on any of these today would reject 100% of genuine
// mobile traffic, since no client here can produce a valid token.
const DEFERRED = [
  "approval/cancelApproval.ts",
  "approval/createApproval.ts",
  "approval/respondToApproval.ts",
  "auth/setupCustomerProfile.ts",
  "booking/cancelBooking.ts",
  "booking/createBooking.ts",
  "booking/getAvailability.ts",
  "booking/rescheduleBooking.ts",
  "inspection/finalizeInspection.ts",
  "inspection/startInspection.ts",
  "inspection/updateInspection.ts",
  "job/advanceJobStatus.ts",
  "job/assignBay.ts",
  "job/createWalkinJob.ts",
  "job/getStudioJobs.ts",
  "membership/getMembershipPlans.ts",
  "membership/getMembershipUsage.ts",
  "membership/getMyMemberships.ts",
  "membership/purchaseMembership.ts",
  "notification/markNotificationRead.ts",
  "payment/confirmManualPayment.ts",
  "payment/confirmPaymentMock.ts",
  "payment/initiatePayment.ts",
  "payment/recordManualPayment.ts",
  "service/calculatePrice.ts",
  "service/getServiceCatalogue.ts",
  "vehicle/archiveVehicle.ts",
  "vehicle/createVehicle.ts",
  "vehicle/updateVehicle.ts",
].sort();

describe("Phase 5B P1-13: App Check coverage", () => {
  it("classification lists are complete and disjoint against the real filesystem", () => {
    const actualFiles = listTsFilesRecursive(FUNCTIONS_DIR);
    const classified = [...ENFORCED, ...EXCLUDED_NON_CALLABLE, ...DEFERRED].sort();

    const classifiedSet = new Set(classified);
    expect(classifiedSet.size).toBe(classified.length); // no duplicates across lists

    const actualSet = new Set(actualFiles);
    const missingFromClassification = actualFiles.filter((f) => !classifiedSet.has(f));
    const classifiedButMissingOnDisk = classified.filter((f) => !actualSet.has(f));

    expect(missingFromClassification, "found on disk but not classified in this test — classify it as ENFORCED, DEFERRED, or EXCLUDED_NON_CALLABLE").toEqual([]);
    expect(classifiedButMissingOnDisk, "classified in this test but no longer exists on disk — remove it from the classification").toEqual([]);
  });

  it.each(ENFORCED)("%s enforces App Check via shouldEnforceAppCheck()", (relPath) => {
    const source = readFileSync(join(FUNCTIONS_DIR, relPath), "utf8");
    expect(source).toContain("enforceAppCheck: shouldEnforceAppCheck()");
    expect(source).toMatch(/import\s*\{\s*shouldEnforceAppCheck\s*\}\s*from\s*["'].*lib\/environment\.js["']/);
  });

  it.each(DEFERRED)("%s does NOT enforce App Check yet (no mobile App Check provider exists)", (relPath) => {
    const source = readFileSync(join(FUNCTIONS_DIR, relPath), "utf8");
    expect(source).not.toContain("enforceAppCheck");
  });

  it.each(EXCLUDED_NON_CALLABLE)("%s is not an onCall callable", (relPath) => {
    const source = readFileSync(join(FUNCTIONS_DIR, relPath), "utf8");
    expect(source).not.toMatch(/\bonCall\(/);
  });
});
