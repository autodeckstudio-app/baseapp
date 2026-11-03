import { it, expect, beforeAll, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
process.env["USE_PAYMENT_MOCK"] = "true";
import { purchaseMembership } from "../../functions/membership/purchaseMembership.js";
import { upgradeMembership } from "../../functions/membership/upgradeMembership.js";
import { createCheckoutOrder } from "../../functions/payment/createCheckoutOrder.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
const db = getFirestore();
beforeAll(() => { if (!process.env["GCLOUD_PROJECT"]?.startsWith("demo-")) throw new Error("demo emulator required"); });
const auth = (uid: string) => ({ uid, token: { role: "customer", tenantId: "native-member", studioId: null } });
const plan = (id: string, price: number) => ({ id, tenantId: "native-member", active: true, tier: "gold", name: id, priceInPaise: price, includedWashes: 3, discountPercent: 10, freePickups: 0, prioritySlot: false });
it("purchase returns/persists/replays hosted URL and recovers legacy missing-URL from its bound provider link", async () => {
  const id = `native-plan-${Date.now()}`, uid = `native-member-${Date.now()}`; await db.collection("membershipPlans").doc(id).set(plan(id, 90000));
  const req = { data: { planId: id, method: "razorpay_payment_link", idempotencyKey: "native-membership-url-test" }, auth: auth(uid) };
  const first = await purchaseMembership.run(req as never) as { paymentId: string; paymentUrl: string; membershipId: string };
  expect(first.paymentUrl).toContain("mock-razorpay.local"); expect((await db.collection("payments").doc(first.paymentId).get()).data()!.paymentUrl).toBe(first.paymentUrl);
  expect(await purchaseMembership.run(req as never)).toEqual(first);
  process.env["RAZORPAY_KEY_ID"]="local";process.env["RAZORPAY_KEY_SECRET"]="local";
  await expect(createCheckoutOrder.run({data:{paymentId:first.paymentId},auth:auth(uid)} as never)).rejects.toThrow(/existing hosted payment link/);
  delete process.env["RAZORPAY_KEY_ID"];delete process.env["RAZORPAY_KEY_SECRET"];
  await db.collection("payments").doc(first.paymentId).update({ paymentUrl: null });
  expect(await purchaseMembership.run(req as never)).toEqual(first);
});
it("upgrade returns/persists/replays the same hosted URL and same membership/payment", async () => {
  const uid = `native-upgrade-${Date.now()}`, old = `${uid}-old`, target = `${uid}-new`;
  await db.collection("membershipPlans").doc(old).set(plan(old, 90000)); await db.collection("membershipPlans").doc(target).set(plan(target, 180000));
  await db.collection("memberships").doc(`${uid}-active`).set({ id: `${uid}-active`, tenantId: "native-member", customerId: uid, planId: old, status: "active", tier: "silver", washesUsed: 0, washesTotal: 3, pickupsUsed: 0 });
  const req = { data: { planId: target, method: "razorpay_payment_link", idempotencyKey: "native-upgrade-url-test" }, auth: auth(uid) };
  const first = await upgradeMembership.run(req as never) as { paymentId: string; paymentUrl: string };
  expect(first.paymentUrl).toContain("mock-razorpay.local"); expect((await db.collection("payments").doc(first.paymentId).get()).data()!.paymentUrl).toBe(first.paymentUrl);
  expect(await upgradeMembership.run(req as never)).toEqual(first);
  await db.collection("payments").doc(first.paymentId).update({ paymentUrl: null }); expect(await upgradeMembership.run(req as never)).toEqual(first);
});

it("provider response loss leaves committed payment with ambiguity; retry never creates another link", async () => {
 const uid=`native-loss-${Date.now()}`,id=`${uid}-plan`;await db.collection("membershipPlans").doc(id).set(plan(id,90000));
 const api=getPaymentProvider(), original=api.createPaymentLink.bind(api);
 const spy=vi.spyOn(api,"createPaymentLink").mockImplementationOnce(async params=>{await original(params);throw new Error("response lost");});
 const req={data:{planId:id,method:"razorpay_payment_link",idempotencyKey:"response-loss"},auth:auth(uid)};
 await expect(purchaseMembership.run(req as never)).rejects.toThrow(/response lost/);
 const ps=await db.collection("payments").where("customerId","==",uid).get();expect(ps.size).toBe(1);expect(ps.docs[0]!.data().orderAmbiguous).toBe(true);
 const replay=await purchaseMembership.run(req as never) as {paymentId:string,paymentUrl:string|null};expect(replay.paymentId).toBe(ps.docs[0]!.id);expect(replay.paymentUrl).toBeNull();expect(spy).toHaveBeenCalledTimes(1);spy.mockRestore();
});
it("verified orphan capture has a persistent global review alert, no invented ownership", async()=>{
 const {processProviderEvent}=await import("../../lib/razorpay-webhook.js");
 const id=`orphan-${Date.now()}`;const result=await processProviderEvent(db,{eventType:"payment.captured",providerEventId:id,providerPaymentId:id,providerPaymentLinkId:id,providerOrderId:id,referenceId:id,amount:90000,currency:"INR",providerRefundId:null});
 expect(result.outcome).toBe("unknown_payment");const alert=(await db.collection("staffAlerts").doc(`unmatched_capture_${id}`).get()).data()!;expect(alert.tenantId).toBeNull();expect(alert.kind).toBe("unmatched_payment_capture");
});

it.each([[false,true],[false,false],[true,true],[true,false]])("first membership race upgrade=%s sameKey=%s binds one link", async (upgrade,sameKey)=>{
 const uid=`barrier-${Date.now()}-${upgrade}-${sameKey}`,id=`${uid}-new`,old=`${uid}-old`;await db.collection("membershipPlans").doc(id).set(plan(id,180000));
 if(upgrade){await db.collection("membershipPlans").doc(old).set(plan(old,90000));await db.collection("memberships").doc(`${uid}-active`).set({id:`${uid}-active`,tenantId:"native-member",customerId:uid,planId:old,status:"active",tier:"silver",washesUsed:0,washesTotal:3,pickupsUsed:0});}
 const api=getPaymentProvider(),original=api.createPaymentLink.bind(api);let arrived=0;let release!:()=>void;const both=new Promise<void>(r=>{release=r;});
 const spy=vi.spyOn(api,"createPaymentLink").mockImplementation(async params=>{if(++arrived===2)release();await Promise.race([both,new Promise<void>(r=>setTimeout(r,3000))]);return original(params);});
 const fn=upgrade?upgradeMembership:purchaseMembership;
 const results=await Promise.allSettled([0,1].map(n=>fn.run({data:{planId:id,method:"razorpay_payment_link",idempotencyKey:`race-${sameKey?"same":n}`},auth:auth(uid)} as never)));
 const ms=await db.collection("memberships").where("customerId","==",uid).where("status","==","pending").get(),ps=await db.collection("payments").where("customerId","==",uid).get();
 console.warn("MEMBERSHIP_RACE",{upgrade,sameKey,providerLinks:spy.mock.calls.length,memberships:ms.size,payments:ps.size,results:results.map(r=>r.status)});
 expect(ms.size).toBe(1);expect(ps.size).toBe(1);expect(spy).toHaveBeenCalledTimes(1);spy.mockRestore();
},90000);

it("different second membership capture is reviewed, never activates again or auto-refunds",async()=>{
 const {processProviderEvent}=await import("../../lib/razorpay-webhook.js");const id=`extra-${Date.now()}`;
 await db.collection("payments").doc(id).set({id,targetType:"membership",membershipId:"m",tenantId:"native-member",studioId:null,customerId:"c",status:"completed",amount:90000,currency:"INR",razorpayPaymentId:"original"});
 const result=await processProviderEvent(db,{eventType:"payment.captured",providerEventId:id,providerPaymentId:"different",providerPaymentLinkId:null,providerOrderId:null,referenceId:id,amount:90000,currency:"INR",providerRefundId:null});
 expect(result.outcome).toBe("overpayment_review");expect((await db.collection("payments").doc(id).get()).data()!.razorpayPaymentId).toBe("original");expect((await db.collection("staffAlerts").doc("extra_capture_different").get()).exists).toBe(true);
});
