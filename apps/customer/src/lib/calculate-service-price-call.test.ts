import { beforeEach, describe, expect, it, vi } from "vitest";

// calculateServicePrice makes exactly ONE callable invocation per preview, passing the extra services and the booking
// studio when given, and only caches single-service prices that were not studio-specific.
const h = vi.hoisted(() => ({ calls: [] as unknown[], set: vi.fn() }));
vi.mock("firebase/functions", () => ({
  httpsCallable: () => async (payload: unknown) => {
    h.calls.push(payload);
    return { data: { breakdown: { total: 1_234_00, currency: "INR" }, snapshot: {}, durationMinutes: 150 } };
  },
}));
vi.mock("./firebase", () => ({ auth: { currentUser: { uid: "u1" } }, functions: {} }));
vi.mock("./price-cache", () => ({ priceCache: { set: h.set, clear: vi.fn(), get: vi.fn() }, onPriceCacheScopeChange: vi.fn() }));
vi.mock("./dev-catalogue-loader", () => ({ devCatalogue: null }));
vi.mock("./imagery", () => ({ primeVisuals: vi.fn() }));
vi.mock("../ui/kit", () => ({ rupees: (n: number) => String(n) }));
import { calculateServicePrice } from "./catalogue-service";

describe("calculateServicePrice callable payload", () => {
  beforeEach(() => { h.calls.length = 0; h.set.mockClear(); });

  it("a mixed cart at the booking studio is ONE call carrying extraServiceIds and studioId, and is not cached", async () => {
    const r = await calculateServicePrice("wash", "suv", ["ppf", "ac"], "studio-1");
    expect(h.calls).toEqual([{ serviceId: "wash", vehicleCategory: "suv", extraServiceIds: ["ppf", "ac"], studioId: "studio-1" }]);
    expect([r.breakdown.total, r.durationMinutes]).toEqual([1_234_00, 150]);
    expect(h.set).not.toHaveBeenCalled();
  });

  it("a single service without a studio keeps the original payload and cache behaviour", async () => {
    await calculateServicePrice("wash", "suv");
    expect(h.calls).toEqual([{ serviceId: "wash", vehicleCategory: "suv" }]);
    expect(h.set).toHaveBeenCalledTimes(1);
  });
});
