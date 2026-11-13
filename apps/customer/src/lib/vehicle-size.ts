import {useForegroundRefresh,useForegroundNow} from '../hooks/useForegroundRefresh';
import {priceCache,onPriceCacheScopeChange,PRICE_CACHE_MS} from './price-cache';
import { getCatalogueDisplayTotals, cachedServiceTotal, priceLabel } from "./catalogue-service";
import { rupees } from "../ui/kit";
import { useEffect, useState } from "react";
import {useVehiclePreference} from "./active-vehicle";
import { CAR_SEGMENTS, isSizePriced, normalizeSegment, segmentLabel } from "@autodeck/core";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { listenToMyVehicles } from "./vehicle-service";
import { useAuth } from "../hooks/useAuth";
import { listOwnerKey } from "./owner-key";
export const VEHICLE_SIZES: { value: VehicleCategory; label: string }[] = CAR_SEGMENTS;
export function usePricingVehicle() {
 const auth=useAuth();const [source,setSource]=useState<{owner:string;vehicles:Vehicle[]}>({owner:"",vehicles:[]});
 const uid=listOwnerKey(auth)?.key??null;const tenant=auth.status==="ready"?auth.claims.tenantId:null;const owner=`${tenant}:${uid}`;const preferred=useVehiclePreference(uid,tenant);
 useEffect(()=>{setSource({owner,vehicles:[]});if(!uid||!tenant)return;let active=true;const stop=listenToMyVehicles(uid,tenant,vs=>{if(active)setSource({owner,vehicles:vs.filter(v=>!v.deletedAt)})},()=>{if(active)setSource({owner,vehicles:[]})});return()=>{active=false;stop()}},[uid,tenant]);
 const vehicles=source.owner===owner?source.vehicles:[];const vehicle=vehicles.find(v=>v.id===preferred)??vehicles[0]??null;
 return {vehicle,category:normalizeSegment(vehicle?.category),label:segmentLabel(vehicle?.category)};
}

export function useVehiclePrices(services: Service[], category: VehicleCategory | null) {
 const [tick,setTick]=useState(0);
 const scope=priceCache.scopeKey();
 useEffect(()=>onPriceCacheScopeChange(()=>setTick(t=>t+1)),[]);
 const now=useForegroundNow(scope||'display');
 useForegroundRefresh(()=>setTick(t=>t+1),scope||'display');
 const seed=()=>{const o:Record<string,number>={};if(category)for(const s of services){const total=cachedServiceTotal(s.id,category);if(total!==undefined)o[s.id]=total;}return o;};
 const [priceState,setPriceState]=useState<{scope:string;category:VehicleCategory|null;services:Service[];at:number;prices:Record<string,number>}>(()=>({scope,category,services,at:Date.now(),prices:seed()}));
 useEffect(()=>{
   setPriceState({scope,category,services,at:Date.now(),prices:seed()});
   if(!category||!services.length)return;
   let active=true;
   void getCatalogueDisplayTotals(category,{fresh:tick>0}).then(()=>{if(active&&scope===priceCache.scopeKey())setPriceState({scope,category,services,at:Date.now(),prices:seed()});});
   return()=>{active=false};
 },[services,category,scope,tick]);
 return priceState.scope===scope&&priceState.category===category&&priceState.services===services&&now-priceState.at<PRICE_CACHE_MS?priceState.prices:seed();
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
