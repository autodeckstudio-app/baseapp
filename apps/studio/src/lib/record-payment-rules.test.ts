import { describe, it, expect } from "vitest";
import { recordAmountLine, canCollectPayment, canRecordPayment, receiptMatches, recordInput, UPI_PAYEE_LINE, WRONG_AMOUNT_NOTE, type ReceiptBinding } from "./record-payment-rules";

describe("record payment rules", () => {
  it("states the exact full amount", () => { expect(recordAmountLine(90000)).toBe("Records the full amount: Rs 900."); expect(recordAmountLine(1416000)).toBe("Records the full amount: Rs 14,160."); });
  it("needs the receipt check first", () => {
    expect(canRecordPayment({ method: "cash", verified: false, reference: "" })).toMatch(/cash/);
    expect(canRecordPayment({ method: "upi_manual", verified: false, reference: "123456789" })).toMatch(/arrived/);
    expect(canRecordPayment({ method: "cash", verified: true, reference: "" })).toBeNull();
  });
  it("UPI needs a reference", () => {
    expect(canRecordPayment({ method: "upi_manual", verified: true, reference: " 12 " })).toMatch(/reference/);
    expect(canRecordPayment({ method: "upi_manual", verified: true, reference: "UPI1234567" })).toBeNull();
  });
  it("never sends an amount", () => {
    expect(Object.keys(recordInput("j1", { method: "cash", reference: "ignored" }))).toEqual(["jobId", "method"]);
    expect(recordInput("j1", { method: "upi_manual", reference: " UPI1234567 " })).toEqual({ jobId: "j1", method: "upi_manual", manualReference: "UPI1234567" });
  });
  it("mismatch is handed to the office, not settled", () => expect(WRONG_AMOUNT_NOTE).toMatch(/Ask the office/));
  it("shows the owner-verified merchant payee with the QR", () => {
    expect(UPI_PAYEE_LINE).toContain("9898679711@okbizaxis");
    expect(UPI_PAYEE_LINE).toContain("AutoDeck");
  });
});

describe("membership desk collection guard", () => {
  it("blocks until the money is seen, like the job sheet", () => {
    expect(canCollectPayment({ method: "cash", verified: false, reference: "" })).toMatch(/cash in hand/);
    expect(canCollectPayment({ method: "upi_manual", verified: false, reference: "UPI123456" })).toMatch(/arrived in the AutoDeck account/);
    expect(canCollectPayment({ method: "bank_transfer", verified: false, reference: "UTR123456" })).toMatch(/arrived in the AutoDeck account/);
  });
  it("account arrivals need a matchable reference; cash does not", () => {
    expect(canCollectPayment({ method: "upi_manual", verified: true, reference: " 12 " })).toMatch(/reference/);
    expect(canCollectPayment({ method: "bank_transfer", verified: true, reference: "" })).toMatch(/reference/);
    expect(canCollectPayment({ method: "cash", verified: true, reference: "" })).toBeNull();
    expect(canCollectPayment({ method: "upi_manual", verified: true, reference: "UPI123456" })).toBeNull();
  });
  it("the walk-in sale collects through the shared guarded fields", () => {
    const s2 = require("fs").readFileSync(require("path").join(__dirname, "../app/(tabs)/memberships.tsx"), "utf8");
    expect(s2).toContain("MembershipPaymentFields amountPaise=");
    expect(s2).toContain("canCollectPayment({ method: saleMethod, verified: bound, reference: saleRef })");
  });
});

describe("receipt binding (a receipt belongs to one customer + plan + amount)", () => {
  const base: ReceiptBinding = { customerKey: "+919898679711", planId: "plan-10", amountPaise: 99900 };
  it("matches only the exact customer, plan and amount the receipt was taken for", () => {
    expect(receiptMatches(base, { ...base })).toBe(true);
    expect(receiptMatches(base, { ...base, customerKey: "+919999999999" })).toBe(false);
    expect(receiptMatches(base, { ...base, planId: "plan-20" })).toBe(false);
    expect(receiptMatches(base, { ...base, amountPaise: 199900 })).toBe(false);
    expect(receiptMatches(null, base)).toBe(false);
  });
  it("the sale binds the toggle to the current customer/plan/amount and clears on context change", () => {
    const s2 = require("fs").readFileSync(require("path").join(__dirname, "../app/(tabs)/memberships.tsx"), "utf8");
    expect(s2).toContain("receiptMatches(saleReceipt, saleBinding())");
    expect(s2).toContain("onVerified={(v) => setSaleReceipt(v ? saleBinding() : null)}");
    expect(s2).toContain("setPlanId(p.id); setSaleReceipt(null); setSaleRef(");
    expect(s2).toContain("setPhone(t); setSearched(false); setFound(null); setSaleReceipt(null); setSaleRef(");
    expect(s2).toContain('"Re-confirm the payment for this customer and plan."');
  });
  it("pending approvals label the reference accurately and clear it on method change", () => {
    const s2 = require("fs").readFileSync(require("path").join(__dirname, "../app/(tabs)/memberships.tsx"), "utf8");
    expect(s2).toContain('"Payment reference (required)"');
    expect(s2).toContain("setRefById((prev) => ({ ...prev, [r.membership.id]: \"\" }))");
  });
});
