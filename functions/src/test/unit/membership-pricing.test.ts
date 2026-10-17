import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const src = readFileSync(`${__dirname}/../../scripts/seed-studio.ts`, "utf8");
const WASH = 1000;
describe("seeded membership prices follow the Rs 1000 wash", () => {
  const rows = [...src.matchAll(/priceInPaise: (\d+)_00, includedWashes: (\d+), discountPercent: (\d+)/g)].map((m) => ({ price: +m[1]!, washes: +m[2]!, disc: +m[3]! }));
  it("has the three plans", () => expect(rows).toHaveLength(3));
  it("each plan is priced at or below washes x 1000, so it never costs more per wash than walk-in", () => {
    for (const r of rows) expect(r.price).toBeLessThanOrEqual(Math.round(r.washes * WASH * (100 - r.disc) / 100));
  });
  it("owner Club structure 17 Oct: the exact plans", () => {
    expect(rows).toEqual([{ price: 3600, washes: 4, disc: 0 }, { price: 5700, washes: 6, disc: 0 }, { price: 9000, washes: 10, disc: 0 }]);
  });
  it("a plan is never dearer per wash than a single wash", () => {
    for (const r of rows) expect(r.price / r.washes).toBeLessThanOrEqual(WASH);
  });
});
