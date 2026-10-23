import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { HttpsError } from "firebase-functions/v2/https";
import type { Gift } from "@autodeck/core";
import { giftBlockReason } from "../../lib/gift-store.js";

const now = Date.parse("2026-10-16T00:00:00Z");
const g = (o: Partial<Gift> = {}): Gift => ({
  id: "g1", tenantId: "t", buyerId: "b", serviceId: "menu-wash-foam", amountPaise: 1, codeHash: "h", codeTail: "2345", status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00Z", purchasedAt: "2026-10-01T00:00:00Z", expiresAt: "2026-11-30T00:00:00Z", claimedBy: null, redeemedBy: null,
  redeemedAt: null, bookingId: null, voidedAt: null, voidReason: null, refundRequested: false, paymentId: null, ...o,
});
describe("gift block reasons", () => {
  it("an unused, unclaimed gift can be used", () => expect(giftBlockReason(g(), "u1", now)).toBeNull());
  it("the account that claimed it can use it, another cannot", () => {
    expect(giftBlockReason(g({ claimedBy: "u1" }), "u1", now)).toBeNull();
    expect(giftBlockReason(g({ claimedBy: "u1" }), "u2", now)).toMatch(/already been claimed/);
  });
  it("used, expired, void, refunded and unpaid gifts are refused with a plain message", () => {
    expect(giftBlockReason(g({ status: "REDEEMED" }), "u1", now)).toMatch(/already been used/);
    expect(giftBlockReason(g({ expiresAt: "2026-10-15T00:00:00Z" }), "u1", now)).toMatch(/expired/);
    expect(giftBlockReason(g({ status: "VOID" }), "u1", now)).toMatch(/no longer valid/);
    expect(giftBlockReason(g({ status: "REFUNDED" }), "u1", now)).toMatch(/no longer valid/);
    expect(giftBlockReason(g({ status: "PENDING_PAYMENT", expiresAt: null }), "u1", now)).toMatch(/not active/);
  });
});
describe("gift guardrails (source)", () => {
  const src = readFileSync(`${__dirname}/../../functions/gift/gift.ts`, "utf8");
  const purchaseSrc = readFileSync(`${__dirname}/../../lib/gift-purchase.ts`, "utf8");
  const booking = readFileSync(`${__dirname}/../../functions/booking/createBooking.ts`, "utf8");
  it("no client price: no amount in any input schema", () => {
    expect(src).not.toMatch(/z\.object\(\{[^}]*(amount|price)/i);
    expect(src).toContain("giftPricePaise");
  });
  it("gift price takes tax from taxFor, so the GST-off switch applies (owner: no GST anywhere)", () => {
    expect(src).toContain("...taxFor(config)");
    expect(src).not.toMatch(/taxRatePercent:\s*config\.taxRatePercent/);
  });
  it("redemption needs a phone sign-in, rate limits and a lockout", () => {
    expect(src).toContain("user.phone");
    expect(src).toContain('"gift.redeem"');
    expect(src).toContain("assertNotLocked");
    expect(src).toContain("recordFailure");
  });
  it("the gift record holds only the hash of the code (the plain code is in the server-only giftSecrets, see gift-purchase.test.ts)", () => {
    expect(src).toContain("codeHash");
    // The plain code is written only to server-only giftSecrets (creation lives in lib/gift-purchase.ts).
    expect(purchaseSrc).toMatch(/giftId: ref\.id, buyerId: user\.uid, tenantId: user\.claims\.tenantId, code, createdAt/);
  });
  it("booking marks the gift used in the same transaction, with no stacking", () => {
    expect(booking).toContain('status: "REDEEMED"');
    expect(booking).toContain("cannot be combined with a membership");
  });
  it("the HttpsError type is usable", () => expect(new HttpsError("not-found", "x").code).toBe("not-found"));
});
describe("invoice guards (source)", () => {
  it("a gift visit is not marked paid at creation, so it goes through the normal invoice path", () => {
    const b = readFileSync(`${__dirname}/../../functions/booking/createBooking.ts`, "utf8");
    expect(b).not.toContain('giftToUse ? "paid"');
  });
  it("delivery requires a live invoice", () => {
    const a = readFileSync(`${__dirname}/../../functions/job/advanceJobStatus.ts`, "utf8");
    expect(a).toContain("has no invoice");
    expect(a).toContain('!== "void"');
  });
});
