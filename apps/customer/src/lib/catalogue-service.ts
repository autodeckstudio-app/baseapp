import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { rupees } from "../ui/kit";
import type { Service, ServiceCategory, VehicleCategory, PriceBreakdown, PriceSnapshot } from "@autodeck/core";

export async function getServiceCatalogue(category?: ServiceCategory): Promise<Service[]> {
  const fn = httpsCallable<{ category?: ServiceCategory }, { services: Service[] }>(
    functions,
    "getServiceCatalogue",
  );
  const result = await fn(category !== undefined ? { category } : {});
  return result.data.services.map(applyBrandWarranty);
}

// Per Meet via parent relay (phonemsg-01M3T6NC5N3Q1R0K1PFXRXW7K0): brand-website facts override the studio's old price-list labels.
// Garware site tiers: Premium 8-year, Plus 5-year, Protect 3-year (garwarehitechfilms.com).
// LLumar site: Platinum Gloss 10-year, Gloss/Matte 5-year. No site source for "Garware Platinum" or
// "LLumar Valor", so their warranty shows blank until sourced.
const SITE_WARRANTY: Record<string, string | null> = {
  "garware plus": "5-Year PPF Film Warranty",
  "garware premium": "8-Year PPF Film Warranty",
  "garware platinum": null,
  "llumar gloss": "5-Year PPF Film Warranty",
  "llumar platinum": "10-Year PPF Film Warranty",
  "llumar valor": null,
};
export function applyBrandWarranty(s: Service): Service {
  const k = s.name.toLowerCase();
  return k in SITE_WARRANTY ? { ...s, warrantyLabel: SITE_WARRANTY[k] ?? null } : s;
}

export async function calculateServicePrice(
  serviceId: string,
  vehicleCategory: VehicleCategory,
): Promise<{ breakdown: PriceBreakdown; snapshot: PriceSnapshot }> {
  const fn = httpsCallable<
    { serviceId: string; vehicleCategory: VehicleCategory },
    { breakdown: PriceBreakdown; snapshot: PriceSnapshot }
  >(functions, "calculateServicePrice");
  const result = await fn({ serviceId, vehicleCategory });
  return result.data;
}

export function priceLabel(s: { priceOnRequest?: boolean; basePrice: number }): string {
  return s.priceOnRequest === true ? "Quote on request" : rupees(s.basePrice);
}
