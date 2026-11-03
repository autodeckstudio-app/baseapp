import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { priceCache, onPriceCacheScopeChange } from "./price-cache";
import { rupees } from "../ui/kit";
import { primeVisuals } from "./imagery";
import { customerCatalogueEligible, customerRatingPrivacy, MENU_SEED, sizePricingForCategory, isSizePriced } from "@autodeck/core";
import { applyBrandWarranty } from "./warranty-labels";
import type { Service, ServiceCategory, VehicleCategory, PriceBreakdown, PriceSnapshot } from "@autodeck/core";

// Dev-only: ?mock=1 on web renders the real screens from the seeded menu (no Firebase session needed).
const devMock = (): Service[] | null => {
  if (!__DEV__ || !/mock=1/.test((globalThis as { location?: { search?: string } }).location?.search ?? "")) return null;
  return MENU_SEED.filter(previewEligible).map((m) => customerRatingPrivacy(({ id: m.id, tenantId: "dev", name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, currency: "INR", estimatedDurationMinutes: m.minutes, warrantyLabel: m.warrantyLabel ?? null, vehicleCategoryPricing: sizePricingForCategory(m.category, m.rupees * 100), requiredBayType: m.bay, membershipWashEligible: false, priceOnRequest: m.consult === true, coverageLevel: m.coverageLevel ?? null, priceFrom: m.priceFrom === true, active: true, displayOrder: m.order, createdAt: "", updatedAt: "" }) as unknown as Service));
};

const previewEligible=(row:{id:string})=>customerCatalogueEligible(row,__DEV__ && /identityPreview=1/.test((globalThis as {location?:{search?:string}}).location?.search ?? ""));
const KEY = "autodeck.catalogue.v1";
const TTL_MS = 5 * 60 * 1000;
let memo: { at: number; p: Promise<Service[]> } | null = null;
// Display totals are per session AND car size, so they never enter the shared catalogue memo
// or the device copy: they live only in the scoped price cache below. The memo key carries the
// price-cache scope token (uid|tenant), so a sign-out or account switch makes old entries
// unreachable; the scope listener also clears them immediately.
const totalsMemo = new Map<string, { at: number; p: Promise<Record<string, number>> }>();
onPriceCacheScopeChange(() => { totalsMemo.clear(); });

const store = (): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null => {
  try { return (globalThis as unknown as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } }).localStorage ?? null; } catch { return null; }
};

/** Last catalogue this device saw, so the Services page paints at once while the live one loads. */
export function peekCatalogue(): Service[] | null {
  try {
    const raw = store()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Service[]).filter(previewEligible).map(customerRatingPrivacy) : null;
  } catch { return null; }
}

async function fetchCatalogue(category?: ServiceCategory): Promise<Service[]> {
  const fn = httpsCallable<{ category?: ServiceCategory }, { services: Service[] }>(
    functions,
    "getServiceCatalogue",
  );
  const result = await fn(category !== undefined ? { category } : {});
  const list = result.data.services.filter(previewEligible).map(customerRatingPrivacy).map(applyBrandWarranty);
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

/**
 * One round trip pricing every active, priced catalogue service for a car size, using the
 * server's own calculation. Results land in the scoped price cache, so tiles read exactly the
 * totals the detail flow would compute. Falls back empty on error (tiles keep "From" prices).
 */
export function getCatalogueDisplayTotals(vehicleCategory: VehicleCategory): Promise<Record<string, number>> {
  const mock = devMock();
  if (mock) {
    // Dev-only (?mock=1): no network. Mock services carry sizePricingForCategory rows, so the
    // total is base + row (the same shape the server returns with GST off).
    const totals: Record<string, number> = {};
    for (const svc of mock) {
      if (svc.priceOnRequest === true) continue;
      const extra = isSizePriced(svc.category)
        ? svc.vehicleCategoryPricing?.find((r) => r.vehicleCategory === vehicleCategory)?.additionalPricePaise ?? 0
        : 0;
      totals[svc.id] = svc.basePrice + extra;
    }
    // Seed the scoped price cache exactly like the network path does, so useVehiclePrices
    // and cachedServiceTotal actually see the mock totals (a bare return is dead state).
    const mockUid = auth.currentUser?.uid ?? null;
    for (const [serviceId, total] of Object.entries(totals)) priceCache.set(mockUid, serviceId, vehicleCategory, total);
    return Promise.resolve(totals);
  }
  const scope = priceCache.scopeKey();
  const key = `${scope}:${vehicleCategory}`;
  const hit = totalsMemo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const fn = httpsCallable<{ vehicleCategory: VehicleCategory }, { displayTotals?: Record<string, number> }>(
    functions,
    "getServiceCatalogue",
  );
  const p = fn({ vehicleCategory })
    .then((result) => {
      // Session changed mid-flight (sign-out / account switch): never write stale totals
      // into the new session's cache.
      if (priceCache.scopeKey() !== scope) return {};
      const totals = result.data.displayTotals ?? {};
      const uid = auth.currentUser?.uid ?? null;
      for (const [serviceId, total] of Object.entries(totals)) priceCache.set(uid, serviceId, vehicleCategory, total);
      return totals;
    })
    .catch(() => {
      // Failures are not cached: the next render retries.
      if (totalsMemo.get(key)?.p === p) totalsMemo.delete(key);
      return {};
    });
  totalsMemo.set(key, { at: Date.now(), p });
  return p;
}

export { applyBrandWarranty } from "./warranty-labels";

export async function calculateServicePrice(
  serviceId: string,
  vehicleCategory: VehicleCategory,
): Promise<{ breakdown: PriceBreakdown; snapshot: PriceSnapshot }> {
  const fn = httpsCallable<
    { serviceId: string; vehicleCategory: VehicleCategory },
    { breakdown: PriceBreakdown; snapshot: PriceSnapshot }
  >(functions, "calculateServicePrice");
  const result = await fn({ serviceId, vehicleCategory });
  priceCache.set(auth.currentUser?.uid ?? null, serviceId, vehicleCategory, result.data.breakdown.total);
  return result.data;
}

// Server-calculated totals seen recently. Lists read from here so a tile never shows a price the detail page then contradicts.
// Display only: a booking is always priced again by the server from the car type saved on the car.
export { PRICE_CACHE_MS } from "./price-cache";
export function cachedServiceTotal(serviceId: string, vehicleCategory: VehicleCategory): number | undefined {
  return priceCache.get(auth.currentUser?.uid ?? null, serviceId, vehicleCategory);
}

export function priceLabel(s: { priceOnRequest?: boolean; basePrice: number }): string {
  return s.priceOnRequest === true ? "Quote on request" : rupees(s.basePrice);
}
