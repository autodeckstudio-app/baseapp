import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { HttpsError } from "firebase-functions/v2/https";
import { fakeFirestore } from "./fake-firestore.js";
const h = vi.hoisted(() => ({ db: null as any, complete: vi.fn(), signature: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => h.db }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: async () => undefined, subjectFrom: () => "local-only" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: () => undefined }));
vi.mock("../../lib/razorpay-checkout.js", () => ({ signatureMatches: (...a: any[]) => h.signature(...a) }));
vi.mock("../../lib/razorpay-verified-checkout.js", () => ({ completeVerifiedCheckout: (...a: any[]) => h.complete(...a) }));
import { createGift, getGiftCode, listMyGifts, redeemGift, giftPricePaise } from "../../functions/gift/gift.js";
import { verifyCheckoutPayment } from "../../functions/payment/verifyCheckoutPayment.js";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";
import { validate } from "../../middleware/validate.js";
import { createGiftPurchase } from "../../lib/gift-purchase.js";
import { hashGiftCode } from "../../lib/gift-code.js";
import { assertNotLocked, attemptKeys, findGiftByHash, giftBlockReason, recordFailure } from "../../lib/gift-store.js";
import { z } from "zod";
import { giftState, GIFT_SERVICE_ID } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { verifyCheckoutPaymentSchema } from "../../schemas/payment.js";
const roles = ["customer", "studio", "admin", "superadmin"];
const auth = (role = "customer", uid = "u", tenantId = "t") => ({ uid, token: { role, tenantId, email: "local@example.invalid", studioId: null } });
const code = "GW-ABCD-2345";
const gift = (extra = {}) => ({ id: "g", tenantId: "t", buyerId: "canonical", status: "ACTIVE", amountPaise: 90000, codeHash: hashGiftCode(code), codeTail: "2345", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), claimedBy: null, refundRequested: false, ...extra });
function setup(profiles: any = { canonical: { authUid: "u", tenantId: "t" } }, extra: any = {}) {
 const f = fakeFirestore({ customers: profiles, gifts: { g: gift() }, giftSecrets: { g: { code } }, services: { [GIFT_SERVICE_ID]: { id: GIFT_SERVICE_ID, tenantId: "t", active: true, basePrice: 90000, category: "washing" } }, ...extra });
 const wrap = (q: any): any => ({ ...q, where: (...args: any[]) => wrap(q.where(...args)), limit: (...args: any[]) => wrap(q.limit(...args)), orderBy: () => wrap(q) });
 const orig = f.db.collection; f.db.collection = (n: string) => { const c = orig(n); return { ...c, where: (...args: any[]) => wrap(c.where(...args)) }; };
 h.db = f.db; return f;
}
const api = { createGift, getGiftCode, listMyGifts, redeemGift, verifyCheckoutPayment } as Record<string, any>;
function artifact(name: string) {
 const s = readFileSync(`${process.env.GIFT_PREPARED_ARTIFACT_ROOT}/${name}/prepared/callable.js`, "utf8");
 const context: any = { extractUser, assertRole, requireCustomerDocId, COLLECTIONS, validate, createGiftPurchase, giftPricePaise, hashGiftCode, assertNotLocked, attemptKeys, findGiftByHash, giftBlockReason, recordFailure, giftState, Date, console,
  enforceRateLimit: async () => undefined, subjectFrom: () => "local-only", shouldEnforceAppCheck: () => false, process: { env: { RAZORPAY_KEY_SECRET: "local-only" } },
  empty: z.object({}).strict(), idSchema: z.object({ giftId: z.string().min(1).max(100) }).strict(), codeSchema: z.object({ code: z.string().min(1).max(40) }).strict(), verifyCheckoutPaymentSchema,
  writeAuditLog: () => undefined, view: (g: any, now: number) => ({ id: g.id, state: giftState(g, now), tail: g.codeTail, amountPaise: g.amountPaise, expiresAt: g.expiresAt, refundRequested: g.refundRequested, refundable: false }),
  signatureMatches: (...a: any[]) => h.signature(...a), completeVerifiedCheckout: (...a: any[]) => h.complete(...a) };
 context.view2 = context.view;
 for (const k of new Set(s.match(/import_https\d*/g))) context[k] = { onCall: (_: any, f: any) => ({ run: f }), HttpsError };
 for (const k of new Set(s.match(/import_firestore\d*/g))) context[k] = { getFirestore: () => h.db };
 return vm.runInNewContext(s + `\n${name}`, context);
}
beforeEach(() => { h.complete.mockReset(); h.signature.mockReset(); h.signature.mockReturnValue(true); h.complete.mockResolvedValue("local-completed"); process.env.RAZORPAY_KEY_SECRET = "local-only"; });
for (const mode of (process.env.GIFT_PREPARED_ARTIFACT_ROOT ? ["source", "prepared-artifact"] : ["source"])) describe(`${mode} ownership-bound Gifts`, () => {
 const call = (n: string, data: any, a: any = auth()) => (mode === "source" ? api[n] : artifact(n)).run({ data, auth: a, rawRequest: { ip: "local-only" } });
 it.each(roles)("%s reads only own canonical gifts without exposing secret/hash", async role => {
  setup(undefined, { gifts: { g: gift(), other: gift({ id: "other", buyerId: "different" }) } });
  const r = await call("listMyGifts", {}, auth(role)); expect(r.gifts).toHaveLength(1); expect(r.gifts[0].id).toBe("g"); expect(JSON.stringify(r)).not.toMatch(/codeHash|ABCD/);
 });
 it.each(roles)("%s can create own canonical unpaid gift, code still restricted until verified payment", async role => {
  const { data } = setup(undefined, { gifts: {} }); const r = await call("createGift", {}, auth(role));
  expect(data.gifts![r.giftId]!.buyerId).toBe("canonical"); expect(data.gifts![r.giftId]!.status).toBe("PENDING_PAYMENT"); expect(data.payments![r.paymentId]!.customerId).toBe("canonical");
  await expect(call("getGiftCode", { giftId: r.giftId }, auth(role))).rejects.toMatchObject({ code: "failed-precondition" });
 });
 it.each(roles)("%s can read own paid code and claim to own canonical profile", async role => {
  const { data } = setup(); expect(await call("getGiftCode", { giftId: "g" }, auth(role))).toMatchObject({ code });
  await call("redeemGift", { code }, auth(role)); expect(data.gifts!.g!.claimedBy).toBe("canonical");
 });
 it.each(["accountant", "staff", "unknown"])("%s is rejected before own gift access", async role => {
  setup(); for (const n of ["listMyGifts", "createGift", "getGiftCode", "redeemGift"]) await expect(call(n, n === "getGiftCode" ? { giftId: "g" } : n === "redeemGift" ? { code } : {}, auth(role))).rejects.toMatchObject({ code: "permission-denied" });
 });
 it.each([{}, { deleted: { authUid: "u", tenantId: "t", deletedAt: "gone" } }, { cross: { authUid: "u", tenantId: "else" } }])("missing/deleted/cross-tenant profile cannot use staff privilege", async profiles => {
  setup(profiles); await expect(call("listMyGifts", {}, auth("admin"))).rejects.toMatchObject({ code: "failed-precondition" });
 });
 it.each([{ u: { authUid: "other", tenantId: "t" } }, { a: { authUid: "u", tenantId: "t" }, b: { authUid: "u", tenantId: "t" } }])("corrupt/ambiguous profile fails closed", async profiles => {
  setup(profiles); await expect(call("listMyGifts", {}, auth("admin"))).rejects.toThrow();
 });
 it.each(roles)("%s cannot fetch other buyer's secret or cross-tenant code", async role => {
  setup(undefined, { gifts: { g: gift({ buyerId: "different" }) } }); await expect(call("getGiftCode", { giftId: "g" }, auth(role))).rejects.toMatchObject({ code: "not-found" });
  setup(undefined, { gifts: { g: gift({ tenantId: "else" }) } }); await expect(call("getGiftCode", { giftId: "g" }, auth(role))).rejects.toMatchObject({ code: "not-found" });
  await expect(call("redeemGift", { code }, auth(role))).rejects.toMatchObject({ code: "not-found" });
 });
 it("another claimant is refused and wrong code records lockout attempts", async () => {
  setup(undefined, { gifts: { g: gift({ claimedBy: "another" }) } }); await expect(call("redeemGift", { code }, auth("admin"))).rejects.toMatchObject({ code: "failed-precondition" });
  const { data } = setup(); await expect(call("redeemGift", { code: "wrong-code" }, auth("admin"))).rejects.toMatchObject({ code: "not-found" }); expect(Object.keys(data.giftAttempts!)).toContain("uid-u");
 });
 it.each(roles)("%s verifies own canonical gift payment, using stub processor only", async role => {
  setup(undefined, { payments: { p: { customerId: "canonical", tenantId: "t", status: "processing", targetType: "gift", razorpayOrderId: "order" } } });
  await expect(call("verifyCheckoutPayment", { paymentId: "p", razorpay_order_id: "order", razorpay_payment_id: "pay", razorpay_signature: "sig" }, auth(role))).resolves.toMatchObject({ verified: true }); expect(h.complete).toHaveBeenCalledTimes(1);
 });
 it.each([{ customerId: "another" }, { tenantId: "else" }, { razorpayOrderId: "different" }])("mismatched payment identity/order never reaches completion", async patch => {
  setup(undefined, { payments: { p: { customerId: "canonical", tenantId: "t", status: "processing", targetType: "gift", razorpayOrderId: "order", ...patch } } });
  await expect(call("verifyCheckoutPayment", { paymentId: "p", razorpay_order_id: "order", razorpay_payment_id: "pay", razorpay_signature: "sig" }, auth("admin"))).rejects.toThrow(); expect(h.complete).not.toHaveBeenCalled();
 });
 it("bad provider signature does not complete and nongift ownership semantics remain unchanged", async () => {
  setup(undefined, { payments: { p: { customerId: "canonical", tenantId: "t", status: "processing", targetType: "gift", razorpayOrderId: "order" } } }); h.signature.mockReturnValue(false);
  await expect(call("verifyCheckoutPayment", { paymentId: "p", razorpay_order_id: "order", razorpay_payment_id: "pay", razorpay_signature: "sig" })).rejects.toMatchObject({ code: "invalid-argument" }); expect(h.complete).not.toHaveBeenCalled();
  setup(undefined, { payments: { p: { customerId: "canonical", tenantId: "t", status: "processing", targetType: "job", razorpayOrderId: "order" } } });
  await expect(call("verifyCheckoutPayment", { paymentId: "p", razorpay_order_id: "order", razorpay_payment_id: "pay", razorpay_signature: "sig" })).rejects.toMatchObject({ code: "permission-denied" });
 });
});
