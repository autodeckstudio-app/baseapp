import {it,expect,vi} from "vitest";
import type {Payment} from "@autodeck/core";
import type {PaymentProvider} from "../../lib/payment-provider.js";
import {fakeFirestore} from "./fake-firestore.js";
import {obtainMembershipPaymentLink} from "../../lib/membership-payment-link.js";
const p={id:"p",targetType:"membership",membershipId:"m",tenantId:"t",customerId:"c",amount:90000,currency:"INR",method:"razorpay_payment_link",status:"pending",razorpayOrderId:null,razorpayPaymentLinkId:null} as Payment;
const m={id:"m",tenantId:"t",customerId:"c",status:"pending"};
it("claim crash is not auto-expired into second link: persistent ambiguity needs review",async()=>{
 const {db,data}=fakeFirestore({payments:{p:{...p,linkCreateLeaseId:"crashed",orderAmbiguous:true,updatedAt:"2000-01-01T00:00:00Z"}},memberships:{m}});
 const api={createPaymentLink:vi.fn()} as unknown as PaymentProvider;
 expect(await obtainMembershipPaymentLink(db as never,p,api,"")).toEqual({outcome:"manual_review"});expect(api.createPaymentLink).not.toHaveBeenCalled();expect(data.staffAlerts).toBeDefined();
});
it("provider success followed by repeated bind failure leaves ambiguity and never recreates",async()=>{
 const {db,data}=fakeFirestore({payments:{p:{...p}},memberships:{m}});const original=db.runTransaction;let calls=0;
 db.runTransaction=async(fn:unknown)=>{if(++calls>=3)throw new Error("bind unavailable");return original(fn);};
 const api={createPaymentLink:vi.fn(async()=>({providerPaymentLinkId:"l",providerOrderId:"o",paymentUrl:"https://pay.example"}))} as unknown as PaymentProvider;
 await expect(obtainMembershipPaymentLink(db as never,p,api,"")).rejects.toThrow("bind unavailable");expect(data.payments!.p!.orderAmbiguous).toBe(true);expect(api.createPaymentLink).toHaveBeenCalledTimes(1);
 db.runTransaction=original;
 expect(await obtainMembershipPaymentLink(db as never,data.payments!.p as unknown as Payment,api,"")).toEqual({outcome:"manual_review"});expect(api.createPaymentLink).toHaveBeenCalledTimes(1);
});
