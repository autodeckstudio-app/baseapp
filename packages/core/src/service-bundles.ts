/** Services that already contain other services. Booking both is paying twice for the same work, so it is refused (server) and not offered (apps).
 *  Only relations stated in the service's own description are listed: "Full detail wash: Interior deep clean and exterior detail wash together." */
export const SERVICE_INCLUDES: Readonly<Record<string, readonly string[]>> = {
  "menu-wash-full": ["menu-wash-exterior", "menu-wash-interior"],
};

/** True when `big` already contains `small`. */
export const includesService = (big: string, small: string): boolean => (SERVICE_INCLUDES[big] ?? []).includes(small);

const COAT_ADDONS = new Set(["glass", "wheels", "leather", "fabric", "trim"]);
/** Families where only one can be booked in a visit (owner, 18 Oct 6:26 PM): two ceramic coatings, two PPF tiers or brands (so also Ceramic 1-year with 2-year). Surface add-ons are not coatings. */
const exclusiveFamily = (id: string): string | null => {
  if (id.startsWith("menu-ppf-")) return "ppf";
  if (id.startsWith("menu-coat-") && !COAT_ADDONS.has(id.slice("menu-coat-".length))) return "ceramic";
  return null;
};
/** Foam wash cannot be booked with Exterior detail wash or Full detail wash (owner, 18 Oct 6:26 PM). */
const FOAM_CLASH = new Set(["menu-wash-exterior", "menu-wash-full"]);

/** Pairs in a visit that cannot be booked together, though neither contains the other. */
export function conflictingPair(ids: readonly string[]): [string, string] | null {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    if (a === undefined || b === undefined || a === b) continue;
    const fa = exclusiveFamily(a);
    if (fa && fa === exclusiveFamily(b)) return [a, b];
    if ((a === "menu-wash-foam" && FOAM_CLASH.has(b)) || (b === "menu-wash-foam" && FOAM_CLASH.has(a))) return [a, b];
  }
  return null;
}
export const conflicts = (a: string, b: string): boolean => conflictingPair([a, b]) !== null;

/** Two services overlap when either one contains the other, or they cannot be booked together. */
export const servicesOverlap = (a: string, b: string): boolean => includesService(a, b) || includesService(b, a) || conflicts(a, b);

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
