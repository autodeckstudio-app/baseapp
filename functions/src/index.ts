import { initializeApp } from "firebase-admin/app";

initializeApp();

// ─── Auth / Customer ─────────────────────────────────────────────────────────
export { setupCustomerProfile } from "./functions/auth/setupCustomerProfile.js";

// ─── Vehicle ─────────────────────────────────────────────────────────────────
export { createVehicle } from "./functions/vehicle/createVehicle.js";
export { updateVehicle } from "./functions/vehicle/updateVehicle.js";
export { archiveVehicle } from "./functions/vehicle/archiveVehicle.js";

// ─── Phase 1b+ (placeholders) ────────────────────────────────────────────────
// export * from "./functions/booking.js";
// export * from "./functions/job.js";
// export * from "./functions/payment.js";
// export * from "./functions/admin.js";

// ─── Emulator smoke test ─────────────────────────────────────────────────────
export { healthCheck } from "./functions/health.js";
