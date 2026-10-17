import { calculateServicePrice, cachedServiceTotal, priceLabel } from "./catalogue-service";
import { rupees } from "../ui/kit";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CAR_SEGMENTS, normalizeSegment, segmentLabel } from "@autodeck/core";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { listenToMyVehicles } from "./vehicle-service";
import { useAuth } from "../hooks/useAuth";
export const VEHICLE_SIZES: { value: VehicleCategory; label: string }[] = CAR_SEGMENTS;
export function usePricingVehicle() {
 const auth=useAuth(); const [vehicle,setVehicle]=useState<Vehicle|null>(null);
 const uid=auth.status==="ready"?auth.user.uid:null;
 const tenant=auth.status==="ready"?auth.claims.tenantId:null;
 useEffect(()=>{if(!uid||!tenant){setVehicle(null);return;}
  return listenToMyVehicles(uid,tenant,(vs)=>{void AsyncStorage.getItem("autodeck.activeVehicle").then(id=>setVehicle(vs.find(v=>v.id===id)??vs[0]??null));},()=>setVehicle(null));
 },[uid,tenant]);
 return {vehicle,category:normalizeSegment(vehicle?.category),label:segmentLabel(vehicle?.category)};
}

export function useVehiclePrices(services: Service[], category: VehicleCategory | null) {
 const seed=()=>{const o:Record<string,number>={}; if(category)for(const s of services){const t=cachedServiceTotal(s.id,category); if(t!==undefined)o[s.id]=t;} return o;};
 const [prices,setPrices]=useState<Record<string,number>>(seed);
 useEffect(()=>{
  setPrices(seed()); if(!category || !services.length)return;
  let alive=true;
  void Promise.all(services.filter(s=>!s.priceOnRequest).map(async s=>{
   try { const {breakdown}=await calculateServicePrice(s.id,category);return [s.id,breakdown.total] as const; }
   catch {return null;}
  })).then(rows=>{if(alive)setPrices(Object.fromEntries(rows.filter(x=>x!==null)));});
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
  const t = prices[sv.id] ?? cachedServiceTotal(sv.id, category);
  return t === undefined ? null : from + rupees(t);
}
