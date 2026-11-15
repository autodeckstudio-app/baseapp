import {HttpsError} from 'firebase-functions/v2/https';
import {originalTransportComponents} from './visit-transport-return-review.js';
import {visitReturnHash} from './visit-service-return-state.js';
type Snapshot=Parameters<typeof originalTransportComponents>[0];
type Leg='pickup'|'drop';
const fail=():never=>{throw new HttpsError('failed-precondition','Original retained journey charge needs review.');};
/** DORMANT arithmetic candidate, not an invoice, receivable, payment allocation
 * or permission to cancel. A trusted execution must separately re-read scope,
 * saved leg choice, original request, original funding and issued history.
 * Never squeeze this into a full-job shared-invoice component or re-round the
 * exact retained original paise to a new rupee total. */
export function retainedTransportChargeBasis(pb:Snapshot,retainedLegs:readonly Leg[]){
 if(!Array.isArray(retainedLegs)||!retainedLegs.length||retainedLegs.length>2||new Set(retainedLegs).size!==retainedLegs.length||retainedLegs.some(l=>!['pickup','drop'].includes(l)))return fail();
 const original=originalTransportComponents(pb),legs:Leg[]=['pickup','drop'].filter((l):l is Leg=>retainedLegs.includes(l as Leg));
 const components=legs.map(leg=>({leg,...original[leg]})),subtotalPaise=components.reduce((n,c)=>n+c.basePaise,0),taxPaise=components.reduce((n,c)=>n+c.taxPaise,0),amountPaise=components.reduce((n,c)=>n+c.totalPaise,0);
 if(![subtotalPaise,taxPaise,amountPaise].every(n=>Number.isSafeInteger(n)&&n>=0)||subtotalPaise+taxPaise!==amountPaise)return fail();
 return{kind:'original_retained_transport_basis' as const,currency:'INR' as const,originalBreakdownHash:visitReturnHash(pb),originalTotalPaise:pb.total,
  taxRatePercent:pb.taxRatePercent,taxAllocation:'original_service_pickup_drop_marginal' as const,roundingPolicy:'original_transport_component_no_reround' as const,
  subtotalPaise,discountPaise:0 as const,taxPaise,roundOffPaise:0 as const,amountPaise,components};
}
