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

describe("pickTopServices ceramic card regression", () => {
  it("never routes the Ceramic coating card to a cheaper non-ceramic coating (Teflon)", () => {
    const all = [
      svc("t1", "coating", "Teflon coating", "₹4,999"),
      svc("c1", "ceramic", "Ceramic 1-year", "₹14,750"),
    ];
    const coat = pickTopServices(all).find((t) => t.key === "coat");
    expect(coat?.service.id).toBe("c1");
  });
  it("skips the card when only a non-ceramic coating exists", () => {
    const all = [svc("t1", "coating", "Teflon coating", "₹4,999")];
    expect(pickTopServices(all).find((t) => t.key === "coat")).toBeUndefined();
  });
  it("accepts a coating-category service whose name is actually ceramic", () => {
    const all = [svc("m1", "coating", "Ceramic maintenance coat", "₹6,500")];
    expect(pickTopServices(all).find((t) => t.key === "coat")?.service.id).toBe("m1");
  });
  it("a ceramic-category service wins over a cheaper coating-category ceramic fallback", () => {
    const all = [
      svc("m1", "coating", "Ceramic maintenance coat", "₹6,500"),
      svc("c1", "ceramic", "Ceramic 1-year", "₹14,750"),
    ];
    expect(pickTopServices(all).find((t) => t.key === "coat")?.service.id).toBe("c1");
  });
});

it('Quick wash starting price only uses its Exterior wash options, not a cheaper interior or headlight service',()=>{const all=[svc('interior','washing','Interior cleaning','₹200'),svc('light','washing','Headlight restoration','₹100'),svc('regular','washing','Regular Wash','₹500')];expect(pickTopServices(all).find(p=>p.key==='wash')?.service.id).toBe('regular')});
