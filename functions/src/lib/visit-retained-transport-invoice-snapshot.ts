import {isDeepStrictEqual} from 'node:util';
import {HttpsError} from 'firebase-functions/v2/https';
import {retainedTransportChargeBasis} from './visit-retained-transport-charge-basis.js';
import {visitReturnHash} from './visit-service-return-state.js';
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const fail=():never=>{throw new HttpsError('failed-precondition','Retained journey invoice snapshot needs review.');};
/** DORMANT strict snapshot contract. Parsing is NOT issuance, funding proof,
 * tax approval, access permission or permission to relax cancellation guards.
 * The future writer must independently prove original scope/choice/funding,
 * duplicate protection and reciprocal obligation/receipt/cancellation markers.
 * No production reader or writer consumes this experimental document kind. */
export function parseRetainedTransportInvoiceSnapshot(raw:unknown){
 if(!record(raw)||raw['kind']!=='visit_retained_transport_invoice'||raw['version']!==1||raw['status']!=='issued'||raw['currency']!=='INR'||
  !['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId','obligationId'].every(k=>id(raw[k]))||
  !hash(raw['sourceReviewHash'])||!hash(raw['originalRequestHash'])||raw['id']!=='vti_'+visitReturnHash([raw['tenantId'],raw['obligationId']])||
  !text(raw['invoiceNumber'])||typeof raw['issuedAt']!=='string'||!Number.isFinite(Date.parse(raw['issuedAt']))||
  !record(raw['originalBreakdown'])||!Array.isArray(raw['retainedLegs'])||!record(raw['basis'])||
  raw['snapshotHash']!==visitReturnHash({...raw,snapshotHash:undefined}))return fail();
 const allowed=new Set(['id','version','kind','status','tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId','obligationId','sourceReviewHash','originalRequestHash','currency','invoiceNumber','issuedAt','originalBreakdown','retainedLegs','basis','customerSnapshot','vehicleSnapshot','issuerSnapshot','snapshotHash']);
 if(Object.keys(raw).some(k=>!allowed.has(k)))return fail();
 const basis=retainedTransportChargeBasis(raw['originalBreakdown'] as any,raw['retainedLegs']);
 if(!isDeepStrictEqual(basis,raw['basis'])||basis.amountPaise<=0||!record(raw['customerSnapshot'])||!text(raw['customerSnapshot']['name'])||
  !record(raw['vehicleSnapshot'])||!['make','model','registrationNumber'].every(k=>text(raw['vehicleSnapshot'][k]))||
  !record(raw['issuerSnapshot'])||!['tradeName','legalName','address','phone','email'].every(k=>text(raw['issuerSnapshot'][k]))||
  typeof raw['issuerSnapshot']['gstRegistered']!=='boolean'||!(raw['issuerSnapshot']['gstin']===null||text(raw['issuerSnapshot']['gstin']))||
  raw['issuerSnapshot']['gstRegistered']!==!!raw['issuerSnapshot']['gstin'])return fail();
 // Allowlist only invoice content. Source hashes, full cancelled-service prices,
 // request, obligation and actor identities never cross this projection.
 return{id:raw['id'] as string,invoiceNumber:raw['invoiceNumber'] as string,issuedAt:raw['issuedAt'] as string,currency:'INR' as const,
  totalPaise:basis.amountPaise,subtotalPaise:basis.subtotalPaise,taxPaise:basis.taxPaise,taxRatePercent:basis.taxRatePercent,discountPaise:0,roundOffPaise:0,
  roundingPolicy:basis.roundingPolicy,customerSnapshot:{name:raw['customerSnapshot']['name'] as string},
  vehicleSnapshot:Object.fromEntries(['make','model','registrationNumber'].map(k=>[k,raw['vehicleSnapshot'][k] as string])),
  issuerSnapshot:{tradeName:raw['issuerSnapshot']['tradeName'] as string,legalName:raw['issuerSnapshot']['legalName'] as string,address:raw['issuerSnapshot']['address'] as string,phone:raw['issuerSnapshot']['phone'] as string,email:raw['issuerSnapshot']['email'] as string,gstRegistered:raw['issuerSnapshot']['gstRegistered'] as boolean,gstin:raw['issuerSnapshot']['gstin'] as string|null},
  components:basis.components.map(c=>({leg:c.leg,description:c.leg==='pickup'?'Retained original pickup':'Retained original drop',quantity:1,unitPrice:c.basePaise,total:c.basePaise,taxPaise:c.taxPaise,amountPaise:c.totalPaise}))};
}
