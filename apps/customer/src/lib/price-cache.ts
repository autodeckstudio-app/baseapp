import type { VehicleCategory } from "@autodeck/core";

/** How long a server total stays usable for list tiles. */
export const PRICE_CACHE_MS = 5 * 60_000;

/** Held server totals, keyed by signed-in user, service and car size. Never shared across accounts or car types, and expires. */
export function createPriceCache(now: () => number = Date.now, ttlMs: number = PRICE_CACHE_MS) {
  const map = new Map<string, { total: number; at: number }>();
  let scope = "";
  const key = (uid: string | null, serviceId: string, category: VehicleCategory) => `${uid ?? "anon"}:${serviceId}:${category}`;
  return {
    get(uid: string | null, serviceId: string, category: VehicleCategory): number | undefined {
      const hit = map.get(key(uid, serviceId, category));
      return hit && now() - hit.at < ttlMs ? hit.total : undefined;
    },
    set(uid: string | null, serviceId: string, category: VehicleCategory, total: number): void {
      map.set(key(uid, serviceId, category), { total, at: now() });
    },
    clear(): void { map.clear(); },
    /** The signed-in user's tenant claim and uid. Held totals are dropped whenever either changes (sign-out, account switch, claims set up or changed). */
    setScope(uid: string | null, tenantId: string | null): void {
      const next = `${uid ?? ""}|${tenantId ?? ""}`;
      if (next !== scope) { map.clear(); scope = next; }
    },
  };
}
export const priceCache = createPriceCache();
