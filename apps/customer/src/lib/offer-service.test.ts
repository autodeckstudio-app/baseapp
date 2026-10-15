import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { offerToCampaign } from "./offer-service";
vi.mock("firebase/functions", () => ({ httpsCallable: () => async () => ({ data: { offers: [] } }) }));
vi.mock("./firebase", () => ({ functions: {} }));
const base = { id: "o", headline: "Monsoon check", body: null, cta: null, url: "https://x/y.jpg", link: { kind: "catalogue" as const, serviceId: null }, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z", hidden: false };
const now = Date.parse("2026-10-16T00:00:00Z");
describe("offerToCampaign", () => {
  it("shows a live offer and opens the chosen place", () => {
    const go = vi.fn();
    const c = offerToCampaign([base], go, now)!;
    expect(c.headline).toBe("Monsoon check");
    c.onPress();
    expect(go).toHaveBeenCalledWith("/(tabs)/catalogue");
  });
  it("a service link opens that service; none does nothing", () => {
    const go = vi.fn();
    offerToCampaign([{ ...base, link: { kind: "service", serviceId: "menu-wash-foam" } }], go, now)!.onPress();
    expect(go).toHaveBeenCalledWith("/(tabs)/book/menu-wash-foam");
    const g2 = vi.fn();
    offerToCampaign([{ ...base, link: { kind: "none", serviceId: null } }], g2, now)!.onPress();
    expect(g2).not.toHaveBeenCalled();
  });
  it("ended, not started or hidden offers show nothing", () => {
    expect(offerToCampaign([{ ...base, endsAt: "2026-10-10T00:00:00Z" }], vi.fn(), now)).toBeNull();
    expect(offerToCampaign([{ ...base, startsAt: "2026-10-20T00:00:00Z" }], vi.fn(), now)).toBeNull();
    expect(offerToCampaign([{ ...base, hidden: true }], vi.fn(), now)).toBeNull();
    expect(offerToCampaign([], vi.fn(), now)).toBeNull();
  });
  it("Home feeds the banner slot from live offers", () => {
    expect(readFileSync(`${__dirname}/../app/(tabs)/index.tsx`, "utf8")).toContain("campaign={offerToCampaign(");
  });
});
