import { describe, expect, it } from "vitest";
import { rescheduleRule, RESCHEDULE_WASH_MAX_COUNT, RESCHEDULE_WASH_CUTOFF_HOURS } from "./reschedule-policy.js";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS } from "./constants.js";

describe("rescheduleRule", () => {
  it("gives wash services one free move up to 4 hours before start", () => {
    expect(rescheduleRule("washing")).toEqual({ maxCount: RESCHEDULE_WASH_MAX_COUNT, cutoffHours: RESCHEDULE_WASH_CUTOFF_HOURS });
    expect(rescheduleRule("washing")).toEqual({ maxCount: 1, cutoffHours: 4 });
  });
  it("keeps every non-wash category on the legacy rule (transitional, not adopted-final)", () => {
    for (const category of ["ceramic", "ppf", "coating", "inspection", "tinting", "garage", "modifications", "pickup", "other"]) {
      expect(rescheduleRule(category)).toEqual({ maxCount: MAX_CUSTOMER_RESCHEDULES, cutoffHours: CANCELLATION_FREE_WINDOW_HOURS });
    }
  });
  it("keeps unknown or missing categories on legacy behavior", () => {
    for (const category of [null, undefined, "", "detailing"]) {
      expect(rescheduleRule(category)).toEqual({ maxCount: MAX_CUSTOMER_RESCHEDULES, cutoffHours: CANCELLATION_FREE_WINDOW_HOURS });
    }
  });
});
