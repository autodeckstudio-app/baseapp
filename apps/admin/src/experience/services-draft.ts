// Service editor draft: every number is a string while typing (so an empty
// field is distinct from 0) and money is in rupees. toServicePayload turns
// it into the stored shape (paise, integers) or explains what's wrong.
import type { BayType, Service, ServiceCategory, VehicleCategory, VehicleCategoryPricing, WarrantyDurationUnit } from "@autodeck/core";

export interface SizeRuleDraft { vehicleCategory: VehicleCategory; extraRupees: string; extraMinutes: string }
export interface ServiceDraft {
  serviceId: string | null;
  name: string;
  category: ServiceCategory;
  brand: string;
  description: string;
  priceRupees: string;
  minutes: string;
  warrantyLabel: string;
  warrantyUnit: WarrantyDurationUnit | "";
  warrantyValue: string;
  bay: BayType;
  displayOrder: string;
  washEligible: boolean;
  sizes: SizeRuleDraft[];
}

export const EMPTY_SERVICE: ServiceDraft = {
  serviceId: null, name: "", category: "washing", brand: "", description: "", priceRupees: "", minutes: "60",
  warrantyLabel: "", warrantyUnit: "", warrantyValue: "", bay: "wash", displayOrder: "0", washEligible: false, sizes: [],
};

export function draftFromService(s: Service): ServiceDraft {
  return {
    serviceId: s.id,
    name: s.name,
    category: s.category,
    brand: s.brand ?? "",
    description: s.description ?? "",
    priceRupees: String(s.basePrice / 100),
    minutes: String(s.estimatedDurationMinutes),
    warrantyLabel: s.warrantyLabel ?? "",
    warrantyUnit: s.warrantyDurationUnit ?? "",
    warrantyValue: s.warrantyDurationValue?.toString() ?? "",
    bay: s.requiredBayType,
    displayOrder: String(s.displayOrder),
    washEligible: s.membershipWashEligible,
    sizes: s.vehicleCategoryPricing.map((r) => ({ vehicleCategory: r.vehicleCategory, extraRupees: String(r.additionalPricePaise / 100), extraMinutes: String(r.additionalMinutes) })),
  };
}

export interface ServicePayload {
  name: string;
  category: ServiceCategory;
  brand: string | null;
  description: string;
  basePrice: number;
  estimatedDurationMinutes: number;
  warrantyLabel: string | null;
  warrantyDurationValue: number | null;
  warrantyDurationUnit: WarrantyDurationUnit | null;
  requiredBayType: BayType;
  displayOrder: number;
  membershipWashEligible: boolean;
  vehicleCategoryPricing: VehicleCategoryPricing[];
}

const paise = (rupees: string) => Math.round(Number(rupees) * 100);

export function toServicePayload(d: ServiceDraft): { ok: true; payload: ServicePayload } | { ok: false; problem: string } {
  if (!d.name.trim()) return { ok: false, problem: "Give the service a name." };
  const price = Number(d.priceRupees);
  if (!d.priceRupees.trim() || !Number.isFinite(price) || price <= 0) return { ok: false, problem: "Starting price must be more than ₹0." };
  const minutes = Number(d.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0) return { ok: false, problem: "Time needed must be a whole number of minutes." };
  const order = Number(d.displayOrder || "0");
  if (!Number.isInteger(order)) return { ok: false, problem: "Position must be a whole number." };

  let warrantyDurationValue: number | null = null;
  let warrantyDurationUnit: WarrantyDurationUnit | null = null;
  if (d.warrantyUnit === "lifetime") warrantyDurationUnit = "lifetime";
  else if (d.warrantyUnit) {
    const n = Number(d.warrantyValue);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, problem: "Warranty length must be a whole number, or pick Lifetime." };
    warrantyDurationValue = n;
    warrantyDurationUnit = d.warrantyUnit;
  }

  const seen = new Set<string>();
  const vehicleCategoryPricing: VehicleCategoryPricing[] = [];
  for (const r of d.sizes) {
    if (seen.has(r.vehicleCategory)) return { ok: false, problem: "Each car size can only have one price rule." };
    seen.add(r.vehicleCategory);
    const extra = Number(r.extraRupees || "0");
    const mins = Number(r.extraMinutes || "0");
    if (!Number.isFinite(extra) || extra < 0) return { ok: false, problem: "Extra price for a car size can't be negative." };
    if (!Number.isInteger(mins) || mins < 0) return { ok: false, problem: "Extra time must be a whole number of minutes." };
    vehicleCategoryPricing.push({ vehicleCategory: r.vehicleCategory, additionalPricePaise: paise(r.extraRupees || "0"), additionalMinutes: mins });
  }

  return {
    ok: true,
    payload: {
      name: d.name.trim(),
      category: d.category,
      brand: d.brand.trim() || null,
      description: d.description.trim(),
      basePrice: paise(d.priceRupees),
      estimatedDurationMinutes: minutes,
      warrantyLabel: d.warrantyLabel.trim() || null,
      warrantyDurationValue,
      warrantyDurationUnit,
      requiredBayType: d.bay,
      displayOrder: order,
      membershipWashEligible: d.washEligible,
      vehicleCategoryPricing,
    },
  };
}
