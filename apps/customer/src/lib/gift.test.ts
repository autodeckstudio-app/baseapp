import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GIFT_LIVE, GIFT_STATE_LABEL, setPendingGiftCode, takePendingGiftCode } from "./gift";
import { giftShareMessage } from "@autodeck/core";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("gift client", () => {
  it("is dark until the server is deployed", () => expect(GIFT_LIVE).toBe(false));
  it("never sends a gift code while dark, and never computes a price", () => {
    const c = read("app/(tabs)/book/confirm.tsx");
    expect(c).toContain("GIFT_LIVE ? takePendingGiftCode()");
    expect(read("lib/gift-service.ts")).not.toMatch(/amount\s*:\s*\d/);
  });
  it("the home entry only exists when live", () => expect(read("lib/drawer-items.ts")).toContain("...(GIFT_LIVE ? ["));
  it("holds a claimed code in memory only", () => {
    setPendingGiftCode("GWABCD2345");
    expect(takePendingGiftCode()).toBe("GWABCD2345");
    expect(read("app/(tabs)/gifts.tsx")).not.toMatch(/router\.push\([^)]*code/);
  });
  it("the buy panel states the 60 days, the expiry and non-refundable before the pay button, and the price is from the server offer", () => {
    const g = read("ui/GiftBuy.tsx");
    const pay = g.indexOf("Pay ${rupees(amountPaise)}");
    expect(pay).toBeGreaterThan(-1);
    expect(g.indexOf("GIFT_TERMS.validity")).toBeGreaterThan(-1);
    expect(g.indexOf("GIFT_TERMS.nonRefundable")).toBeGreaterThan(-1);
    expect(g.indexOf("GIFT_TERMS.validity")).toBeLessThan(pay);
    expect(g.indexOf("GIFT_TERMS.nonRefundable")).toBeLessThan(pay);
    const screen = read("app/(tabs)/gifts.tsx");
    expect(screen).toContain("amountPaise={offer.amountPaise}");
    expect(screen).not.toMatch(/cancelMyGift|Tap an unused gift to cancel/);
  });
  it("the card and redeem screen show the validity line", () => {
    expect(read("ui/GiftCard.tsx")).toContain("giftValidityLine(expiresAt, now)");
    expect(read("ui/GiftCard.tsx")).toContain("GIFT_TERMS.nonRefundable");
    expect(read("app/(tabs)/gifts.tsx")).toContain("giftValidityLine(claimed.expiresAt, now)");
  });
  it("the share message carries the 60-day validity", () => {
    expect(giftShareMessage({ buyerFirstName: null, code: "GWABCD2345", expiresAt: "2026-12-19T10:00:00Z", studioName: "AutoDeck" })).toMatch(/60 days from purchase/);
  });
  it("a gift reminder opens the gifts screen", () => expect(read("app/(tabs)/notifications/index.tsx")).toContain('n.entityType === "Gift"'));
  it("every state has a plain label", () => expect(Object.keys(GIFT_STATE_LABEL).sort()).toEqual(["expired", "pending", "redeemed", "refunded", "unused", "void"]));
  it("the share text has the studio name and first name only", () => {
    const m = giftShareMessage({ buyerFirstName: "Asha", code: "GWABCD2345", expiresAt: "2027-10-16T10:00:00Z", studioName: "AutoDeck" });
    expect(m).toMatch(/Asha/); expect(m).toMatch(/AutoDeck/);
  });
});
