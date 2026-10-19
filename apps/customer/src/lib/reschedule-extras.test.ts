import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extraServiceIdsOf } from "./booking-rules";

describe("reschedule asks for times that fit the whole visit", () => {
  it("returns only the extra services", () => {
    expect(extraServiceIdsOf({ serviceId: "a", lines: [{ serviceId: "a" }, { serviceId: "b" }] })).toEqual(["b"]);
    expect(extraServiceIdsOf({ serviceId: "a" })).toEqual([]);
  });
  it("the reschedule screen passes them to getAvailability", () => {
    const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/reschedule.tsx"), "utf8");
    expect(src).toContain("extraServiceIdsOf(booking)");
  });
});
