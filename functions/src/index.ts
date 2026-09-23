import { initializeApp } from "firebase-admin/app";

initializeApp();

// ─── Auth / Customer ─────────────────────────────────────────────────────────
export { setupCustomerProfile } from "./functions/auth/setupCustomerProfile.js";
export { resolveClaims } from "./functions/auth/resolveClaims.js";

// ─── Vehicle ─────────────────────────────────────────────────────────────────
export { createVehicle } from "./functions/vehicle/createVehicle.js";
export { updateVehicle } from "./functions/vehicle/updateVehicle.js";
export { archiveVehicle } from "./functions/vehicle/archiveVehicle.js";

// ─── Service Catalogue ───────────────────────────────────────────────────────
export { getServiceCatalogue } from "./functions/service/getServiceCatalogue.js";
export { calculateServicePrice } from "./functions/service/calculatePrice.js";
export { createService } from "./functions/service/createService.js";
export { updateService } from "./functions/service/updateService.js";
export { setServiceActive } from "./functions/service/setServiceActive.js";

// ─── Booking ─────────────────────────────────────────────────────────────────
export { getAvailability } from "./functions/booking/getAvailability.js";
export { createBooking } from "./functions/booking/createBooking.js";
export { cancelBooking } from "./functions/booking/cancelBooking.js";
export { rescheduleBooking } from "./functions/booking/rescheduleBooking.js";

// ─── Studio Jobs ──────────────────────────────────────────────────────────────
export { createWalkinJob } from "./functions/job/createWalkinJob.js";
export { advanceJobStatus } from "./functions/job/advanceJobStatus.js";
export { getStudioJobs } from "./functions/job/getStudioJobs.js";
export { assignBay } from "./functions/job/assignBay.js";

// ─── Payments ────────────────────────────────────────────────────────────────
export { initiatePayment } from "./functions/payment/initiatePayment.js";
export { confirmPaymentMock } from "./functions/payment/confirmPaymentMock.js";
export { recordManualPayment } from "./functions/payment/recordManualPayment.js";
export { confirmManualPayment } from "./functions/payment/confirmManualPayment.js";
export { initiateRefund } from "./functions/payment/initiateRefund.js";

// ─── Invoices ─────────────────────────────────────────────────────────────────
export { voidInvoice } from "./functions/invoice/voidInvoice.js";

// ─── Membership ───────────────────────────────────────────────────────────────
export { createMembershipPlan } from "./functions/membership/createMembershipPlan.js";
export { updateMembershipPlan } from "./functions/membership/updateMembershipPlan.js";
export { setMembershipPlanActive } from "./functions/membership/setMembershipPlanActive.js";
export { getMembershipPlans } from "./functions/membership/getMembershipPlans.js";
export { purchaseMembership } from "./functions/membership/purchaseMembership.js";
export { activateMembership } from "./functions/membership/activateMembership.js";
export { cancelMembership } from "./functions/membership/cancelMembership.js";
export { getMyMemberships } from "./functions/membership/getMyMemberships.js";
export { getMembershipUsage } from "./functions/membership/getMembershipUsage.js";
export { expireStaleMemberships } from "./functions/membership/expireStaleMemberships.js";
export { expireStaleMembershipsScheduled } from "./functions/membership/expireStaleMembershipsScheduled.js";

// ─── Studio Settings (Admin) ────────────────────────────────────────────────
export { updateStudioSettings } from "./functions/studio/updateStudioSettings.js";
export { addHoliday } from "./functions/studio/addHoliday.js";
export { removeHoliday } from "./functions/studio/removeHoliday.js";
export { upsertBay } from "./functions/studio/upsertBay.js";

// ─── Staff (Admin) ───────────────────────────────────────────────────────────
export { addStaffMember } from "./functions/employee/addStaffMember.js";
export { updateStaffRole } from "./functions/employee/updateStaffRole.js";
export { deactivateStaffMember } from "./functions/employee/deactivateStaffMember.js";

// ─── Approvals (Phase 3) ──────────────────────────────────────────────────────
export { createApproval } from "./functions/approval/createApproval.js";
export { respondToApproval } from "./functions/approval/respondToApproval.js";
export { cancelApproval } from "./functions/approval/cancelApproval.js";
export { expireStaleApprovals } from "./functions/approval/expireStaleApprovals.js";
export { expireStaleApprovalsScheduled } from "./functions/approval/expireStaleApprovalsScheduled.js";

// ─── Protection (Phase 2D) ──────────────────────────────────────────────────
export { createProtection } from "./functions/protection/createProtection.js";
export { updateProtection } from "./functions/protection/updateProtection.js";

// ─── Inspection (Phase 4) ───────────────────────────────────────────────────
export { startInspection } from "./functions/inspection/startInspection.js";
export { updateInspection } from "./functions/inspection/updateInspection.js";
export { finalizeInspection } from "./functions/inspection/finalizeInspection.js";

// ─── Notifications ────────────────────────────────────────────────────────────
export { onAuditLogCreated } from "./functions/notification/onAuditLogCreated.js";
export { markNotificationRead } from "./functions/notification/markNotificationRead.js";

// ─── Admin-only smoke test (deployed in every environment, not emulator-only —
// see functions/src/functions/health.ts) ───────────────────────────────────
export { healthCheck } from "./functions/health.js";
