// Vehicle categories (doc06 §6.2 Vehicle): used for pricing differentials across services.
export type VehicleCategory =
  | "hatchback"
  | "sedan"
  | "suv"
  | "luxury"
  | "commercial"
  | "van";

// Service categories (doc06 §6.2 Service)
export type ServiceCategory =
  | "ppf"
  | "ceramic"
  | "washing"
  | "coating"
  | "inspection"
  | "tinting"
  | "other";

export type BayType = "wash" | "protection" | "general";

// Per-vehicle-category price and duration adjustment embedded in a Service document.
// Keeps pricing co-located with the service template; V1 has at most 6 entries (one per category).
export interface VehicleCategoryPricing {
  vehicleCategory: VehicleCategory;
  additionalPricePaise: number; // non-negative integer; SUVs/luxury cost more than hatchbacks
  additionalMinutes: number; // non-negative integer
}

// Service catalogue entry. Written by admin only. This is a TEMPLATE — completed jobs
// snapshot relevant fields at creation time. Never re-read this for historical records.
// (doc06 §6.2 Service + §6.4 Historical Truth Rule 9)
// Phase 2D.1: the structured half of doc06's warrantyTemplate, deferred at
// V1 launch. Admin-configured only — never inferred or computed. null means
// "no fixed term" (distinct from 'lifetime', which is an explicit term).
export type WarrantyDurationUnit = "days" | "months" | "years" | "lifetime";

export interface Service {
  id: string;
  tenantId: string; // tenant isolation key (not in doc06 spec but architecturally required)
  name: string; // e.g. "LLumar Gloss PPF"
  category: ServiceCategory;
  brand: string | null; // e.g. "LLumar", "Kovalent"
  description: string;
  basePrice: number; // paise (INR * 100); never decimal; minimum billable for any vehicle
  currency: string; // ISO 4217 — "INR" for V1
  estimatedDurationMinutes: number;
  warrantyLabel: string | null; // e.g. "5-year film warranty"
  // Structured duration — paired with warrantyLabel, read once at job seal
  // and snapshotted onto the issued Warranty (see warranty-builder.ts).
  // Both null = unconfigured; unit 'lifetime' always yields a null Warranty
  // endDate regardless of warrantyDurationValue.
  warrantyDurationValue: number | null;
  warrantyDurationUnit: WarrantyDurationUnit | null;
  vehicleCategoryPricing: VehicleCategoryPricing[]; // inline array; max 6 entries
  requiredBayType: BayType;
  membershipWashEligible: boolean;
  active: boolean;
  displayOrder: number; // ascending; lower = shown first
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Immutable price record written at booking/job creation time.
// Changing the service catalogue after this snapshot must not affect this record.
// (doc06 §6.4 Historical Truth Rules 1, 9)
export interface PriceSnapshot {
  serviceId: string;
  serviceName: string; // SNAPSHOT — immutable
  serviceCategory: ServiceCategory; // SNAPSHOT — immutable
  vehicleCategory: VehicleCategory; // SNAPSHOT — immutable
  basePrice: number; // paise — as of snapshot time
  vehicleCategoryAdjustment: number; // paise — from vehicleCategoryPricing at snapshot time
  subtotal: number; // paise = basePrice + vehicleCategoryAdjustment
  taxRatePercent: number; // e.g. 18 for "GST 18%"; tenant-configurable
  taxDescription: string; // e.g. "GST 18%"; SNAPSHOT
  tax: number; // paise = Math.round(subtotal * taxRatePercent / 100)
  total: number; // paise = subtotal + tax
  currency: string; // ISO 4217 — SNAPSHOT
  snapshotAt: string; // ISO timestamp when this snapshot was computed
}
