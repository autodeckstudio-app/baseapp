import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { recordExternalReturn } from "../../functions/payment/recordExternalReturn.js";
import { initiateRefund } from "../../functions/payment/initiateRefund.js";
import { reconcileLegacyRefundClaim, reconcileLegacyRefundClaims } from "../../lib/refund-claims.js";
import { listRefundWork } from "../../functions/payment/listRefundWork.js";
import { mockProvider } from "../../lib/mock-payment-provider.js";
import { reserveRefund } from "../../lib/refund-outbox.js";
import type { Payment } from "@autodeck/core";
const db = getFirestore();
const auth = { uid: "owner", token: { role: "admin", tenantId: "ext-t", studioId: null } };
let seq = 0;
async function seed() {
 const ids = [`ext-a-${Date.now()}-${++seq}`, `ext-b-${Date.now()}-${++seq}`];
 for (const id of ids) await db.collection("payments").doc(id).set({ id, tenantId: "ext-t", studioId: null, customerId: "ext-c", amount: 90000, currency: "INR", status: "completed", method: "razorpay_payment_link", razorpayPaymentId: `provider-${id}`, refundAmount: null, razorpayRefundId: null, bookingId: null, jobId: null });
 return { paymentIds: ids, totalPaise: 180000, sourceReference: "owner-message-123", statement: "I returned it manually" };
}
const call = (data: unknown, a = auth) => recordExternalReturn.run({ data, auth: a } as never);
describe("aggregate external return, no provider or production writes", () => {
 it("preserves provider facts and unknowns, holds both paths, idempotent, audits once", async () => {
  const d = await seed(); const result = await call(d) as {recordId:string};
  expect(await call({...d,paymentIds:[...d.paymentIds].reverse()})).toEqual({recordId:result.recordId,alreadyRecorded:true});
  const rec=(await db.collection("paymentEvents").doc(result.recordId).get()).data()!;
  expect(rec).toMatchObject({totalPaise:180000,returnedAt:null,returnMethod:null,returnReference:null,allocation:null,sourceReference:d.sourceReference});
  for(const id of d.paymentIds) {
   const p=(await db.collection("payments").doc(id).get()).data() as Payment;
   expect(p).toMatchObject({status:"completed",amount:90000,refundAmount:null,razorpayRefundId:null,externalReturnRecordId:result.recordId});
   await expect(initiateRefund.run({data:{paymentId:id,reason:"must not refund"},auth} as never)).rejects.toThrow(/external return/);
   await expect(reserveRefund(db,{payment:p,amountPaise:90000,reason:"no duplicate",createdBy:"owner"})).rejects.toThrow(/external return/);
  }
  expect((await db.collection("auditLog").where("entityId","==",result.recordId).get()).size).toBe(1);
 });
 it("rejects mismatched total, mixed customer, missing/foreign payment, duplicate ids and staff",async()=>{
  const d=await seed(); await expect(call({...d,totalPaise:90000})).rejects.toThrow(/total/);
  await expect(call({...d,paymentIds:[d.paymentIds[0],d.paymentIds[0]]})).rejects.toThrow(/Duplicate/);
  await expect(call(d,{...auth,token:{...auth.token,role:"studio"}})).rejects.toThrow(/Admin/);
  await db.collection("payments").doc(d.paymentIds[1]!).update({customerId:"other"});await expect(call(d)).rejects.toThrow(/total/);
  await db.collection("payments").doc(d.paymentIds[1]!).update({customerId:"ext-c",tenantId:"foreign"});await expect(call(d)).rejects.toThrow(/Cross-tenant/);
  await db.collection("payments").doc(d.paymentIds[1]!).delete();await expect(call(d)).rejects.toThrow(/missing/);
 });
 it("refuses existing refund activity and any conflicting replay",async()=>{
  const d=await seed();await db.collection("refundRequests").doc(`old-${d.paymentIds[0]}`).set({paymentId:d.paymentIds[0],status:"failed"});
  await expect(call(d)).rejects.toThrow(/refund activity/);
  const e=await seed();await call(e);await expect(call({...e,statement:"different"})).rejects.toThrow(/differs/);
 });
 it("concurrent recording and refund reservation cannot both win",async()=>{
  const d=await seed();const p=(await db.collection("payments").doc(d.paymentIds[0]!).get()).data() as Payment;
  const results=await Promise.allSettled([call(d),reserveRefund(db,{payment:p,amountPaise:90000,reason:"race",createdBy:"owner"})]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 });
 it("direct reconcile, sweep and list never treat external holds as provider claims",async()=>{
  const d=await seed();await call(d);
  const actor={uid:"owner",claims:auth.token} as never;
  const before=await Promise.all(d.paymentIds.map(id=>db.collection("paymentEvents").doc(`refund_${id}`).get()));
  const provider={...mockProvider,findRefundByReference:async()=>{throw Error("external hold must not query provider")}} as never;
  for(const id of d.paymentIds)expect(await reconcileLegacyRefundClaim(db,provider,id,actor)).toBe("skipped");
  await reconcileLegacyRefundClaims(db,provider,{tenantId:"ext-t",actor});
  const listed=await listRefundWork.run({data:{knownClaimPaymentIds:d.paymentIds},auth} as never) as {legacyClaims:Array<{paymentId:string}>;claimTruth:Array<{paymentId:string;state:string}>};
  expect(listed.legacyClaims.some(c=>d.paymentIds.includes(c.paymentId))).toBe(false);
  expect(listed.claimTruth.filter(c=>d.paymentIds.includes(c.paymentId)).map(c=>c.state)).toEqual(["external_return","external_return"]);
  for(let i=0;i<d.paymentIds.length;i++)expect((await db.collection("paymentEvents").doc(`refund_${d.paymentIds[i]}`).get()).data()).toEqual(before[i]!.data());
 });
 it("legacy refund initiation racing external recording cannot both win",async()=>{
  process.env["USE_PAYMENT_MOCK"]="true";
  const d=await seed(); const results=await Promise.allSettled([call(d),initiateRefund.run({data:{paymentId:d.paymentIds[0],reason:"race"},auth} as never)]);
  const p=(await db.collection("payments").doc(d.paymentIds[0]!).get()).data()!;
  const claim=(await db.collection("paymentEvents").doc(`refund_${d.paymentIds[0]}`).get()).data()!;
  if(p.externalReturnRecordId){expect(claim.kind).toBe("external_return_hold");expect(results[1]!.status).toBe("rejected");expect(p.refundAmount).toBeNull();}
  else {expect(results[0]!.status).toBe("rejected");expect(claim.kind).not.toBe("external_return_hold");}
 });

 it("deterministic ordering: external return first refuses legacy initiation with untouched provider fields",async()=>{
  const d=await seed();await call(d);
  await expect(initiateRefund.run({data:{paymentId:d.paymentIds[0],reason:"later refund"},auth} as never)).rejects.toThrow(/external return/);
  const p=(await db.collection("payments").doc(d.paymentIds[0]!).get()).data()!;
  expect(p.status).toBe("completed");expect(p.refundAmount).toBeNull();
 });
 it("deterministic ordering: legacy initiation first refuses external recording without overwriting claim",async()=>{
  process.env["USE_PAYMENT_MOCK"]="true";const d=await seed();
  await initiateRefund.run({data:{paymentId:d.paymentIds[0],reason:"first refund"},auth} as never).catch(()=>undefined);
  const ref=db.collection("paymentEvents").doc(`refund_${d.paymentIds[0]}`);const before=await ref.get();
  expect(before.exists).toBe(true);
  expect(before.data()!.paymentId).toBe(d.paymentIds[0]);
  expect(before.data()!.claimedBy).toBe("owner");
  expect(before.data()!.kind).not.toBe("external_return_hold");
  await expect(call(d)).rejects.toThrow();
  expect((await ref.get()).data()).toEqual(before.data());
  for (const id of d.paymentIds) expect((await db.collection("payments").doc(id).get()).data()!.externalReturnRecordId).toBeUndefined();
  expect((await db.collection("paymentEvents").where("kind","==","owner_attested_external_return").where("paymentIds","array-contains",d.paymentIds[0]).get()).empty).toBe(true);
 });

});
