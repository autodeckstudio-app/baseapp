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

// ─── Emulator smoke test ─────────────────────────────────────────────────────
export { healthCheck } from "./functions/health.js";
