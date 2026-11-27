import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_STUDIO_ID, type Service } from "@autodeck/core";

// Mixed-bay carts are priced by ONE combined server calculation (the booking's own extras/tax/currency rules), never by
// pricing each service separately and summing.
const calc = vi.hoisted(() => vi.fn());
vi.mock("./catalogue-service", () => ({ calculateServicePrice: (...a: unknown[]) => calc(...a) }));
import { previewSelectionPrice } from "./selection-price-preview";

const svc = (id: string, requiredBayType: Service["requiredBayType"], minutes: number) => ({ id, requiredBayType, estimatedDurationMinutes: minutes }) as Service;
const wash = svc("wash", "wash", 30), ceramic = svc("ceramic", "protection", 300), garage = svc("ac", "general", 45);

describe("selection price preview", () => {
  beforeEach(() => calc.mockReset());

  it("a mixed-bay cart is priced by one combined call at the booking studio, in cart order", async () => {
    calc.mockResolvedValue({ breakdown: { currency: "INR", total: 1_234_00 }, durationMinutes: 375 });
    await expect(previewSelectionPrice([wash, ceramic, garage], "suv")).resolves.toEqual({ total: 1_234_00, minutes: 375 });
    expect(calc).toHaveBeenCalledTimes(1);
    expect(calc).toHaveBeenCalledWith("wash", "suv", ["ceramic", "ac"], FIRST_STUDIO_ID);
  });

  it("a single service uses the same call with no extras", async () => {
    calc.mockResolvedValue({ breakdown: { currency: "INR", total: 500_00 } });
    await expect(previewSelectionPrice([wash], "suv")).resolves.toEqual({ total: 500_00, minutes: 30 });
    expect(calc).toHaveBeenCalledWith("wash", "suv", [], FIRST_STUDIO_ID);
  });

  it("refuses an unusable price instead of showing it", async () => {
    calc.mockResolvedValue({ breakdown: { currency: "USD", total: 100 } });
    await expect(previewSelectionPrice([wash, ceramic], "suv")).rejects.toThrow(/Price unavailable/);
    await expect(previewSelectionPrice([], "suv")).rejects.toThrow(/No services/);
  });
});
