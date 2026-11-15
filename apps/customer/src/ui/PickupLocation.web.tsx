import {createElement,useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import type {Map as LeafletMap,Marker as LeafletMarker} from 'leaflet';
import {STUDIO_COORDS} from '@autodeck/core';
import {Button,T} from './kit';
import {pickupMapPoint,PICKUP_MAP_TILES,PICKUP_MAP_ATTRIBUTION} from '../lib/pickup-map';
import type {PickupLocationProps,MapPoint} from './PickupLocation';
import 'leaflet/dist/leaflet.css';
/** Map is loaded only on explicit open. Selection stays tentative until Use
 * this location. Closing/route changes discard it; a map tap never quotes. */
export function PickupLocation({value,disabled=false,onSelect}:PickupLocationProps){
 const[open,setOpen]=useState(false),[selected,setSelected]=useState<MapPoint|null>(null),[error,setError]=useState<string|null>(null);
 const host=useRef<any>(null),map=useRef<LeafletMap|null>(null),marker=useRef<LeafletMarker|null>(null);
 const current=useRef({value,disabled,onSelect});current.current={value,disabled,onSelect};
 useEffect(()=>{if(!open||!host.current)return;let active=true;let instance:LeafletMap|null=null;setError(null);
  void import('leaflet').then(L=>{if(!active)return;const start=pickupMapPoint(current.current.value)??STUDIO_COORDS;
   instance=L.map(host.current,{attributionControl:true,zoomControl:true}).setView([start.lat,start.lng],14);map.current=instance;
   L.tileLayer(PICKUP_MAP_TILES,{maxZoom:19,minZoom:2,attribution:PICKUP_MAP_ATTRIBUTION,keepBuffer:0,updateWhenIdle:true}).on('tileerror',()=>{if(active)setError('Map unavailable · Try again or use current location')}).addTo(instance);
   const icon=L.divIcon({className:'autodeck-pickup-pin',html:'<span style="display:block;width:24px;height:24px;border-radius:50% 50% 50% 0;background:#ec8638;border:3px solid white;transform:rotate(-45deg);box-shadow:0 1px 8px #333"></span>',iconSize:[30,30],iconAnchor:[15,30]});
   const select=(raw:MapPoint)=>{if(current.current.disabled)return;const p=pickupMapPoint({lat:raw.lat,lng:raw.lng>=-180&&raw.lng<=180?raw.lng:((raw.lng+180)%360+360)%360-180});if(!p||!instance)return;setSelected(p);if(marker.current)marker.current.setLatLng([p.lat,p.lng]);else{marker.current=L.marker([p.lat,p.lng],{draggable:true,icon}).addTo(instance);marker.current.on('dragend',()=>{const next=pickupMapPoint(marker.current!.getLatLng());if(next)setSelected(next)})}};
   instance.on('click',(event:{latlng:MapPoint})=>select(event.latlng));if(current.current.value)select(current.current.value);
  }).catch(()=>{if(active)setError('Map unavailable · Try again or use current location')});
  return()=>{active=false;instance?.remove();map.current=null;marker.current=null};
 },[open]);
 useEffect(()=>{if(disabled)setOpen(false)},[disabled]);
 return<View style={{gap:12}}>{!open?<Button label="Choose on map" kind="quiet" disabled={disabled} onPress={()=>{setSelected(value);setOpen(true)}}/>:<>
  <T role="caption" tone="secondary">Tap the pickup/drop address · Move the pin</T>
  {createElement('div',{ref:host,role:'region','aria-label':'Choose pickup/drop location',style:{height:280,width:'100%',borderRadius:16,overflow:'hidden',position:'relative',isolation:'isolate'}})}
  {selected?<T role="caption" tone="secondary">Pin · {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</T>:<T role="caption" tone="secondary">No location selected</T>}
  {error?<T role="caption" tone="secondary">{error}</T>:null}
  <Button label="Use this location" disabled={disabled||!selected||!!error} onPress={()=>{if(selected&&!disabled&&!error){current.current.onSelect(selected);setOpen(false)}}}/>
  <Button label="Cancel map" kind="quiet" onPress={()=>setOpen(false)}/>
 </>}</View>;
}
