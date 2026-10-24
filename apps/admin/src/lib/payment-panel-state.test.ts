// TEST. Transitions loading -> none / present, and that no payment control is offered before the listener answers.
import { describe, expect, it } from "vitest";
import { canOfferPayment, paymentPanelMode } from "./payment-panel-state";
describe("paymentPanelMode", () => {
  it("loading before the first snapshot, then none or present; a refunded payment is present", () => {
    expect(paymentPanelMode(undefined)).toBe("loading");
    expect(paymentPanelMode(null)).toBe("none");
    expect(paymentPanelMode({ id: "p1" })).toBe("present");
  });
});
describe("canOfferPayment", () => {
  it("nothing while loading, even for an unpaid job", () => expect(canOfferPayment(undefined, "unpaid")).toEqual({ link: false, counter: false }));
  it("unpaid and no payment: link and counter", () => expect(canOfferPayment(null, "unpaid")).toEqual({ link: true, counter: true }));
  it("a pending or refunded payment gets no new link", () => {
    expect(canOfferPayment({ status: "pending" }, "unpaid").link).toBe(false);
    expect(canOfferPayment({ status: "refunded" }, "unpaid").link).toBe(false);
  });
  it("failed or cancelled payment may be retried with a new link", () => {
    expect(canOfferPayment({ status: "failed" }, "unpaid").link).toBe(true);
    expect(canOfferPayment({ status: "cancelled" }, "unpaid").link).toBe(true);
  });
  it("paid jobs offer nothing", () => expect(canOfferPayment(null, "paid")).toEqual({ link: false, counter: false }));
});

describe("coveredVisitSettlementNote", () => {
  it("covered and not yet settled: note explains the studio zero-settlement path and never asks for money", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    const note = coveredVisitSettlementNote(
      { membershipWashUsed: true, totalAmount: 0 },
      null,
    );
    expect(note).toContain("nothing to collect");
    expect(note).toContain("studio app");
    expect(note).toContain("Record cash payment");
    expect(note).toContain("Rs 0");
    expect(note).not.toMatch(/payment link|charge the customer|collect (cash|payment) from/i);
  });
  it("booking-level coverage alone (job has no membershipWashUsed) still yields the note", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote(null, { membershipWashUsed: true, totalAmount: 0 }),
    ).not.toBeNull();
    expect(
      coveredVisitSettlementNote({ totalAmount: 50000 }, { membershipWashUsed: true, totalAmount: 0 }),
    ).not.toBeNull();
  });
  it("already settled (settlementKind membership_covered): no note, nothing left to do", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote(
        { settlementKind: "membership_covered", membershipWashUsed: true, totalAmount: 0 },
        null,
      ),
    ).toBeNull();
  });
  it("ordinary unpaid job: no note and payment actions remain offerable (no dead end)", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    const job = { membershipWashUsed: false, totalAmount: 50000 };
    expect(coveredVisitSettlementNote(job, null)).toBeNull();
    expect(canOfferPayment(null, "unpaid")).toEqual({ link: true, counter: true });
  });
  it("covered but with a non-zero amount: no note (not a zero-settlement case)", async () => {
    const { coveredVisitSettlementNote } = await import("./payment-panel-state");
    expect(
      coveredVisitSettlementNote({ membershipWashUsed: true, totalAmount: 100 }, null),
    ).toBeNull();
  });
});
