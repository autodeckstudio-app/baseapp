import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceErrorBody } from "./price-error";
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
    expect(src).toContain("Price unavailable");
  });
  it("names the real failure instead of always blaming the connection, and offers a retry", () => {
    expect(src).toContain("functions/resource-exhausted");
    expect(src).toContain("functions/unauthenticated");
    expect(src).not.toContain("Can't get the price\" body=\"Check your connection");
    expect(src).toContain("setPriceTry");
  });
  it("maps the real Firebase callable codes to messages", () => {
    expect(priceErrorBody("functions/resource-exhausted")).toMatch(/Too many/);
    expect(priceErrorBody("functions/unauthenticated")).toMatch(/sign-in/);
    expect(priceErrorBody("functions/internal")).toMatch(/did not answer/);
    expect(priceErrorBody("anything-else")).toMatch(/did not answer/);
  });
});
