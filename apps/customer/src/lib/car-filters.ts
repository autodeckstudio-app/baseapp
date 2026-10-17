import {hasCarPrice} from "./cars-home";
import type { CarListingView } from "@autodeck/core";
export type CarFilters = { query: string; fuel: string | null; body: string | null; maxPrice: number; sort: "new" | "low" | "high" };
const pr=(l:CarListingView,hidden:number)=>hasCarPrice(l)?l.askingPrice:hidden;
// A listing whose price is hidden or missing is never filtered out by budget.
const inBudget=(l:CarListingView,max:number)=>!hasCarPrice(l)||l.askingPrice<=max;
export function filterCars(all: CarListingView[], f: CarFilters): CarListingView[] {
  const q=f.query.trim().toLowerCase();
  const list=all.filter(l=>(!q || `${l.make} ${l.model} ${l.variant??""} ${l.year} ${l.area}`.toLowerCase().includes(q)) && (!f.fuel || l.fuel?.trim().toLowerCase()===f.fuel) && (!f.body || l.bodyType?.trim().toLowerCase()===f.body) && inBudget(l,f.maxPrice));
  return [...list].sort((a,b)=>f.sort==="low"?pr(a,1e15)-pr(b,1e15):f.sort==="high"?pr(b,-1)-pr(a,-1):b.createdAt.localeCompare(a.createdAt));
}
