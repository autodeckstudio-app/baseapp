export type VehicleCategory = "hatchback" | "sedan" | "suv" | "luxury" | "commercial";
export type ServiceCategory = "protection" | "wash" | "detailing" | "repair" | "inspection";

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: ServiceCategory;
  durationMinutes: number;
  basePrice: number; // stored in paise (INR * 100); never decimal
  currency: string; // ISO 4217 — "INR" for V1
  warrantyLabel: string | null; // e.g. "5-year film warranty"
  requiresBayType: BayType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceScope {
  id: string;
  tenantId: string;
  serviceId: string;
  vehicleCategory: VehicleCategory;
  additionalMinutes: number;
  additionalPrice: number; // paise
}

export type BayType = "wash" | "protection" | "general";
