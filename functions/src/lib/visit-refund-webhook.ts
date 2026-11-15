import {createHash} from 'node:crypto';
import type {VerifyWebhookParams} from './payment-provider.js';
import type {VisitRefundEvidence} from './visit-online-return-state.js';
type Inspection={outcome:'unrelated'}|{outcome:'review_required';referenceId:string|null}|{outcome:'refund_hint';referenceId:string;evidence:VisitRefundEvidence};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
/** DORMANT raw-body inspection only, no production route. Signature validation
 * precedes parsing. Signed refund events are reconciliation hints, NEVER
 * independently fetched evidence or authority to project actual returns.
 * Official payload/signature contract: https://razorpay.com/docs/webhooks/refunds */
export function inspectVisitRefundWebhook(rawBody:string,signature:string,headerEventId:string,verify:(input:VerifyWebhookParams)=>boolean){
 if(!rawBody||!signature||!verify({rawBody,signature}))throw Error('Invalid provider signature.');
 const payloadHash=createHash('sha256').update(rawBody).digest('hex'),eventId=headerEventId||payloadHash;
 let inspection:Inspection={outcome:'review_required',referenceId:null};
 let body:Record<string,any>|null=null;try{const parsed:unknown=JSON.parse(rawBody);if(object(parsed))body=parsed;}catch{/* verified malformed evidence remains review */}
 const payload=body&&object(body['payload'])?body['payload']:null;
 const refund=payload&&object(payload['refund'])&&object(payload['refund']['entity'])?payload['refund']['entity']:null;
 const receipt=refund?.['receipt'];
 const referenceId=typeof receipt==='string'&&/^vor_[a-f0-9]{64}$/.test(receipt)?receipt:null;
 if(typeof receipt==='string'&&receipt.length>0&&!receipt.startsWith('vor_'))inspection={outcome:'unrelated'};
 else if(body&&refund&&referenceId){
  inspection={outcome:'review_required',referenceId};
  const payment=payload&&object(payload['payment'])&&object(payload['payment']['entity'])?payload['payment']['entity']:null;
  const event=body['event'],status=refund['status'];
  if(id(eventId)&&body['entity']==='event'&&['refund.created','refund.processed','refund.failed'].includes(event)&&
   refund['entity']==='refund'&&id(refund['id'])&&refund['id'].startsWith('rfnd_')&&id(refund['payment_id'])&&refund['payment_id'].startsWith('pay_')&&
   money(refund['amount'])&&refund['amount']>0&&refund['currency']==='INR'&&['pending','processed','failed'].includes(status)&&
   (event!=='refund.processed'||status==='processed')&&(event!=='refund.failed'||status==='failed')&&
   payment&&payment['entity']==='payment'&&payment['id']===refund['payment_id']&&payment['currency']==='INR'&&
   payment['captured']===true&&payment['status']==='captured'&&money(payment['amount'])&&payment['amount']>=refund['amount']&&
   money(payment['amount_refunded'])&&payment['amount_refunded']<=payment['amount']&&(status!=='processed'||payment['amount_refunded']>=refund['amount'])){
   inspection={outcome:'refund_hint',referenceId,evidence:{id:refund['id'],paymentId:refund['payment_id'],amountPaise:refund['amount'],currency:'INR',referenceId,status}};
  }
 }
 if(!id(eventId)&&inspection.outcome!=='unrelated')inspection={outcome:'review_required',referenceId};
 return{...inspection,eventId:id(eventId)?eventId:payloadHash,payloadHash};
}
