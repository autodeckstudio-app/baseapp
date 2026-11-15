import { describe, it, expect } from "vitest";
import { walkinCancelBlock } from "../../lib/walkin-cancel.js";

const walkin = { isWalkIn: true, bookingId: null, status: "VEHICLE_RECEIVED", paymentStatus: "unpaid" };

describe("walkinCancelBlock", () => {
  it("allows a fresh unpaid walk-in", () => expect(walkinCancelBlock(walkin)).toBeNull());
  it("refuses a booking-sourced job", () => expect(walkinCancelBlock({ ...walkin, isWalkIn: false, bookingId: "b1" })).toMatch(/Only a walk-in/));
  it("refuses once work has started or finished", () => {
    for (const status of ["IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"]) expect(walkinCancelBlock({ ...walkin, status })).toMatch(/Work has already started/);
  });
  it("refuses when any payment is recorded", () => {
    for (const paymentStatus of ["partial", "paid", "refunded"]) expect(walkinCancelBlock({ ...walkin, paymentStatus })).toMatch(/payment/);
  });
  it("treats an already cancelled walk-in as fine", () => expect(walkinCancelBlock({ ...walkin, status: "CANCELLED" })).toBeNull());
});
