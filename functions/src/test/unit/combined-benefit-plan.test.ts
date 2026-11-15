import { it, expect } from "vitest";
import { planCombinedBenefits as plan } from "../../lib/combined-benefit-plan.js";
const pb = {
  vehicleCategory: "sedan" as const,
  basePrice: 100000,
  scopeAdjustment: 0,
  addOns: [],
  subtotal: 100000,
  membershipDiscount: null,
  membershipDiscountPercent: null,
  pickupFee: 0,
  dropFee: 0,
  taxRatePercent: 18,
  taxDescription: "GST",
  tax: 18000,
  total: 118000,
  currency: "INR",
};
const m = {
  id: "m",
  tenantId: "t",
  customerId: "c",
  status: "active" as const,
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  pickupsTotal: 3,
  pickupsUsed: 0,
  washesTotal: 2,
  washesUsed: 0,
  discountPercent: 10,
};
const base = {
  service: pb,
  pickupFeePaise: 2500,
  dropFeePaise: 5000,
  memberships: [m],
  washEligible: true,
  giftCovered: false,
  tenantId: "t",
  customerId: "c",
  scheduledDate: "2026-11-10",
};
it("whole-request free transport is automatic and preserves service price, no wash consumed without selection", () => {
  const r = plan(base);
  expect(r.breakdown).toMatchObject({
    total: 118000,
    pickupFee: 0,
    dropFee: 0,
  });
  expect(r.pickupDelta).toBe(1);
  expect(r.washDelta).toBe(0);
});
it("one included wash plus free transport creates zero payable, not a fake paid capture", () => {
  const r = plan({ ...base, membershipId: "m" });
  expect(r.breakdown.total).toBe(0);
  expect(r).toMatchObject({
    noPaymentRequired: true,
    washDelta: 1,
    pickupDelta: 1,
    washMembershipId: "m",
    pickupMembershipId: "m",
  });
});
it("wash-only benefit leaves exact directed transport taxable/payable", () => {
  const r = plan({
    ...base,
    membershipId: "m",
    memberships: [{ ...m, pickupsUsed: 3 }],
  });
  expect(r.breakdown).toMatchObject({
    subtotal: 107500,
    membershipDiscount: 100000,
    tax: 1350,
    total: 8850,
    pickupFee: 2500,
    dropFee: 5000,
  });
  expect(r.noPaymentRequired).toBe(false);
});
it("gift covers service only; transport is not accidentally gifted", () => {
  const r = plan({ ...base, giftCovered: true, memberships: [] });
  expect(r.breakdown).toMatchObject({
    total: 8850,
    tax: 1350,
    membershipDiscount: null,
    subtotal: 7500,
  });
  expect(r.washDelta).toBe(0);
  expect(() => plan({ ...base, giftCovered: true, membershipId: "m" })).toThrow(
    /cannot be combined/,
  );
});
it("discount applies to service before exact transport, not to transport fees", () => {
  const r = plan({
    ...base,
    membershipId: "m",
    washEligible: false,
    memberships: [{ ...m, pickupsUsed: 3 }],
  });
  expect(r.breakdown).toMatchObject({
    membershipDiscount: 10000,
    subtotal: 107500,
    tax: 17550,
    total: 115050,
  });
  expect(r.discountMembershipId).toBe("m");
  expect(r.washDelta).toBe(0);
});
it("scheduled visit must fall within active start/end and correct owner/tenant", () => {
  for (const changes of [
    { startDate: "2026-11-11" },
    { endDate: "2026-11-09" },
    { customerId: "foreign" },
    { tenantId: "foreign" },
    { status: "cancelled" as const },
  ]) {
    const input = { ...base, memberships: [{ ...m, ...changes }] };
    expect(plan(input).pickupDelta).toBe(0);
    expect(() => plan({ ...input, membershipId: "m" })).toThrow();
  }
});
it("free road quote never consumes a credit; earliest expiry stable id breaks ties", () => {
  expect(
    plan({ ...base, pickupFeePaise: 0, dropFeePaise: 0 }).pickupDelta,
  ).toBe(0);
  expect(
    plan({
      ...base,
      memberships: [
        { ...m, id: "z" },
        { ...m, id: "a" },
      ],
    }).pickupMembershipId,
  ).toBe("a");
});
it("malformed counters, duplicates, date and pre-applied pricing fail closed", () => {
  expect(() => plan({ ...base, memberships: [m, m] })).toThrow();
  expect(() => plan({ ...base, scheduledDate: "invalid" })).toThrow();
  expect(() =>
    plan({
      ...base,
      membershipId: "m",
      memberships: [{ ...m, washesUsed: -1 }],
    }),
  ).toThrow();
  expect(() => plan({ ...base, service: { ...pb, pickupFee: 10 } })).toThrow();
});
it("does not mutate price or membership records and recognizes drop-only benefit", () => {
  const before = JSON.stringify(base);
  const r = plan({ ...base, pickupFeePaise: 0 });
  expect(r.pickupDelta).toBe(1);
  expect(r.breakdown.dropFee).toBe(0);
  expect(JSON.stringify(base)).toBe(before);
});

it("applies included wash to main service only then charges extras at original price/tax", () => {
  const r = plan({
    ...base,
    membershipId: "m",
    extras: [
      { serviceId: "extra", name: "Extra", price: 50000, durationMinutes: 30 },
    ],
  });
  expect(r.breakdown).toMatchObject({
    total: 59000,
    tax: 9000,
    membershipDiscount: 100000,
    subtotal: 150000,
  });
  expect(r.breakdown.addOns[0]?.price).toBe(50000);
  expect(() =>
    plan({
      ...base,
      giftCovered: true,
      extras: [
        {
          serviceId: "extra",
          name: "Extra",
          price: 50000,
          durationMinutes: 30,
        },
      ],
    }),
  ).toThrow(/cannot be combined/);
});
it("retains no-end-date transport entitlement, but does not invent no-end-date wash authority", () => {
  const input = { ...base, memberships: [{ ...m, endDate: null }] };
  expect(plan(input).pickupDelta).toBe(1);
  expect(() => plan({ ...input, membershipId: "m" })).toThrow();
});

it("invalid persisted dates/counters and unsafe arithmetic fail closed", () => {
  expect(
    plan({ ...base, memberships: [{ ...m, startDate: "2026-99-12" }] })
      .pickupDelta,
  ).toBe(0);
  expect(() => plan({ ...base, service: { ...pb, total: 5 } })).toThrow(
    /price needs review/,
  );
  expect(() =>
    plan({ ...base, pickupFeePaise: Number.MAX_SAFE_INTEGER, memberships: [] }),
  ).toThrow();
  expect(
    plan({ ...base, memberships: [{ ...m, pickupsUsed: -1 }] }).pickupDelta,
  ).toBe(0);
  expect(() => plan({ ...base, scheduledDate: "2026-99-01" })).toThrow(
    /date or fees/,
  );
});
