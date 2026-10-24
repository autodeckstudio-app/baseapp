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
