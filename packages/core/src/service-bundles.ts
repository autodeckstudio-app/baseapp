/** Services that already contain other services. Booking both is paying twice for the same work, so it is refused (server) and not offered (apps).
 *  Only relations stated in the service's own description are listed: "Full detail wash: Interior deep clean and exterior detail wash together." */
export const SERVICE_INCLUDES: Readonly<Record<string, readonly string[]>> = {
  "menu-wash-full": ["menu-wash-exterior", "menu-wash-interior"],
};

/** True when `big` already contains `small`. */
export const includesService = (big: string, small: string): boolean => (SERVICE_INCLUDES[big] ?? []).includes(small);

/** Two services overlap when either one contains the other. */
export const servicesOverlap = (a: string, b: string): boolean => includesService(a, b) || includesService(b, a);

/** Pairs in a visit (main service first, then extras) where one already contains the other: [bundleId, includedId]. */
export function redundantPairs(ids: readonly string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const big of ids) for (const small of ids) if (big !== small && includesService(big, small)) out.push([big, small]);
  return out;
}

/** The bundle that a set of services adds up to: every service it includes is present and the bundle itself is not. Customers who pick the parts get offered the whole. */
export function bundleFor(ids: readonly string[]): string | null {
  for (const [big, parts] of Object.entries(SERVICE_INCLUDES)) {
    if (!ids.includes(big) && parts.every((p) => ids.includes(p))) return big;
  }
  return null;
}
