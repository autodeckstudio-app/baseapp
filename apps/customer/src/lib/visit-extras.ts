import { SERVICE_INCLUDES, bundleFor, includesService, servicesOverlap, type Service } from "@autodeck/core";

/** Extra services on top of the main one. The server enforces the same cap. */
export const MAX_EXTRAS = 4;

/** Mirrors the server rule: same bay type, live, priced up front, and not the main service. */
export function canAddExtra(primary: Pick<Service, "id" | "requiredBayType" | "priceOnRequest">, extra: Pick<Service, "id" | "requiredBayType" | "priceOnRequest" | "active">): boolean {
  return extra.id !== primary.id && !servicesOverlap(primary.id, extra.id) && extra.active !== false && extra.priceOnRequest !== true && primary.priceOnRequest !== true && extra.requiredBayType === primary.requiredBayType;
}

export function eligibleExtras<S extends Pick<Service, "id" | "requiredBayType" | "priceOnRequest" | "active">>(primary: Pick<Service, "id" | "requiredBayType" | "priceOnRequest">, catalogue: S[]): S[] {
  return catalogue.filter((s) => canAddExtra(primary, s));
}

/** Toggle one extra in the picked list. Adds up to the cap; removing always works. Adding a bundle drops the extras it already includes. */
export function toggleExtra(picked: string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  const base = picked.filter((x) => !includesService(id, x) && !includesService(x, id));
  return base.length >= MAX_EXTRAS ? picked : [...base, id];
}

/** Extras still worth offering: not already inside a bundle the customer picked, and not a bundle that swallows what they picked. */
export function offeredExtras<S extends { id: string }>(eligible: S[], picked: string[]): S[] {
  return eligible.filter((e) => picked.includes(e.id) || !picked.some((p) => servicesOverlap(p, e.id)));
}

/** The names the customer should be told about when a bundle replaced services they had picked. */
export function droppedByBundle(before: string[], after: string[]): string[] {
  return before.filter((x) => !after.includes(x));
}

export const extrasToParam = (ids: string[]): string => ids.join(",");
export function extrasFromParam(p: string | undefined): string[] {
  if (!p) return [];
  return [...new Set(p.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, MAX_EXTRAS);
}

/** When the main service plus extras add up to a bundle (Exterior + Interior), switch to the bundle. The bundle becomes the main service if either part was the main one, otherwise it replaces the two extras. */
export function applyBundleUpgrade(primaryId: string, extras: string[]): { primaryId: string; extras: string[]; upgradedTo: string | null } {
  const big = bundleFor([primaryId, ...extras]);
  if (!big) return { primaryId, extras, upgradedTo: null };
  const parts = SERVICE_INCLUDES[big] ?? [];
  const rest = extras.filter((x) => !parts.includes(x));
  return parts.includes(primaryId) ? { primaryId: big, extras: rest, upgradedTo: big } : { primaryId, extras: [...rest, big], upgradedTo: big };
}
