// Regression coverage for the 10 Oct 2026 production incident: the Firebase
// JS callable serializer encodes omitted/undefined object keys as null on the
// wire (encode(undefined) -> null), so any client that "leaves out" an
// optional field can deliver null for it. Optional fields that carry no
// null-vs-absent semantics must be .nullish() so a delivered null parses the
// same as an absent key. confirmMembershipPayment rejected every admin
// approval with HTTP 400 INVALID_ARGUMENT ("manualReference: Expected string,
// received null") until this was fixed.
import { describe, it, expect } from "vitest";

import {
  confirmMembershipPaymentSchema,
  createWalkinMembershipSchema,
  getMyMembershipsSchema,
  updateMembershipPlanSchema,
} from "../../schemas/membership.js";
import { recordManualPaymentSchema } from "../../schemas/payment.js";

describe("callable serializer null encoding tolerance", () => {
  it("confirmMembershipPayment accepts manualReference delivered as null", () => {
    const parsed = confirmMembershipPaymentSchema.parse({
      membershipId: "abc123",
      method: "cash",
      manualReference: null,
    });
    expect(parsed.manualReference ?? undefined).toBeUndefined();
  });

  it("confirmMembershipPayment still accepts a real reference", () => {
    const parsed = confirmMembershipPaymentSchema.parse({
      membershipId: "abc123",
      method: "upi_manual",
      manualReference: "UPI-REF-42",
    });
    expect(parsed.manualReference).toBe("UPI-REF-42");
  });

  it("confirmMembershipPayment still rejects the wrong shape", () => {
    expect(() =>
      confirmMembershipPaymentSchema.parse({ membershipId: "abc123", method: "cash", manualReference: 42 }),
    ).toThrow();
    expect(() => confirmMembershipPaymentSchema.parse({ method: "cash" })).toThrow();
  });

  it("createWalkinMembership accepts manualReference delivered as null", () => {
    const parsed = createWalkinMembershipSchema.parse({
      customerId: "cust1",
      planId: "plan1",
      method: "cash",
      manualReference: null,
    });
    expect(parsed.manualReference ?? undefined).toBeUndefined();
  });

  it("getMyMemberships accepts customerId delivered as null", () => {
    const parsed = getMyMembershipsSchema.parse({ customerId: null });
    expect(parsed.customerId ?? undefined).toBeUndefined();
  });

  it("updateMembershipPlan accepts untouched fields delivered as null", () => {
    const parsed = updateMembershipPlanSchema.parse({
      planId: "plan1",
      name: null,
      priceInPaise: null,
      includedWashes: null,
      discountPercent: null,
    });
    expect(parsed.planId).toBe("plan1");
    expect(parsed.name ?? undefined).toBeUndefined();
  });

  it("recordManualPayment accepts manualReference delivered as null", () => {
    const parsed = recordManualPaymentSchema.parse({
      jobId: "job1",
      method: "cash",
      manualReference: null,
    });
    expect(parsed.manualReference ?? undefined).toBeUndefined();
  });
});
