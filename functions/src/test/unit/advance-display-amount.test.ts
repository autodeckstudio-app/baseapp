/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ store: new Map<string, any>() }));

vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "subj" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../../lib/advance-payment.js", async (importOriginal) => {
  const mod = await importOriginal<any>();
  // In-process flag seam ONLY (production flag untouched, stays FALSE):
  // exercises the exact handler code the deployed function runs post-activation.
  return { ...mod, advancePaymentEnabled: () => true };
});
vi.mock("firebase-admin/firestore", () => {
  const key = (coll: string, id: string) => `${coll}/${id}`;
  const snap = (coll: string, id: string) => ({ exists: h.store.has(key(coll, id)), data: () => h.store.get(key(coll, id)) });
  const applyUpdate = (cur: any, patch: any) => {
    const out = { ...(cur ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v && (v as any).__arrayUnion !== undefined) out[k] = [...(cur?.[k] ?? []), (v as any).__arrayUnion];
      else out[k] = v;
    }
    return out;
  };
  const makeRef = (coll: string, id: string): any => ({
    id,
    __coll: coll,
    get: async () => snap(coll, id),
    set: async (data: any) => { h.store.set(key(coll, id), { ...data }); },
    update: async (patch: any) => { h.store.set(key(coll, id), applyUpdate(h.store.get(key(coll, id)), patch)); },
  });
  const tx = {
    get: async (ref: any) => snap(ref.__coll, ref.id),
    set: (ref: any, data: any) => { h.store.set(key(ref.__coll, ref.id), { ...data }); },
    update: (ref: any, patch: any) => { h.store.set(key(ref.__coll, ref.id), applyUpdate(h.store.get(key(ref.__coll, ref.id)), patch)); },
  };
  const db: any = {
    collection: (coll: string) => ({ doc: (id: string) => makeRef(coll, id) }),
    runTransaction: async (fn: any) => fn(tx),
  };
  return { getFirestore: () => db, FieldValue: { arrayUnion: (v: any) => ({ __arrayUnion: v }) } };
});


import { requestAdvancePayment } from "../../functions/payment/requestAdvancePayment.js";

vi.mock('../../lib/razorpay-provider.js',()=>({getPaymentProvider:()=>{throw new Error('PROVIDER MUST NOT BE CALLED')}}));
const booking={id:'b',tenantId:'t',studioId:'s',customerId:'c',status:'PENDING',paymentStatus:'unpaid',payMode:'studio',holdExpiresAt:new Date(Date.now()+900000).toISOString(),priceBreakdown:{subtotal:10001,pickupFee:0,dropFee:0,membershipDiscount:null,taxRatePercent:0,total:10001,currency:'INR'}};
const req=()=>({data:{bookingId:'b',expectedAdvancePaise:2000},auth:{uid:'c',token:{role:'customer',tenantId:'t',studioId:'s'}}} as any);
beforeEach(()=>{h.store.clear();h.store.set('bookings/b',{...booking});h.store.set('customers/c',{authUid:'c',tenantId:'t'})});
describe('displayed advance money guard (no network)',()=>{
it('price changed after preview rejects before payment claim, provider or booking update',async()=>{await expect(requestAdvancePayment.run(req())).rejects.toMatchObject({code:'failed-precondition',details:{reason:'advance_amount_changed'}});expect(h.store.size).toBe(2);expect(h.store.get('bookings/b').advancePaymentId).toBeUndefined()});
it('retry with a different existing payment amount rejects without provider reconciliation or writes',async()=>{h.store.set('bookings/b',{...booking,advancePaymentId:'advance-b'});h.store.set('payments/advance-b',{id:'advance-b',targetType:'booking',jobId:null,studioId:'s',currency:'INR',method:'razorpay_payment_link',bookingId:'b',customerId:'c',tenantId:'t',amount:2100,status:'pending'});await expect(requestAdvancePayment.run(req())).rejects.toMatchObject({details:{reason:'advance_amount_changed'}});expect(h.store.size).toBe(3);expect(h.store.get('payments/advance-b')).toEqual({id:'advance-b',targetType:'booking',jobId:null,studioId:'s',currency:'INR',method:'razorpay_payment_link',bookingId:'b',customerId:'c',tenantId:'t',amount:2100,status:'pending'})});
});
