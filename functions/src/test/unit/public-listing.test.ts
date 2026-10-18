import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicListingView, PUBLIC_LISTING_FIELDS } from "../../lib/public-listing.js";

const listing = {
  id: "c1", status: "live", make: "Honda", model: "City", variant: "V", year: 2019, kmDriven: 40000, fuel: "petrol", gearbox: "manual", bodyType: "sedan",
  owners: 2, colour: "White", area: "Satellite", askingPrice: 850000, reservePrice: 800000, description: "Call 9999999999, plate GJ01AB1234", insuranceValidTill: "2027-01-01",
  photoPaths: ["a.jpg"], sellerId: "u1", sellerName: "Seller", sellerPhone: "+910000000000", registrationNumber: "GJ01AB1234", adminNotes: "n", rejectionReason: "r", createdAt: "2026-10-01", tenantId: "t",
} as never;

describe("anonymous car listing is an allowlist of safe fields", () => {
  const v = publicListingView(listing);
  it("has no price, owner info, description, plate, seller, notes or photos", () => {
    for (const k of ["askingPrice", "reservePrice", "owners", "description", "insuranceValidTill", "registrationNumber", "sellerId", "sellerName", "sellerPhone", "adminNotes", "photoPaths", "rejectionReason", "tenantId"]) expect(v, k).not.toHaveProperty(k);
    expect(v.photoUrls).toEqual([]);
    expect(JSON.stringify(v)).not.toMatch(/9999999999|GJ01AB1234|850000/);
  });
  it("keys are exactly the allowlist plus the fixed flags", () => {
    expect(Object.keys(v).sort()).toEqual([...PUBLIC_LISTING_FIELDS, "photoUrls", "priceHidden", "mine"].sort());
  });
  it("listPublicCarListings uses it and no longer calls view()", () => {
    const s = readFileSync(`${__dirname}/../../functions/carsale/carsale.ts`, "utf8");
    const fn = s.slice(s.indexOf("export const listPublicCarListings"));
    expect(fn).toContain("publicListingView");
    expect(fn).not.toContain("view(l");
  });
  it("the car page never prints an owners row the anonymous response does not have", () => {
    const app = readFileSync(`${__dirname}/../../../../apps/customer/src/app/(tabs)/cars/[id].tsx`, "utf8");
    expect(app).toContain('typeof car.owners === "number"');
  });
});
