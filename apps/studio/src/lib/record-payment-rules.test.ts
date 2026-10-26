import { describe, it, expect } from "vitest";
import { recordAmountLine, canRecordPayment, recordInput, WRONG_AMOUNT_NOTE } from "./record-payment-rules";

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
});
