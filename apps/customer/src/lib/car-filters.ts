import type { CarListingView } from "@autodeck/core";
export type CarFilters = { query: string; fuel: string | null; body: string | null; maxPrice: number; sort: "new" | "low" | "high" };
const pr=(l:CarListingView,hidden:number)=>l.priceHidden?hidden:l.askingPrice;
export function filterCars(all: CarListingView[], f: CarFilters): CarListingView[] {
  const q=f.query.trim().toLowerCase();
  const list=all.filter(l=>(!q || `${l.make} ${l.model} ${l.variant??""} ${l.year} ${l.area}`.toLowerCase().includes(q)) && (!f.fuel || l.fuel?.trim().toLowerCase()===f.fuel) && (!f.body || l.bodyType?.trim().toLowerCase()===f.body) && l.askingPrice<=f.maxPrice);
  return [...list].sort((a,b)=>f.sort==="low"?pr(a,1e15)-pr(b,1e15):f.sort==="high"?pr(b,-1)-pr(a,-1):b.createdAt.localeCompare(a.createdAt));
}
