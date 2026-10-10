import { calculateServicePrice } from "./catalogue-service";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { listenToMyVehicles } from "./vehicle-service";
import { useAuth } from "../hooks/useAuth";
export const VEHICLE_SIZES: { value: VehicleCategory; label: string }[] = [
 {value:"hatchback",label:"Hatchback"},{value:"sedan",label:"Sedan"},{value:"suv",label:"SUV"},
 {value:"luxury",label:"Luxury/Premium"},{value:"van",label:"Van/MUV"},{value:"commercial",label:"Commercial"}
];
export function usePricingVehicle() {
 const auth=useAuth(); const [vehicle,setVehicle]=useState<Vehicle|null>(null);
 const uid=auth.status==="ready"?auth.user.uid:null;
 const tenant=auth.status==="ready"?auth.claims.tenantId:null;
 useEffect(()=>{if(!uid||!tenant){setVehicle(null);return;}
  return listenToMyVehicles(uid,tenant,(vs)=>{void AsyncStorage.getItem("autodeck.activeVehicle").then(id=>setVehicle(vs.find(v=>v.id===id)??vs[0]??null));},()=>setVehicle(null));
 },[uid,tenant]);
 return {vehicle,category:vehicle?.category??null,label:VEHICLE_SIZES.find(x=>x.value===vehicle?.category)?.label??null};
}

export function useVehiclePrices(services: Service[], category: VehicleCategory | null) {
 const [prices,setPrices]=useState<Record<string,number>>({});
 useEffect(()=>{
  setPrices({}); if(!category || !services.length)return;
  let alive=true;
  void Promise.all(services.filter(s=>!s.priceOnRequest).map(async s=>{
   try { const {breakdown}=await calculateServicePrice(s.id,category);return [s.id,breakdown.total] as const; }
   catch {return null;}
  })).then(rows=>{if(alive)setPrices(Object.fromEntries(rows.filter(x=>x!==null)));});
  return ()=>{alive=false;};
 },[services,category]);
 return prices;
}
