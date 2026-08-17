import { initializeApp } from "firebase-admin/app";

initializeApp();

// ─── Auth / Customer ─────────────────────────────────────────────────────────
export { setupCustomerProfile } from "./functions/auth/setupCustomerProfile.js";

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
export { getMyBookings } from "./functions/booking/getMyBookings.js";

// ─── Studio Jobs ──────────────────────────────────────────────────────────────
export { createWalkinJob } from "./functions/job/createWalkinJob.js";
export { advanceJobStatus } from "./functions/job/advanceJobStatus.js";
export { getStudioJobs } from "./functions/job/getStudioJobs.js";
export { assignBay } from "./functions/job/assignBay.js";

// ─── Payments ────────────────────────────────────────────────────────────────
export { initiatePayment } from "./functions/payment/initiatePayment.js";
export { confirmPaymentMock } from "./functions/payment/confirmPaymentMock.js";
export { recordManualPayment } from "./functions/payment/recordManualPayment.js";
export { getPaymentStatus } from "./functions/payment/getPaymentStatus.js";
export { initiateRefund } from "./functions/payment/initiateRefund.js";

// ─── Invoices ─────────────────────────────────────────────────────────────────
export { getInvoice } from "./functions/invoice/getInvoice.js";
export { voidInvoice } from "./functions/invoice/voidInvoice.js";

// ─── Emulator smoke test ─────────────────────────────────────────────────────
export { healthCheck } from "./functions/health.js";
