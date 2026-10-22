import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceErrorInfo } from "./price-error";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(__dirname, "../app/(tabs)/catalogue/[id].tsx"), "utf8");
const block = readFileSync(join(__dirname, "../ui/ServicePrice.tsx"), "utf8");
const src = page + "\n" + block + "\n" + readFileSync(join(__dirname, "./price-error.ts"), "utf8");

describe("service detail uses the saved car type only", () => {
  it("has no second size picker and no 'Pick your car size' state", () => {
    expect(src).not.toMatch(/setPickedSize|setSelectedCategory|CAR_SEGMENTS|VEHICLE_CATEGORIES/);
    expect(src).not.toContain("Pick your car size");
    expect(src).not.toContain("Select a size to preview");
  });
  it("derives the size from the saved car and sends editing to Garage", () => {
    expect(src).toContain("pricingVehicle.category");
    expect(src).toContain("/(tabs)/garage/${pricingVehicle.vehicle.id}");
  });
  it("never guesses a size for size-priced services and never blames the connection for a missing type", () => {
    expect(src).toMatch(/needsCarType/);
    expect(src).toMatch(/isSizePriced\(service\.category\) && !pricingVehicle\.category/);
  });
  it("names the real failure instead of always blaming the connection, and offers a retry", () => {
    expect(src).toContain("functions/resource-exhausted");
    expect(src).toContain("functions/unauthenticated");
    expect(src).not.toContain("Can't get the price\" body=\"Check your connection");
    expect(src).toContain("setPriceTry");
    expect(block).toContain("priceErrorInfo(p.error).retry");
  });
  it("maps real Firebase callable codes without masking permission or configuration errors as retryable outages", () => {
    expect(priceErrorInfo("functions/resource-exhausted")).toMatchObject({ retry: true });
    expect(priceErrorInfo("functions/resource-exhausted").body).not.toMatch(/minute/i);
    expect(priceErrorInfo("functions/unauthenticated").body).toMatch(/signed in/);
    expect(priceErrorInfo("functions/unauthenticated").body).not.toMatch(/expired/i);
    for (const c of ["functions/permission-denied", "functions/not-found", "functions/failed-precondition", "functions/invalid-argument", "weird"]) expect(priceErrorInfo(c).retry).toBe(false);
    for (const c of ["functions/unavailable", "functions/deadline-exceeded", "functions/internal"]) expect(priceErrorInfo(c).retry).toBe(true);
    expect(priceErrorInfo("weird").body).toBe("Unable to load the price.");
    expect(priceErrorInfo("functions/internal").body).not.toMatch(/did not answer/);
  });
  it("list screens do not ask the server again for prices they already hold (120 calls/min per user limit)", () => {
    const vs = readFileSync(join(__dirname, "./vehicle-size.ts"), "utf8");
    const cs = readFileSync(join(__dirname, "./catalogue-service.ts"), "utf8");
    expect(vs).toMatch(/!s\.priceOnRequest&&cachedServiceTotal\(s\.id,category\)===undefined/);
    expect(cs).toContain("auth.currentUser?.uid");
    expect(cs).toContain("priceCache.set(");
  });
  it("the booking is priced by the server from the saved car type, never from a held list total", () => {
    const fn = readFileSync(join(__dirname, "../../../../functions/src/functions/booking/createBooking.ts"), "utf8");
    expect(fn).toMatch(/calculatePrice\(\{/);
    const book = readFileSync(join(__dirname, "../app/(tabs)/book/[serviceId].tsx"), "utf8");
    expect(book).toMatch(/setSelectedCategory\(normalizeSegment\(selectedVehicle\?\.category\)\)/);
    expect(book).not.toMatch(/cachedServiceTotal/);
  });
  it("the service page and the booking page read the same saved car type", () => {
    expect(page).toContain("pricingVehicle.category");
    expect(page).not.toContain("setSelectedCategory");
  });
});
