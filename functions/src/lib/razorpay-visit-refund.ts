import type {VisitRefundPort} from './visit-online-return.js';
import type {VisitRefundEvidence} from './visit-online-return-state.js';

export type VisitRefundHttpRequest={method:'GET'|'POST';path:string;headers?:Record<string,string>;body?:Record<string,unknown>};
export type VisitRefundHttpTransport=(request:VisitRefundHttpRequest)=>Promise<{status:number;body:unknown}>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const paymentId=(v:unknown):v is string=>typeof v==='string'&&/^pay_[A-Za-z0-9_-]{1,116}$/.test(v);
const refundId=(v:unknown):v is string=>typeof v==='string'&&/^rfnd_[A-Za-z0-9_-]{1,115}$/.test(v);
const reference=(v:unknown):v is string=>typeof v==='string'&&/^vor_[a-f0-9]{64}$/.test(v);
const fail=():never=>{throw Error('Original visit refund provider evidence needs review.');};
/** Keep observed entity fields separate. Never infer currency, payment, receipt
 * or success from the request, HTTP status, notes or an embedded payment. */
function entity(raw:unknown){
 if(!object(raw)||raw['entity']!=='refund'||!refundId(raw['id'])||!paymentId(raw['payment_id'])||
  !Number.isSafeInteger(raw['amount'])||(raw['amount'] as number)<=0||raw['currency']!=='INR'||
  !(raw['receipt']===null||typeof raw['receipt']==='string')||!['pending','processed','failed'].includes(raw['status'] as string))return fail();
 return{id:raw['id'],paymentId:raw['payment_id'],amountPaise:raw['amount'] as number,currency:'INR' as const,referenceId:raw['receipt'],status:raw['status'] as VisitRefundEvidence['status']};
}
function evidence(raw:unknown):VisitRefundEvidence{
 const e=entity(raw);if(!reference(e.referenceId))return fail();return{...e,referenceId:e.referenceId};
}
/** DORMANT injected protocol only. No fetch, credentials, factory, scheduler,
 * callable, webhook or production import. Constructing it makes no request.
 * The committed one-submit runner owns create. No retry, balance release or
 * status projection occurs here, including on 409, pending, failed or a miss.
 *
 * Official contracts checked 15 Nov 2026:
 * https://razorpay.com/docs/us/api/refunds/create-normal
 * https://razorpay.com/docs/api/refunds/normal-refunds-idempotent
 * https://razorpay.com/docs/us/api/refunds/fetch-with-id
 * https://razorpay.com/docs/us/api/refunds/fetch-multiple-refund-payment
 */
export class RazorpayVisitRefundProtocol implements VisitRefundPort{
 constructor(private readonly http:VisitRefundHttpTransport){}
 async create(input:Parameters<VisitRefundPort['create']>[0]){
  if(!input||!paymentId(input.providerPaymentId)||!reference(input.referenceId)||input.currency!=='INR'||!Number.isSafeInteger(input.amountPaise)||input.amountPaise<=0)return fail();
  const response=await this.http({method:'POST',path:'/payments/'+encodeURIComponent(input.providerPaymentId)+'/refund',headers:{'X-Refund-Idempotency':input.referenceId},body:{amount:input.amountPaise,speed:'normal',receipt:input.referenceId}});
  if(!Number.isInteger(response.status)||response.status<200||response.status>=300||!object(response.body)||response.body['entity']!=='refund'||!refundId(response.body['id']))return fail();
  // Even a response that says processed is only a candidate. The runner saves
  // this identity before a separate GET proves payment/amount/currency/receipt.
  return{id:response.body['id']};
 }
 async fetch(id:string):Promise<VisitRefundEvidence>{
  if(!refundId(id))return fail();
  const response=await this.http({method:'GET',path:'/refunds/'+encodeURIComponent(id)});
  if(!Number.isInteger(response.status)||response.status<200||response.status>=300)return fail();
  const e=evidence(response.body);if(e.id!==id)return fail();return e;
 }
 async discover(referenceId:string,providerPaymentId:string){
  if(!reference(referenceId)||!paymentId(providerPaymentId))return fail();
  const response=await this.http({method:'GET',path:'/payments/'+encodeURIComponent(providerPaymentId)+'/refunds?count=100&skip=0'});
  const body=response.body;
  if(!Number.isInteger(response.status)||response.status<200||response.status>=300||!object(body)||body['entity']!=='collection'||
   Object.keys(body).some(k=>!['entity','count','items'].includes(k))||!Array.isArray(body['items'])||!Number.isSafeInteger(body['count'])||body['count']!==body['items'].length||body['items'].length>100)return fail();
  const rows=body['items'].map(entity);
  if(rows.some(e=>e.paymentId!==providerPaymentId)||new Set(rows.map(e=>e.id)).size!==rows.length)return fail();
  // A full page may hide another match. No unbounded/page-loop account traffic.
  // A shorter page is a bounded discovery result, NEVER proof of absence or a
  // refund-finality grant: the runner only accepts exactly one exact match and
  // independently fetches it; every empty/partial/ambiguous result stays held.
  if(rows.length===100)return{complete:false,refunds:[]};
  return{complete:true,refunds:rows.filter(e=>e.referenceId===referenceId).map(e=>({...e,referenceId}))};
 }
}
