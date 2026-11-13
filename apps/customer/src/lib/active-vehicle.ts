import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
type Entry={id:string|null;revision:number;loaded:boolean;listeners:Set<()=>void>};
const entries=new Map<string,Entry>();let writes=Promise.resolve();
const entry=(owner:string)=>{let e=entries.get(owner);if(!e){e={id:null,revision:0,loaded:false,listeners:new Set()};entries.set(owner,e)}return e};
export const vehiclePreferenceOwner=(customerId:string|null,tenantId:string|null)=>customerId&&tenantId?`${tenantId}:${customerId}`:null;
const key=(owner:string)=>`autodeck.activeVehicle:${owner}`;
const emit=(e:Entry)=>e.listeners.forEach(fn=>fn());
/** Legacy device preference is accepted only after each consumer validates current ownership. */
export async function loadVehiclePreference(owner:string){const e=entry(owner);if(e.loaded)return;const revision=e.revision;e.loaded=true;try{const id=await AsyncStorage.getItem(key(owner))??await AsyncStorage.getItem('autodeck.activeVehicle');if(e.revision===revision){e.id=id;emit(e)}}catch{/* no persisted preference */}}
export function setVehiclePreference(owner:string,id:string):Promise<void>{const e=entry(owner);e.revision++;e.loaded=true;e.id=id;emit(e);const write=writes.catch(()=>undefined).then(async()=>{await AsyncStorage.setItem(key(owner),id);await AsyncStorage.setItem('autodeck.activeVehicle',id)});writes=write;return write;}
export function useVehiclePreference(customerId:string|null,tenantId:string|null){const owner=vehiclePreferenceOwner(customerId,tenantId);const subscribe=useCallback((fn:()=>void)=>{if(!owner)return()=>{};const e=entry(owner);e.listeners.add(fn);return()=>{e.listeners.delete(fn)}},[owner]);const snapshot=useCallback(()=>owner?entry(owner).id:null,[owner]);const id=useSyncExternalStore(subscribe,snapshot,()=>null);useEffect(()=>{if(owner)void loadVehiclePreference(owner)},[owner]);return id;}
