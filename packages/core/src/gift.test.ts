import { describe, expect, it } from "vitest";
import { giftState, giftExpiry, normaliseGiftCode, formatGiftCode, giftLockedUntil, giftRefundable, giftShareMessage, GIFT_MAX_FAILED_ATTEMPTS } from "./gift";
const now = Date.parse("2026-10-16T00:00:00Z");
describe("gift state", () => {
  it("derives states, expiring by date", () => {
    expect(giftState({ status: "ACTIVE", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe("unused");
    expect(giftState({ status: "ACTIVE", expiresAt: "2026-10-15T00:00:00Z" }, now)).toBe("expired");
    expect(giftState({ status: "REDEEMED", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe("redeemed");
    expect(giftState({ status: "VOID", expiresAt: null }, now)).toBe("void");
    expect(giftState({ status: "PENDING_PAYMENT", expiresAt: null }, now)).toBe("pending");
  });
  it("only an unused gift is refundable", () => {
    expect(giftRefundable({ status: "ACTIVE", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe(true);
    expect(giftRefundable({ status: "REDEEMED", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe(false);
    expect(giftRefundable({ status: "REFUNDED", expiresAt: "2027-10-16T00:00:00Z" }, now)).toBe(false);
  });
});
describe("expiry", () => {
  it("is 12 months on the same day, and a leap day ends on the 28th", () => {
    expect(giftExpiry("2026-10-16T10:00:00Z")).toBe("2027-10-16T10:00:00.000Z");
    expect(giftExpiry("2028-02-29T10:00:00Z")).toBe("2029-02-28T10:00:00.000Z");
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
