export type MapPoint={lat:number;lng:number};
export function pickupMapPoint(value:unknown):MapPoint|null{
 if(!value||typeof value!=='object')return null;const p=value as MapPoint;
 return typeof p.lat==='number'&&Number.isFinite(p.lat)&&p.lat>=-85.05112878&&p.lat<=85.05112878&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&p.lng>=-180&&p.lng<=180?{lat:p.lat,lng:p.lng}:null;
}
/** No key, address, account or booking identifiers enter tile requests. No
 * geocoding, prefetch, cache bypass or background map initialization. */
export const PICKUP_MAP_TILES='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const PICKUP_MAP_ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
