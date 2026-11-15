import { expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { inspectVisitProviderWebhook } from '../../lib/visit-provider-webhook';
import { RazorpayProvider } from '../../lib/razorpay-provider';
const key = 'synthetic-test-webhook-not-a-live-secret';
const verifier = new RazorpayProvider('synthetic-key','synthetic-secret',key);
const body = () => ({ event:'payment_link.paid', payload: {
  payment_link:{entity:{id:'plink_fixture',reference_id:'vp_'+'a'.repeat(32),order_id:'order_fixture',amount:1000,amount_paid:1000,currency:'INR',status:'paid',accept_partial:false}},
  payment:{entity:{id:'pay_fixture',order_id:'order_fixture',amount:1000,currency:'INR',status:'captured',captured:true,amount_refunded:0}}
} });
const inspect = (value: unknown, eventId='event_fixture') => {const raw=JSON.stringify(value),signature=createHmac('sha256',key).update(raw).digest('hex');return inspectVisitProviderWebhook(raw,signature,eventId,i=>verifier.verifyWebhookSignature(i));};
it('real HMAC verification precedes parsing and rejects unsigned or changed raw bytes',()=>{const verify=vi.fn(()=>false);expect(()=>inspectVisitProviderWebhook('{not-json','invalid','',verify)).toThrow('signature');expect(verify).toHaveBeenCalledTimes(1);const raw=JSON.stringify(body()),signature=createHmac('sha256',key).update(raw).digest('hex');expect(()=>inspectVisitProviderWebhook(raw+' ',signature,'',i=>verifier.verifyWebhookSignature(i))).toThrow('signature');});
it('complete explicit paired entities produce minimal captured evidence, no customer/private payload',()=>{expect(inspect(body())).toEqual({outcome:'capture',evidence:{eventType:'payment_link.paid',eventId:'event_fixture',referenceId:'vp_'+'a'.repeat(32),providerPaymentId:'pay_fixture',providerLinkId:'plink_fixture',providerOrderId:'order_fixture',amountPaise:1000,currency:'INR'}});});
it('fallback identity hashes the exact verified raw body, ignoring untrusted body id',()=>{const b={...body(),id:'not-an-authoritative-event-id'},first=inspect(b,'');expect(first).toEqual(inspect(b,''));expect(first).toMatchObject({outcome:'capture',evidence:{eventId:expect.stringMatching(/^[a-f0-9]{64}$/)}});});
it.each(['currency','id','order_id','status','captured','amount','amount_refunded'])('missing payment %s cannot inherit a convenient default',field=>{const b:any=body();delete b.payload.payment.entity[field];expect(inspect(b)).toEqual({outcome:'review_required'});});
it.each(['currency','id','order_id','reference_id','status','amount','amount_paid','accept_partial'])('missing link %s cannot inherit a convenient default',field=>{const b:any=body();delete b.payload.payment_link.entity[field];expect(inspect(b)).toEqual({outcome:'review_required'});});
it.each([{currency:'USD'},{order_id:'order_other'},{amount:999},{amount:1001},{amount:1.5},{amount_refunded:1},{status:'authorized'},{captured:false}])('conflicting payment cannot journal an allocation: %j',patch=>{const b=body();Object.assign(b.payload.payment.entity,patch);expect(inspect(b)).toEqual({outcome:'review_required'});});
it.each([{currency:'USD'},{order_id:'order_other'},{amount:999},{amount_paid:999},{status:'partially_paid'},{accept_partial:true},{reference_id:'vp_invalid'}])('conflicting link cannot journal an allocation: %j',patch=>{const b=body();Object.assign(b.payload.payment_link.entity,patch);expect(inspect(b)).toEqual({outcome:'review_required'});});
it.each(['payment.captured','payment.failed','payment_link.partially_paid','payment_link.expired','payment_link.cancelled'])('unsupported %s remains review-required, never no-money evidence',event=>expect(inspect({...body(),event})).toEqual({outcome:'review_required'}));
it('an explicitly different reference is unrelated, but a payment-only capture lacks sufficient routing identity',()=>{const b=body();b.payload.payment_link.entity.reference_id='legacy-payment';expect(inspect(b)).toEqual({outcome:'unrelated'});expect(inspect({event:'payment.captured',payload:{payment:b.payload.payment}})).toEqual({outcome:'review_required'});});
it.each([null,[],{},'bad'])('malformed signed content stays held: %j',b=>expect(inspect(b)).toEqual({outcome:'review_required'}));
it('invalid event headers cannot become a stored identity',()=>expect(inspect(body(),'../../external')).toEqual({outcome:'review_required'}));
