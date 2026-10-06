import type { CarListingView } from "@autodeck/core";
export type CarFilters = { query: string; fuel: string | null; body: string | null; maxPrice: number; sort: "new" | "low" | "high" };
export function filterCars(all: CarListingView[], f: CarFilters): CarListingView[] {
  const q=f.query.trim().toLowerCase();
  const list=all.filter(l=>(!q || `${l.make} ${l.model} ${l.variant??""} ${l.year} ${l.area}`.toLowerCase().includes(q)) && (!f.fuel || l.fuel?.trim().toLowerCase()===f.fuel) && (!f.body || l.bodyType?.trim().toLowerCase()===f.body) && l.askingPrice<=f.maxPrice);
  return [...list].sort((a,b)=>f.sort==="low"?a.askingPrice-b.askingPrice:f.sort==="high"?b.askingPrice-a.askingPrice:b.createdAt.localeCompare(a.createdAt));
}
