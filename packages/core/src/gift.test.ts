import { describe, expect, it } from "vitest";
import { giftState, giftExpiry, normaliseGiftCode, formatGiftCode, giftLockedUntil, giftRefundable, giftShareMessage, giftDaysLeft, giftValidityLine, giftReminderText, GIFT_TERMS, GIFT_VALID_DAYS, GIFT_MAX_FAILED_ATTEMPTS } from "./gift";
const now = Date.parse("2026-10-16T00:00:00Z");
describe("gift state", () => {
  it("derives states, expiring by date", () => {
    expect(giftState({ status: "ACTIVE", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe("unused");
    expect(giftState({ status: "ACTIVE", expiresAt: "2026-10-15T00:00:00Z" }, now)).toBe("expired");
    expect(giftState({ status: "REDEEMED", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe("redeemed");
    expect(giftState({ status: "VOID", expiresAt: null }, now)).toBe("void");
    expect(giftState({ status: "PENDING_PAYMENT", expiresAt: null }, now)).toBe("pending");
  });
  it("no gift is ever refundable (Meet: non-refundable)", () => {
    expect(giftRefundable({ status: "ACTIVE", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe(false);
    expect(giftRefundable({ status: "REDEEMED", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe(false);
    expect(giftRefundable({ status: "REFUNDED", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe(false);
  });
});
describe("expiry", () => {
  it("is exactly 60 days after payment", () => {
    expect(GIFT_VALID_DAYS).toBe(60);
    expect(giftExpiry("2026-10-16T10:00:00Z")).toBe("2026-12-15T10:00:00.000Z");
    expect(giftExpiry("2028-01-10T10:00:00Z")).toBe("2028-03-10T10:00:00.000Z");
  });
  it("counts days left, never below zero", () => {
    expect(giftDaysLeft("2026-10-18T00:00:00Z", now)).toBe(2);
    expect(giftDaysLeft("2026-10-16T00:00:01Z", now)).toBe(1);
    expect(giftDaysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
    expect(giftDaysLeft(null, now)).toBe(0);
  });
  it("the terms say 60 days, expires, and non-refundable", () => {
    expect(GIFT_TERMS.validity).toMatch(/60 days/);
    expect(GIFT_TERMS.validity).toMatch(/expires/);
    expect(GIFT_TERMS.nonRefundable).toMatch(/cannot be refunded/);
    expect(giftValidityLine("2026-12-15T00:00:00Z", now)).toMatch(/Use it by 15 Dec 2026 \(60 days left\)\. It expires after that\./);
    expect(giftReminderText(7).body).toMatch(/7 days/);
    expect(giftReminderText(0).title).toMatch(/today/);
  });
});
describe("codes", () => {
  it("normalise typed codes and reject bad ones", () => {
    expect(normaliseGiftCode("gw-abcd-2345")).toBe("GWABCD2345");
    expect(normaliseGiftCode(" GWABCD2345 ")).toBe("GWABCD2345");
    expect(normaliseGiftCode("GWABCD234")).toBeNull();
    expect(normaliseGiftCode("GWABCD23O5")).toBeNull();
    expect(normaliseGiftCode("ADABCD2345")).toBeNull();
    expect(formatGiftCode("GWABCD2345")).toBe("GW-ABCD-2345");
  });
});
describe("lockout", () => {
  const t = (m: number) => new Date(now - m * 60_000).toISOString();
  it("locks after 5 failures in 15 minutes", () => {
    expect(giftLockedUntil([t(1), t(2), t(3), t(4)], now)).toBeNull();
    const until = giftLockedUntil([t(1), t(2), t(3), t(4), t(5)], now);
    expect(until).not.toBeNull();
    expect(until ?? 0).toBeGreaterThan(now);
    expect(GIFT_MAX_FAILED_ATTEMPTS).toBe(5);
  });
  it("old failures do not count", () => expect(giftLockedUntil([t(20), t(21), t(22), t(23), t(24)], now)).toBeNull());
});
describe("share message", () => {
  it("carries first name, studio, code and expiry only", () => {
    const m = giftShareMessage({ buyerFirstName: "Asha", code: "GWABCD2345", expiresAt: "2027-10-16T10:00:00Z", studioName: "AutoDeck" });
    expect(m).toContain("Asha has gifted you");
    expect(m).toContain("GW-ABCD-2345");
    expect(m).not.toMatch(/\+?\d{10}/);
  });
});
