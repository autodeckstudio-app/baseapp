import { describe, expect, it } from "vitest";
import { pickTopServices } from "../lib/top-services";
type HomeService = Parameters<typeof pickTopServices>[0][number];

const svc = (id: string, category: string, name: string, price: string): HomeService => ({ id, category, name, price, brand: null }) as HomeService;

describe("pickTopServices", () => {
  const all = [
    svc("w2", "washing", "Foam wash", "₹1,327.50"),
    svc("w1", "washing", "Express wash", "₹590"),
    svc("c1", "ceramic", "Ceramic 1-year", "₹14,750"),
    svc("g1", "garage", "Battery check", "₹590"),
    svc("g2", "garage", "Repairs and other work", "Quote on request"),
  ];
  it("gives at most four cards, from real services only", () => {
    const top = pickTopServices(all);
    expect(top.length).toBeLessThanOrEqual(4);
    for (const t of top) expect(all.map((a) => a.id)).toContain(t.service.id);
  });
  it("quick wash is the cheapest wash", () => {
    expect(pickTopServices(all).find((t) => t.key === "wash")?.service.id).toBe("w1");
  });
  it("skips a card when the catalogue has nothing for it", () => {
    expect(pickTopServices([svc("w1", "washing", "Express wash", "₹590")]).map((t) => t.key)).toEqual(["wash"]);
  });
});
