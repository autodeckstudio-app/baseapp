import { initializeApp } from "firebase-admin/app";

initializeApp();

// Phase 1a: Auth + Customer functions — placeholder
// export * from "./functions/auth.js";

// Phase 1b: Booking functions — placeholder
// export * from "./functions/booking.js";

// Phase 1c: Job / Studio functions — placeholder
// export * from "./functions/job.js";

// Phase 1d: Payment + Invoice functions — placeholder
// export * from "./functions/payment.js";

// Phase 1e: Admin functions — placeholder
// export * from "./functions/admin.js";

// Health check — emulator smoke test
export { healthCheck } from "./functions/health.js";
