/** Preparation seam only: not imported by any callable. No payment proportion or benefit policy is selected here.
 * Accepts an already-read server quote and binds its exact directed legs to the reviewed booking scope. */
import {pickupLegFeePaiseForRoadMeters} from '@autodeck/core';
export type BookingTransportScope={tenantId:string;customerId:string;kind:'pickup'|'drop'|'both';lat:number;lng:number;quoteId:string;nowMs:number};
export type BookingTransportSnapshot={quoteId:string;kind:'pickup'|'drop'|'both';lat:number;lng:number;expiresAt:string;pickupFeePaise:number;dropFeePaise:number;feePaise:number;legs:ReadonlyArray<Readonly<{leg:'pickup'|'drop';roadMeters:number;feePaise:number}>>};
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Transport quote is missing.');return value as Record<string,unknown>}
function minor(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('Transport quote amount or distance is invalid.');return value}
export function freezeBookingTransportQuote(value:unknown,s:BookingTransportScope):Readonly<BookingTransportSnapshot>{
 const q=record(value);if(!s.quoteId||!Number.isFinite(s.nowMs))throw Error('Transport scope is invalid.');
 if(q['tenantId']!==s.tenantId||q['customerId']!==s.customerId||q['kind']!==s.kind)throw Error('Transport quote does not match the booking.');
 if(q['consumedAt']!==null)throw Error('Transport quote is already used or its consumption state is unknown.');
 const expiresAt=q['expiresAt'];if(typeof expiresAt!=='string'||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=s.nowMs)throw Error('Transport quote expired or expiry is unknown.');
 const lat=q['lat'],lng=q['lng'];if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isFinite(s.lat)||!Number.isFinite(s.lng)||Math.abs(s.lat-lat)>0.005||Math.abs(s.lng-lng)>0.005)throw Error('Transport location changed.');
 if(!Array.isArray(q['legs']))throw Error('Directed transport legs are missing.');
 const expected=s.kind==='both'?['pickup','drop']:[s.kind];const seen=new Set<string>();
 const legs=q['legs'].map(raw=>{const l=record(raw),leg=l['leg'];if((leg!=='pickup'&&leg!=='drop')||!expected.includes(leg)||seen.has(leg))throw Error('Directed transport legs do not match the selection.');seen.add(leg);const roadMeters=minor(l['roadMeters']);return Object.freeze({leg,roadMeters,feePaise:pickupLegFeePaiseForRoadMeters(roadMeters)})});
 if(seen.size!==expected.length)throw Error('A directed transport leg is missing.');
 const feePaise=minor(q['feePaise']);const sum=legs.reduce((n,l)=>n+l.feePaise,0);if(!Number.isSafeInteger(sum)||sum!==feePaise||legs.reduce((n,l)=>n+l.roadMeters,0)!==minor(q['roadMeters']))throw Error('Transport quote total does not match its directed legs.');
 return Object.freeze({quoteId:s.quoteId,kind:s.kind,lat,lng,expiresAt,pickupFeePaise:legs.find(l=>l.leg==='pickup')?.feePaise??0,dropFeePaise:legs.find(l=>l.leg==='drop')?.feePaise??0,feePaise,legs:Object.freeze(legs)});
}
