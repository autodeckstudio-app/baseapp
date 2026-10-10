import { initializeApp } from "firebase-admin/app";

initializeApp();

// âââ Auth / Customer âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { setupCustomerProfile } from "./functions/auth/setupCustomerProfile.js";
export { resolveClaims } from "./functions/auth/resolveClaims.js";

// âââ Vehicle âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { createVehicle } from "./functions/vehicle/createVehicle.js";
export { updateVehicle } from "./functions/vehicle/updateVehicle.js";
export { archiveVehicle } from "./functions/vehicle/archiveVehicle.js";
export { restoreVehicle } from "./functions/vehicle/restoreVehicle.js";
export { deleteVehicle } from "./functions/vehicle/deleteVehicle.js";
export { createWalkinCustomer } from "./functions/auth/createWalkinCustomer.js";
export { submitReview } from "./functions/booking/submitReview.js";
export { publishVehiclePhoto } from "./functions/vehicle/publishVehiclePhoto.js";
export { issueVehiclePhotoUploadUrl } from "./functions/vehicle/issueVehiclePhotoUploadUrl.js";

// âââ Service Catalogue âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { getServiceCatalogue } from "./functions/service/getServiceCatalogue.js";
export { calculateServicePrice } from "./functions/service/calculatePrice.js";
export { createService } from "./functions/service/createService.js";
export { updateService } from "./functions/service/updateService.js";
export { setServiceActive } from "./functions/service/setServiceActive.js";

// âââ Booking âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { getAvailability } from "./functions/booking/getAvailability.js";
export { getStudioInfo } from "./functions/studio/getStudioInfo.js";
export { createBooking } from "./functions/booking/createBooking.js";
export { cancelBooking } from "./functions/booking/cancelBooking.js";
export { rescheduleBooking } from "./functions/booking/rescheduleBooking.js";

// âââ Studio Jobs ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { createWalkinJob } from "./functions/job/createWalkinJob.js";
export { advanceJobStatus } from "./functions/job/advanceJobStatus.js";
export { getStudioJobs } from "./functions/job/getStudioJobs.js";
export { assignBay } from "./functions/job/assignBay.js";

// âââ Payments ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { initiatePayment } from "./functions/payment/initiatePayment.js";
export { confirmPaymentMock } from "./functions/payment/confirmPaymentMock.js";
export { recordManualPayment } from "./functions/payment/recordManualPayment.js";
export { confirmManualPayment } from "./functions/payment/confirmManualPayment.js";
export { initiateRefund } from "./functions/payment/initiateRefund.js";

// âââ Invoices âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { voidInvoice } from "./functions/invoice/voidInvoice.js";

// âââ Membership âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { createMembershipPlan } from "./functions/membership/createMembershipPlan.js";
export { updateMembershipPlan } from "./functions/membership/updateMembershipPlan.js";
export { setMembershipPlanActive } from "./functions/membership/setMembershipPlanActive.js";
export { getMembershipPlans } from "./functions/membership/getMembershipPlans.js";
export { purchaseMembership } from "./functions/membership/purchaseMembership.js";
export { confirmMembershipPayment } from "./functions/membership/confirmMembershipPayment.js";
export { createWalkinMembership } from "./functions/membership/createWalkinMembership.js";
export { activateMembership } from "./functions/membership/activateMembership.js";
export { cancelMembership } from "./functions/membership/cancelMembership.js";
export { getMyMemberships } from "./functions/membership/getMyMemberships.js";
export { getMembershipUsage } from "./functions/membership/getMembershipUsage.js";
export { expireStaleMemberships } from "./functions/membership/expireStaleMemberships.js";
export { expireStalePendingMembershipsScheduled } from "./functions/membership/expireStalePendingMembershipsScheduled.js";
export { cancelAccountDeletion } from "./functions/auth/cancelAccountDeletion.js";
export { processAccountDeletionsScheduled } from "./functions/auth/processAccountDeletionsScheduled.js";
export { expireStaleMembershipsScheduled } from "./functions/membership/expireStaleMembershipsScheduled.js";

// âââ Studio Settings (Admin) ââââââââââââââââââââââââââââââââââââââââââââââââ
export { updateStudioSettings } from "./functions/studio/updateStudioSettings.js";
export { addHoliday } from "./functions/studio/addHoliday.js";
export { removeHoliday } from "./functions/studio/removeHoliday.js";
export { upsertBay } from "./functions/studio/upsertBay.js";

// âââ Staff (Admin) âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { addStaffMember } from "./functions/employee/addStaffMember.js";
export { updateStaffRole } from "./functions/employee/updateStaffRole.js";
export { deactivateStaffMember } from "./functions/employee/deactivateStaffMember.js";

// âââ Approvals (Phase 3) ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { createApproval } from "./functions/approval/createApproval.js";
export { respondToApproval } from "./functions/approval/respondToApproval.js";
export { setBookingQuote } from "./functions/booking/setBookingQuote.js";
export { respondToBookingQuote } from "./functions/booking/respondToBookingQuote.js";
export { cancelApproval } from "./functions/approval/cancelApproval.js";
export { expireStaleApprovals } from "./functions/approval/expireStaleApprovals.js";
export { expireStaleApprovalsScheduled } from "./functions/approval/expireStaleApprovalsScheduled.js";
export { flagMissedBookingsScheduled } from "./functions/booking/flagMissedBookingsScheduled.js";

// âââ Protection (Phase 2D) ââââââââââââââââââââââââââââââââââââââââââââââââââ
export { createProtection } from "./functions/protection/createProtection.js";
export { updateProtection } from "./functions/protection/updateProtection.js";

// âââ Inspection (Phase 4) âââââââââââââââââââââââââââââââââââââââââââââââââââ
export { startInspection } from "./functions/inspection/startInspection.js";
export { updateInspection } from "./functions/inspection/updateInspection.js";
export { finalizeInspection } from "./functions/inspection/finalizeInspection.js";

// âââ Attendance (M6 Automodz Office) ââââââââââââââââââââââââââââââââââââââââ
export { checkInAttendance } from "./functions/attendance/checkInAttendance.js";
export { checkOutAttendance } from "./functions/attendance/checkOutAttendance.js";
export { startAttendanceBreak } from "./functions/attendance/startAttendanceBreak.js";
export { endAttendanceBreak } from "./functions/attendance/endAttendanceBreak.js";
export { getStudioAttendance } from "./functions/attendance/getStudioAttendance.js";
export { getEmployeeAttendance } from "./functions/attendance/getEmployeeAttendance.js";
export { markAttendance } from "./functions/attendance/markAttendance.js";

// âââ Expenses (M6 Automodz Office) âââââââââââââââââââââââââââââââââââââââââ
export { createExpense } from "./functions/expense/createExpense.js";
export { updateExpense } from "./functions/expense/updateExpense.js";
export { deleteExpense } from "./functions/expense/deleteExpense.js";
export { listExpenses } from "./functions/expense/listExpenses.js";

// âââ Inventory (M6 Automodz Office) âââââââââââââââââââââââââââââââââââââââââ
export { addInventoryItem } from "./functions/inventory/addInventoryItem.js";
export { updateInventoryItem } from "./functions/inventory/updateInventoryItem.js";
export { recordInventoryTxn } from "./functions/inventory/recordInventoryTxn.js";
export { listInventoryItems } from "./functions/inventory/listInventoryItems.js";
export { listInventoryTxns } from "./functions/inventory/listInventoryTxns.js";

// âââ Papers verification (M6 Automodz Office) ââââââââââââââââââââââââââââââ
export { submitPaper } from "./functions/papers/submitPaper.js";
export { reviewPaper } from "./functions/papers/reviewPaper.js";
export { updatePaper } from "./functions/papers/updatePaper.js";
export { listPapers } from "./functions/papers/listPapers.js";
export { submitMyPaper } from "./functions/papers/submitMyPaper.js";
export { getServiceReviews } from "./functions/booking/getServiceReviews.js";

// âââ Daily Close (M6 Automodz Office) ââââââââââââââââââââââââââââââââââââââ
export { performDailyClose } from "./functions/dailyclose/performDailyClose.js";
export { getDailyClose } from "./functions/dailyclose/getDailyClose.js";

// âââ Gallery (M6 Automodz Office) ââââââââââââââââââââââââââââââââââââââââââ
export { addGalleryImage } from "./functions/gallery/addGalleryImage.js";
export { updateGalleryImage } from "./functions/gallery/updateGalleryImage.js";
export { deleteGalleryImage } from "./functions/gallery/deleteGalleryImage.js";
export { listGalleryImages } from "./functions/gallery/listGalleryImages.js";

// âââ Stories (24h photo/video circles + permanent highlights) ââââââââââââââ
export { issueStoryUploadUrl } from "./functions/story/issueStoryUploadUrl.js";
export { createStory } from "./functions/story/createStory.js";
export { updateStory } from "./functions/story/updateStory.js";
export { listStories } from "./functions/story/listStories.js";

// âââ Office dashboard & reports (M6 Automodz Office) âââââââââââââââââââââââ
export { getOfficeDashboard } from "./functions/office/getOfficeDashboard.js";
export { getOfficeReport } from "./functions/office/getOfficeReport.js";

// âââ Notifications ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export { onAuditLogCreated } from "./functions/notification/onAuditLogCreated.js";
export { markNotificationRead } from "./functions/notification/markNotificationRead.js";

// âââ Admin-only smoke test (deployed in every environment, not emulator-only â
// see functions/src/functions/health.ts) âââââââââââââââââââââââââââââââââââ
export { healthCheck } from "./functions/health.js";

// âââ Cars for sale (studio stock + customer submissions behind approval) âââ
export { issueListingPhotoUploadUrl, adminSaveListing, submitMyListing, reviewListing, markMyListingSold, listCarListings, expressInterest, listCarLeads, setCarLeadStatus } from "./functions/carsale/carsale.js";

// âââ Push (web, OFF until PUSH_ENABLED=true) ââââââââââââââââââââââââââââââââââ
export { registerPushToken } from "./functions/push/registerPushToken.js";
export { onNotificationPush } from "./functions/push/onNotificationPush.js";
export { requestPickupDrop, updatePickupRequest } from "./functions/booking/pickupRequests.js";
export { requestAccountDeletion } from "./functions/auth/requestAccountDeletion.js";

export { standbyBooking } from "./functions/job/standbyBooking.js";
