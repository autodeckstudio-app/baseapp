import { it, expect, vi, beforeEach } from "vitest";
import type { Payment } from "@autodeck/core";
import { fakeFirestore } from "./fake-firestore.js";
const h = vi.hoisted(() => ({ fetch: vi.fn(), create: vi.fn() }));
vi.mock("../../lib/razorpay-provider.js", () => ({ getPaymentProvider: () => ({ fetchPaymentLink: h.fetch, createPaymentLink: h.create }) }));
import { membershipPaymentUrl } from "../../lib/membership-payment-url.js";
const p = { id: "p", targetType: "membership", tenantId: "t", membershipId: "m", customerId: "c", status: "pending", method: "razorpay_payment_link", amount: 90000, currency: "INR", razorpayPaymentLinkId: "l", paymentUrl: "https://stale.example" } as Payment;
beforeEach(() => vi.clearAllMocks());
it.each(["created", "issued"])("returns only provider-validated %s URL, not stale stored URL", async status => {
 const {db,data} = fakeFirestore({payments:{p:{...p}},memberships:{m:{id:"m",customerId:"c",tenantId:"t",status:"pending"}}}); h.fetch.mockResolvedValue({providerPaymentLinkId:"l",status,amount:90000,currency:"INR",paymentUrl:"https://valid.example"});
 expect(await membershipPaymentUrl(db as never,p)).toBe("https://valid.example"); expect(h.fetch).toHaveBeenCalledWith("l"); expect(h.create).not.toHaveBeenCalled();
});
it.each(["paid","partially_paid","expired","cancelled","unknown"])("%s clears stale URL and sends review, never creates replacement", async status => {
 const {db,data} = fakeFirestore({payments:{p:{...p}},memberships:{m:{id:"m",customerId:"c",tenantId:"t",status:"pending"}}}); h.fetch.mockResolvedValue({status,amount:90000,currency:"INR",paymentUrl:"https://bad.example"});
 expect(await membershipPaymentUrl(db as never,p)).toBeNull(); expect(data.payments!.p!.paymentUrl).toBeNull(); expect(data.staffAlerts).toBeDefined();
});
it("provider amount mismatch cannot return URL", async () => {
 const {db} = fakeFirestore({payments:{p:{...p}},memberships:{m:{id:"m",customerId:"c",tenantId:"t",status:"pending"}}}); h.fetch.mockResolvedValue({status:"created",amount:1,currency:"INR",paymentUrl:"https://bad.example"}); expect(await membershipPaymentUrl(db as never,p)).toBeNull();
});
it("concurrent replays only read the same bound provider link", async () => {
 const {db} = fakeFirestore({payments:{p:{...p}},memberships:{m:{id:"m",customerId:"c",tenantId:"t",status:"pending"}}}); h.fetch.mockResolvedValue({providerPaymentLinkId:"l",status:"created",amount:90000,currency:"INR",paymentUrl:"https://valid.example"}); expect(await Promise.all([membershipPaymentUrl(db as never,p),membershipPaymentUrl(db as never,p)])).toEqual(["https://valid.example","https://valid.example"]); expect(h.fetch).toHaveBeenCalledTimes(2);
});
