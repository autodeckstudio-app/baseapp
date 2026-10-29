// Which routes show a Back chevron and where it falls back when there is no history.
// Back itself always returns to the page the user came from (router.back); the fallback is only for a hard load.
export const SUB_ROOTS: Record<string, string> = {
  studio: "/(tabs)", membership: "/(tabs)/profile", notifications: "/(tabs)", cars: "/(tabs)", help: "/(tabs)", gifts: "/(tabs)",
};
// Route folders with no index screen: a cold load of their child must not fall back to a route that does not exist.
export const NO_INDEX_ROOTS: Record<string, string> = { book: "/(tabs)/catalogue", approvals: "/(tabs)/bookings", invoice: "/(tabs)/bookings" };
// Top-level routes outside the tab group that are drill-downs from the tabs.
export const OUTSIDE_TAB_ROOTS: Record<string, string> = { sell: "/(tabs)/cars", services: "/(tabs)/catalogue", shop: "/(tabs)" };

/** Returns null when no Back is shown (tab roots), else the fallback path used only when there is no history. */
export function backFallback(segs: string[]): string | null {
  if (segs[0] !== "(tabs)") return (segs[0] && OUTSIDE_TAB_ROOTS[segs[0]]) || null;
  const root = segs[1] ?? "";
  const deep = segs.length >= 3 && segs[2] !== "index";
  if (!(deep || root in SUB_ROOTS)) return null;
  return SUB_ROOTS[root] ?? NO_INDEX_ROOTS[root] ?? (root ? `/(tabs)/${root}` : "/(tabs)");
}

type StackLike = { index: number; routes: ReadonlyArray<{ key: string; name: string }> };
/**
 * The Book pages live in one hidden stack that survives tab switches. A page opened earlier stays under the next one,
 * so Back from a freshly opened Book page returned to that old page (Ceramic wash Back showed Full detail wash).
 * When a Book page opens on top of other Book pages, keep only the new page: Back then leaves the stack and returns
 * to wherever the customer really came from (service detail, Home, Bookings). Runs once when a "[serviceId]" page opens, so
 * Book -> Confirm -> Back (Confirm is opened later, on top) is untouched.
 * Returns the reset target, or null when the stack is already clean.
 */
export function collapseStaleBookEntries(state: StackLike | undefined, pageName = "[serviceId]"): { index: 0; routes: Array<{ key: string; name: string }> } | null {
  if (!state || state.routes.length < 2) return null;
  const top = state.routes[state.index];
  if (!top || top.name !== pageName || state.index !== state.routes.length - 1) return null;
  return { index: 0, routes: [top] };
}
