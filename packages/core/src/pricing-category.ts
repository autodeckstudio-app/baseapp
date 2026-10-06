import type { VehicleCategory } from "./types/index.js";

// Saved cars may have no size yet. Never send null/legacy values to the
// server's strict pricing schema; keep the current, visible size selection.
export function resolvePricingCategory(value: unknown, current: VehicleCategory): VehicleCategory {
  const valid: VehicleCategory[] = ["hatchback", "sedan", "suv", "luxury", "van", "commercial"];
  return valid.includes(value as VehicleCategory) ? value as VehicleCategory : current;
}
