import {isDeepStrictEqual} from 'node:util';
import {HttpsError} from 'firebase-functions/v2/https';
import {retainedTransportChargeBasis} from './visit-retained-transport-charge-basis.js';
import {visitReturnHash} from './visit-service-return-state.js';
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const fail=():never=>{throw new HttpsError('failed-precondition','Retained journey invoice snapshot needs review.');};
/** Strict distinct-original snapshot. Parsing is not funding proof or access
 * permission. The authenticated reader must verify original scope, choice,
 * captured funds and reciprocal original cancellation markers first. */
export function parseRetainedTransportInvoiceSnapshot(raw:unknown){
 if(!record(raw)||raw['kind']!=='visit_retained_transport_invoice'||![1,2].includes(raw['version'])||raw['status']!=='issued'||raw['currency']!=='INR'||
  !['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId','obligationId'].every(k=>id(raw[k]))||
  !hash(raw['sourceReviewHash'])||!hash(raw['originalRequestHash'])||raw['id']!=='vti_'+visitReturnHash([raw['tenantId'],raw['obligationId']])||
  !text(raw['invoiceNumber'])||typeof raw['issuedAt']!=='string'||!Number.isFinite(Date.parse(raw['issuedAt']))||
  !record(raw['originalBreakdown'])||!Array.isArray(raw['retainedLegs'])||!record(raw['basis'])||
  raw['snapshotHash']!==visitReturnHash({...raw,snapshotHash:undefined}))return fail();
 const allowed=new Set(['id','version','kind','status','tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId','obligationId','sourceReviewHash','originalRequestHash','currency','invoiceNumber','issuedAt','originalBreakdown','retainedLegs','basis','customerSnapshot','vehicleSnapshot','issuerSnapshot','snapshotHash',...(raw['version']===2?['feePaise']:[])]);
 if(Object.keys(raw).some(k=>!allowed.has(k)))return fail();
 const basis=retainedTransportChargeBasis(raw['originalBreakdown'] as any,raw['retainedLegs']),feePaise=raw['version']===2?raw['feePaise']:0;
 if(!Number.isSafeInteger(feePaise)||feePaise<0||!Number.isSafeInteger(basis.amountPaise+feePaise)||!Number.isSafeInteger(basis.subtotalPaise+feePaise)||raw['version']===2&&(feePaise<=0||basis.taxPaise!==0||basis.taxRatePercent!==0))return fail();
 if(!isDeepStrictEqual(basis,raw['basis'])||basis.amountPaise<=0||!record(raw['customerSnapshot'])||!text(raw['customerSnapshot']['name'])||
  !record(raw['vehicleSnapshot'])||!['make','model','registrationNumber'].every(k=>text(raw['vehicleSnapshot'][k]))||
  !record(raw['issuerSnapshot'])||!['tradeName','address','phone'].every(k=>text(raw['issuerSnapshot'][k]))||
  ['legalName','email'].some(k=>raw['issuerSnapshot'][k]!==undefined&&!text(raw['issuerSnapshot'][k]))||
  typeof raw['issuerSnapshot']['gstRegistered']!=='boolean'||!(raw['issuerSnapshot']['gstin']===null||text(raw['issuerSnapshot']['gstin']))||
  raw['issuerSnapshot']['gstRegistered']!==!!raw['issuerSnapshot']['gstin'])return fail();
 // Allowlist only invoice content. Source hashes, full cancelled-service prices,
 // request, obligation and actor identities never cross this projection.
 return{id:raw['id'] as string,invoiceNumber:raw['invoiceNumber'] as string,issuedAt:raw['issuedAt'] as string,currency:'INR' as const,
  totalPaise:basis.amountPaise+feePaise,subtotalPaise:basis.subtotalPaise+feePaise,taxPaise:basis.taxPaise,taxRatePercent:basis.taxRatePercent,discountPaise:0,roundOffPaise:0,
  roundingPolicy:basis.roundingPolicy,customerSnapshot:{name:raw['customerSnapshot']['name'] as string},
  vehicleSnapshot:Object.fromEntries(['make','model','registrationNumber'].map(k=>[k,raw['vehicleSnapshot'][k] as string])),
  issuerSnapshot:{tradeName:raw['issuerSnapshot']['tradeName'] as string,...(raw['issuerSnapshot']['legalName']!==undefined?{legalName:raw['issuerSnapshot']['legalName'] as string}:{}),address:raw['issuerSnapshot']['address'] as string,phone:raw['issuerSnapshot']['phone'] as string,...(raw['issuerSnapshot']['email']!==undefined?{email:raw['issuerSnapshot']['email'] as string}:{}),gstRegistered:raw['issuerSnapshot']['gstRegistered'] as boolean,gstin:raw['issuerSnapshot']['gstin'] as string|null},
  policyFeePaise:feePaise,components:[...basis.components.map(c=>({leg:c.leg,description:c.leg==='pickup'?'Retained original pickup':'Retained original drop',quantity:1,unitPrice:c.basePaise,total:c.basePaise,taxPaise:c.taxPaise,amountPaise:c.totalPaise})),...(feePaise?[{leg:'fee',description:'Cancellation fee - existing booking policy',quantity:1,unitPrice:feePaise,total:feePaise,taxPaise:0,amountPaise:feePaise}]:[])]};
}
