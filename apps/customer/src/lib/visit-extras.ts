import type { Service } from "@autodeck/core";

/** Extra services on top of the main one. The server enforces the same cap. */
export const MAX_EXTRAS = 4;

/** Mirrors the server rule: same bay type, live, priced up front, and not the main service. */
export function canAddExtra(primary: Pick<Service, "id" | "requiredBayType" | "priceOnRequest">, extra: Pick<Service, "id" | "requiredBayType" | "priceOnRequest" | "active">): boolean {
  return extra.id !== primary.id && extra.active !== false && extra.priceOnRequest !== true && primary.priceOnRequest !== true && extra.requiredBayType === primary.requiredBayType;
}

export function eligibleExtras<S extends Pick<Service, "id" | "requiredBayType" | "priceOnRequest" | "active">>(primary: Pick<Service, "id" | "requiredBayType" | "priceOnRequest">, catalogue: S[]): S[] {
  return catalogue.filter((s) => canAddExtra(primary, s));
}

/** Toggle one extra in the picked list. Adds up to the cap; removing always works. */
export function toggleExtra(picked: string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  return picked.length >= MAX_EXTRAS ? picked : [...picked, id];
}

export const extrasToParam = (ids: string[]): string => ids.join(",");
export function extrasFromParam(p: string | undefined): string[] {
  if (!p) return [];
  return [...new Set(p.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, MAX_EXTRAS);
}
