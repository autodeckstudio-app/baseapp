// Which routes show a Back chevron and where it falls back when there is no history.
// Back itself always returns to the page the user came from (router.back); the fallback is only for a hard load.
export const SUB_ROOTS: Record<string, string> = {
  studio: "/(tabs)", membership: "/(tabs)/profile", notifications: "/(tabs)", cars: "/(tabs)", help: "/(tabs)", gifts: "/(tabs)",
};
// Top-level routes outside the tab group that are drill-downs from the tabs.
export const OUTSIDE_TAB_ROOTS: Record<string, string> = { sell: "/(tabs)/cars", services: "/(tabs)/catalogue", shop: "/(tabs)" };

/** Returns null when no Back is shown (tab roots), else the fallback path used only when there is no history. */
export function backFallback(segs: string[]): string | null {
  if (segs[0] !== "(tabs)") return (segs[0] && OUTSIDE_TAB_ROOTS[segs[0]]) || null;
  const root = segs[1] ?? "";
  const deep = segs.length >= 3 && segs[2] !== "index";
  if (!(deep || root in SUB_ROOTS)) return null;
  return SUB_ROOTS[root] ?? (root ? `/(tabs)/${root}` : "/(tabs)");
}
