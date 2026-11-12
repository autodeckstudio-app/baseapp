import {pickupLegFeePaiseForRoadMeters} from './pickup-zone.js';
/** Immutable tariff versions. Missing ID on an already-issued quote means legacy, never current. */
export const LEGACY_PICKUP_TARIFF='road25-v1' as const;
export const CURRENT_PICKUP_TARIFF='base20-road12-v2' as const;
export type PickupTariffVersion=typeof LEGACY_PICKUP_TARIFF|typeof CURRENT_PICKUP_TARIFF;
export function pickupTariffVersion(value:unknown):PickupTariffVersion {
 if(value===undefined||value===LEGACY_PICKUP_TARIFF)return LEGACY_PICKUP_TARIFF;
 if(value===CURRENT_PICKUP_TARIFF)return CURRENT_PICKUP_TARIFF;
 throw Error('Unknown transport pricing policy. Check the distance again.');
}
export function pickupTariffLegFeePaise(m:number,version:unknown):number {
 if(!Number.isSafeInteger(m)||m<0)throw Error('Transport distance is invalid.');
 const v=pickupTariffVersion(version);
 if(v===LEGACY_PICKUP_TARIFF)return pickupLegFeePaiseForRoadMeters(m);
 return m<=3000?0:m<=5000?2000:2000+Math.round((m-5000)*1200/1000);
}
