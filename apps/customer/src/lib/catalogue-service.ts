import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { rupees } from "../ui/kit";
import { primeVisuals } from "./imagery";
import { MENU_SEED, sizePricingFor } from "@autodeck/core";
import type { Service, ServiceCategory, VehicleCategory, PriceBreakdown, PriceSnapshot } from "@autodeck/core";

// Dev-only: ?mock=1 on web renders the real screens from the seeded menu (no Firebase session needed).
const devMock = (): Service[] | null => {
  if (!__DEV__ || !/mock=1/.test((globalThis as { location?: { search?: string } }).location?.search ?? "")) return null;
  return MENU_SEED.map((m) => ({ id: m.id, tenantId: "dev", name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, currency: "INR", estimatedDurationMinutes: m.minutes, warrantyLabel: m.warrantyLabel ?? null, vehicleCategoryPricing: sizePricingFor(m.rupees * 100), requiredBayType: m.bay, membershipWashEligible: false, priceOnRequest: m.consult === true, coverageLevel: m.coverageLevel ?? null, priceFrom: m.priceFrom === true, active: true, displayOrder: m.order, createdAt: "", updatedAt: "" }) as unknown as Service);
};

const KEY = "autodeck.catalogue.v1";
const TTL_MS = 5 * 60 * 1000;
let memo: { at: number; p: Promise<Service[]> } | null = null;

const store = (): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null => {
  try { return (globalThis as unknown as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } }).localStorage ?? null; } catch { return null; }
};

/** Last catalogue this device saw, so the Services page paints at once while the live one loads. */
export function peekCatalogue(): Service[] | null {
  try {
    const raw = store()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Service[]) : null;
  } catch { return null; }
}

async function fetchCatalogue(category?: ServiceCategory): Promise<Service[]> {
  const fn = httpsCallable<{ category?: ServiceCategory }, { services: Service[] }>(
    functions,
    "getServiceCatalogue",
  );
  const result = await fn(category !== undefined ? { category } : {});
  const list = result.data.services.map(applyBrandWarranty);
  if (category === undefined) {
    primeVisuals(list);
    try { store()?.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  }
  return list;
}

/** One shared request for the whole catalogue: every screen reuses it for 5 minutes instead of calling the function again. */
export async function getServiceCatalogue(category?: ServiceCategory): Promise<Service[]> {
  const mock = devMock();
  if (mock) return mock;
  if (category !== undefined) return fetchCatalogue(category);
  if (memo && Date.now() - memo.at < TTL_MS) return memo.p;
  const p = fetchCatalogue();
  memo = { at: Date.now(), p };
  p.catch(() => { if (memo?.p === p) memo = null; });
  return p;
}

// Warranty labels below were web-researched from the brand sites listed here. They are NOT owner-supplied and
// still need owner confirmation against official brand pages before launch. See docs/WARRANTY-CLAIMS.md.
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
  totalCache.set(`${serviceId}:${vehicleCategory}`, result.data.breakdown.total);
  return result.data;
}

// Server-calculated totals seen this session. Lists read from here so a tile never shows a price the detail page then contradicts.
const totalCache = new Map<string, number>();
export function cachedServiceTotal(serviceId: string, vehicleCategory: VehicleCategory): number | undefined {
  return totalCache.get(`${serviceId}:${vehicleCategory}`);
}

export function priceLabel(s: { priceOnRequest?: boolean; basePrice: number }): string {
  return s.priceOnRequest === true ? "Quote on request" : rupees(s.basePrice);
}
