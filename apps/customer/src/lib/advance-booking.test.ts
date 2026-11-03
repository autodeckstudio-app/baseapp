import { describe, expect, it } from "vitest";
import { ADVANCE_SPLIT_ENABLED, advanceDisclosureLines } from "./advance-booking";

describe("advance split disclosure (owner-approved activation)", () => {
  it("release candidate remains OFF pending compatible Android activation decision", () => {
    expect(ADVANCE_SPLIT_ENABLED).toBe(false);
  });
  it("copy states the adopted 20% split without computing an amount (basis/rounding held)", () => {
    const { split } = advanceDisclosureLines();
    expect(split).toContain("20%");
    expect(split).not.toMatch(/₹|rs\.?|paise/i);
  });
  it("no-show line matches the owner-approved rule (2 Nov 21:32:50) and avoids cancellation wording", () => {
    const { noShow } = advanceDisclosureLines();
    expect(noShow).toContain("20% advance");
    expect(noShow).toContain("Nothing more is charged");
    expect(noShow.toLowerCase()).not.toContain("cancel");
  });
  it("full-online no-show line: keeps 20% of service, remainder (incl unused pickup/drop) to owner refund approval, never auto", () => {
    const { noShowFullOnline } = advanceDisclosureLines();
    expect(noShowFullOnline).toContain("20% of the discounted service price including GST");
    expect(noShowFullOnline).toContain("unused pickup and drop charges and their GST");
    expect(noShowFullOnline).toContain("refund approval");
    expect(noShowFullOnline).toContain("nothing is refunded automatically");
    expect(noShowFullOnline.toLowerCase()).not.toContain("cancel");
  });
});

import { advancePreviewFromParts } from "./advance-booking";

const pb = (o: Partial<Parameters<typeof advancePreviewFromParts>[0]> = {}) => ({ subtotal: 100000, pickupFee: 0, dropFee: 0, membershipDiscount: null, taxRatePercent: 18, ...o });

describe("advancePreviewFromParts (display-only mirror of the server derivation)", () => {
  it("20% of the service incl GST, balance is the exact remainder of the grand total", () => {
    expect(advancePreviewFromParts(pb())).toEqual({ advancePaise: 23600, dueAtStudioPaise: 94400 });
  });
  it("GST off (rate 0): 20% of the plain service price", () => {
    expect(advancePreviewFromParts(pb({ taxRatePercent: 0 }))).toEqual({ advancePaise: 20000, dueAtStudioPaise: 80000 });
  });
  it("rounds the advance UP and keeps advance + balance equal to the total", () => {
    const r = advancePreviewFromParts(pb({ subtotal: 100001, taxRatePercent: 0 }))!;
    expect(r.advancePaise).toBe(20001);
    expect(r.advancePaise + r.dueAtStudioPaise).toBe(100001);
  });
  it("membership discount reduces the base before tax", () => {
    // 100000 - 20000 = 80000; +18% = 94400; 20% = 18880
    expect(advancePreviewFromParts(pb({ membershipDiscount: 20000 }))).toEqual({ advancePaise: 18880, dueAtStudioPaise: 75520 });
  });
  it("pickup and drop are excluded from the advance but stay in the balance (with their GST)", () => {
    // service 100000 + pickup 10000 folded into subtotal; grand total 110000*1.18 = 129800
    const r = advancePreviewFromParts(pb({ subtotal: 110000, pickupFee: 10000 }))!;
    expect(r.advancePaise).toBe(23600);
    expect(r.dueAtStudioPaise).toBe(129800 - 23600);
  });
  it("extra services are folded in PRE-TAX and taxed once with the main service (as addExtrasToBreakdown does)", () => {
    // (100000 + 50000) * 1.18 = 177000; service = same; 20% = 35400
    expect(advancePreviewFromParts(pb(), [50000])).toEqual({ advancePaise: 35400, dueAtStudioPaise: 177000 - 35400 });
    // rounding: two extras of 1 paisa each taxed once, not per row
    expect(advancePreviewFromParts(pb({ subtotal: 3, taxRatePercent: 18 }), [3, 3])).toEqual(advancePreviewFromParts(pb({ subtotal: 9, taxRatePercent: 18 })));
  });
  it("returns null (never throws, never a wrong amount) for broken or non-finite input", () => {
    expect(advancePreviewFromParts(pb({ membershipDiscount: 200000 }))).toBeNull();
    expect(advancePreviewFromParts(pb({ subtotal: NaN }))).toBeNull();
    expect(advancePreviewFromParts(pb({ taxRatePercent: Infinity }))).toBeNull();
    expect(advancePreviewFromParts(pb(), [-1])).toBeNull();
    expect(advancePreviewFromParts(pb(), [1.5])).toBeNull();
    expect(advancePreviewFromParts(pb({ pickupFee: 200000 }))).toBeNull();
    expect(advancePreviewFromParts({} as never)).toBeNull();
  });
});

import { readFileSync } from "node:fs";
describe("confirm advance lines stay behind the flag and qualify the balance when pickup is chosen", () => {
  const src = readFileSync("src/app/(tabs)/book/confirm.tsx", "utf8");
  it("both money lines render only under ADVANCE_SPLIT_ENABLED", () => {
    expect(src).toContain("advanceDue && advancePreview ?");
    expect(src).toContain("const advancePreview = ADVANCE_SPLIT_ENABLED && breakdown ?");
  });
  it("balance is labelled before pickup/drop fees when a pickup is chosen", () => {
    expect(src).toContain('pickupKind ? "Pay at the studio (before pickup/drop fees)" : "Pay at the studio"');
  });
});

import { needsBookingAdvance } from "./advance-booking";
describe("effective advance route", () => {
  const base = { enabled: true, studioSelected: true, onlineAvailable: true,
    giftCovered: false, membershipCovered: false, priceOnRequest: false, advancePaise: 20000 };
  it("uses studio selection, including the studio-only default", () => {
    expect(needsBookingAdvance(base)).toBe(true);
    expect(needsBookingAdvance({ ...base, studioSelected: false, onlineAvailable: false })).toBe(true);
    expect(needsBookingAdvance({ ...base, studioSelected: false })).toBe(false);
  });
  it("ignores stale studio selection for gifts, covered washes, quotes and zero totals", () => {
    for (const override of [{ giftCovered: true }, { membershipCovered: true }, { priceOnRequest: true },
      { advancePaise: 0 }, { advancePaise: null }, { advancePaise: NaN }, { enabled: false }]) {
      expect(needsBookingAdvance({ ...base, ...override })).toBe(false);
    }
  });
  it("retains the created advance booking before requesting a link and retries through held state", () => {
    const src = readFileSync("src/app/(tabs)/book/confirm.tsx", "utf8");
    expect(src).toContain("if (held) { if (!heldOver) await payHeld(held); return; }");
    expect(src).toContain("setHeld(h);\n        await payHeld(h);");
    expect(src).toContain("if (h.advance)");
    expect(src).toContain("await requestAdvancePayment(h.bookingId)");
    expect(src).toContain("await payWithPaymentLink(adv.paymentId, adv.paymentUrl)");
  });
});
