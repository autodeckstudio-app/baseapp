import { describe, expect, it } from "vitest";
import type { Vehicle } from "@autodeck/core";
import { matchingVehicles } from "../../domain/vehicleIdentity.js";
import { expressInterestSchema } from "../../schemas/carsale.js";

describe("car enquiry contact validation", () => {
  it("requires phone for interest even with no message", () => {
    expect(expressInterestSchema.safeParse({ listingId: "car", kind: "interest" }).success).toBe(false);
    expect(expressInterestSchema.safeParse({ listingId: "car", kind: "interest", phone: "9876543210" }).success).toBe(true);
  });
  it("normalizes Indian country code and rejects non-phone text", () => {
    expect(expressInterestSchema.parse({ listingId: "car", kind: "interest", phone: "+91 98765 43210" }).phone).toBe("9876543210");
    for (const phone of ["", "abcdefghij", "1234567890", "98765"]) expect(expressInterestSchema.safeParse({ listingId: "car", kind: "interest", phone }).success).toBe(false);
  });
  it("keeps report and message optional", () => {
    expect(expressInterestSchema.safeParse({ listingId: "car", kind: "report" }).success).toBe(true);
  });
});
describe("registration-only car identity", () => {
  const car = { id: "existing", registrationNumber: "GJ 01 AB 1234", make: "Maruti", model: "Swift", year: 2022, color: "White" } as Vehicle;
  it("retrieves formatted or lowercase versions of the same registration", () => expect(matchingVehicles([car], "gj01ab1234")).toEqual([car]));
  it("does not match the same make/model/year/colour under a different registration", () => expect(matchingVehicles([car], "GJ01AB1235")).toEqual([]));
  it("also matches archived cars without creating a new identity", () => expect(matchingVehicles([{ ...car, deletedAt: "2026-10-01" }], "GJ01AB1234")).toHaveLength(1));
});
