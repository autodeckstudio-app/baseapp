import { getCatalogueDisplayTotals, cachedServiceTotal, priceLabel } from "./catalogue-service";
import { rupees } from "../ui/kit";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CAR_SEGMENTS, isSizePriced, normalizeSegment, segmentLabel } from "@autodeck/core";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { listenToMyVehicles } from "./vehicle-service";
import { useAuth } from "../hooks/useAuth";
import { listOwnerKey } from "./owner-key";
export const VEHICLE_SIZES: { value: VehicleCategory; label: string }[] = CAR_SEGMENTS;
export function usePricingVehicle() {
 const auth=useAuth(); const [vehicle,setVehicle]=useState<Vehicle|null>(null);
 const uid=listOwnerKey(auth)?.key??null;
 const tenant=auth.status==="ready"?auth.claims.tenantId:null;
 useEffect(()=>{setVehicle(null);if(!uid||!tenant)return;let active=true,revision=0;
  const stop=listenToMyVehicles(uid,tenant,(vs)=>{const current=++revision;void AsyncStorage.getItem("autodeck.activeVehicle").then(id=>{if(active&&current===revision)setVehicle(vs.find(v=>v.id===id)??vs[0]??null)}).catch(()=>{if(active&&current===revision)setVehicle(vs[0]??null)});},()=>{if(active)setVehicle(null)});return()=>{active=false;stop()};
 },[uid,tenant]);
 return {vehicle,category:normalizeSegment(vehicle?.category),label:segmentLabel(vehicle?.category)};
}

export function useVehiclePrices(services: Service[], category: VehicleCategory | null) {
 const seed=()=>{const o:Record<string,number>={}; if(category)for(const s of services){const t=cachedServiceTotal(s.id,category); if(t!==undefined)o[s.id]=t;} return o;};
 const [prices,setPrices]=useState<Record<string,number>>(seed);
 useEffect(()=>{
  setPrices(seed()); if(!category || !services.length)return;
  let alive=true;
  // One batched server call fills the price cache for every visible service; seed() then
  // picks the fresh totals up. Replaces the old per-service pricing fan-out.
  void getCatalogueDisplayTotals(category).then(()=>{if(alive)setPrices(seed());});
  return ()=>{alive=false;};
 },[services,category]);
 return prices;
}

/**
 * The price a list tile shows. With a known car size it is the server total or nothing while that loads,
 * never the unadjusted base price. Without a car it is the entry price.
 */
export function servicePriceText(sv: Service, category: VehicleCategory | null, prices: Record<string, number>): string | null {
  if (sv.priceOnRequest) return "Quote on request";
  const from = sv.priceFrom === true ? "From " : "";
  if (!category) return from + priceLabel(sv);
  // The server omits a display total when the service document has no row for this size;
  // never show the flat base as the size-adjusted price - show it as the entry price.
  if (isSizePriced(sv.category) && !sv.vehicleCategoryPricing?.some((r) => r.vehicleCategory === category)) return "From " + priceLabel(sv);
  const t = prices[sv.id] ?? cachedServiceTotal(sv.id, category);
  return t === undefined ? null : from + rupees(t);
}
