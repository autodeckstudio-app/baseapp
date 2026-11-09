import type { Membership } from '@autodeck/core';
/** Display-only. The booking transaction chooses and reserves again; never charge
 * a paid fallback when the reviewed free credit was taken by another booking. */
export function reviewedPickupEntitlement(list:Membership[],scope:{tenantId:string;customerId:string;visitDate:string;today:string}):string|null{
 const candidates=list.filter(m=>m.tenantId===scope.tenantId&&m.customerId===scope.customerId&&m.status==='active'&&Number.isSafeInteger(m.pickupsTotal)&&Number.isSafeInteger(m.pickupsUsed??0)&&(m.pickupsUsed??0)>=0&&(m.pickupsUsed??0)<(m.pickupsTotal??0)&&(!m.endDate||m.endDate.slice(0,10)>=scope.today||m.endDate.slice(0,10)>=scope.visitDate)).sort((a,b)=>(a.endDate??'9999').localeCompare(b.endDate??'9999'));
 const m=candidates[0];if(!m)return null;
 if((m.startDate&&m.startDate.slice(0,10)>scope.visitDate)||(m.endDate&&m.endDate.slice(0,10)<scope.visitDate))throw Error('Your transport plan does not cover this visit date. Review the plan and price.');
 return m.id;
}
