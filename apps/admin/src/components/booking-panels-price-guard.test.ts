import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// TEST (source guard, not a render): a booking with no priceBreakdown (legacy or malformed) shows "Not available" and never reads pb fields.
const src = readFileSync(join(__dirname, "BookingPanels.tsx"), "utf8");
describe("booking price panel guard", () => {
  it("branches on a missing breakdown before any pb.* read", () => {
    const i = src.indexOf("{!pb ? (");
    expect(i).toBeGreaterThan(0);
    const firstRead = src.indexOf("pb.basePrice");
    expect(firstRead).toBeGreaterThan(i);
    expect(src).toContain("Not available");
    expect(src).toContain("Number.isFinite(booking.totalAmount)");
  });
});
