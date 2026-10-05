import { describe, expect, it } from "vitest";
import { adminSaveListingSchema, markMyListingSoldSchema } from "../../schemas/carsale.js";

describe("carsale schemas", () => {
  it("mark sold takes only a listing id", () => {
    expect(markMyListingSoldSchema.safeParse({ listingId: "a" }).success).toBe(true);
    expect(markMyListingSoldSchema.safeParse({ listingId: "a", status: "live" }).success).toBe(false);
    expect(markMyListingSoldSchema.safeParse({}).success).toBe(false);
  });
  it("body type is optional and limited to known values", () => {
    const base = { status: "live", make: "Tata", model: "Nexon", year: 2021, kmDriven: 1000, fuel: "petrol", gearbox: "manual", owners: 1, colour: "Red", area: "Ahmedabad", askingPrice: 50000000, photoPaths: ["t/listings/a.jpg"] };
    expect(adminSaveListingSchema.safeParse(base).success).toBe(true);
    expect(adminSaveListingSchema.safeParse({ ...base, bodyType: "suv" }).success).toBe(true);
    expect(adminSaveListingSchema.safeParse({ ...base, bodyType: null }).success).toBe(true);
    expect(adminSaveListingSchema.safeParse({ ...base, bodyType: "tank" }).success).toBe(false);
  });
});
