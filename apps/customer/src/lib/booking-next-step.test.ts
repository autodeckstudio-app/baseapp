import { describe, expect, it } from "vitest";
import { nextStepLine } from "./booking-rules";
describe("nextStepLine", () => {
  it("before arrival it asks the customer to bring the car", () => {
    expect(nextStepLine({ giftCovered: true, jobStatus: "PENDING_VEHICLE", time: "11:00 am" })).toBe("Next: bring your car at 11:00 am. Your gift covers this wash.");
    expect(nextStepLine({ giftCovered: true, jobStatus: null, time: "11:00 am" })).toContain("bring your car at 11:00 am");
    expect(nextStepLine({ giftCovered: false, jobStatus: "PENDING_VEHICLE", time: "11:00 am" })).toBe("Next: bring your car at 11:00 am. You pay at the studio, and the team marks it paid once you do.");
  });
  it.each(["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"])("with the car at the studio (%s) it never asks to bring the car", (s) => {
    expect(nextStepLine({ giftCovered: true, jobStatus: s, time: "11:00 am" })).toBe("Your gift covers this wash.");
    expect(nextStepLine({ giftCovered: false, jobStatus: s, time: "11:00 am" })).toBe("You pay at the studio, and the team marks it paid once you do.");
  });
});
