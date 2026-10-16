import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const src = readFileSync(`${__dirname}/../../scripts/seed-studio.ts`, "utf8");
const WASH = 1000;
describe("seeded membership prices follow the Rs 1000 wash", () => {
  const rows = [...src.matchAll(/priceInPaise: (\d+)_00, includedWashes: (\d+), discountPercent: (\d+)/g)].map((m) => ({ price: +m[1]!, washes: +m[2]!, disc: +m[3]! }));
  it("has the three plans", () => expect(rows).toHaveLength(3));
  it("each price is washes x 1000 less the plan discount", () => {
    for (const r of rows) expect(r.price).toBe(Math.round(r.washes * WASH * (100 - r.disc) / 100));
  });
  it("owner pick B: the exact plans", () => {
    expect(rows).toEqual([{ price: 4000, washes: 4, disc: 0 }, { price: 7600, washes: 8, disc: 5 }, { price: 14400, washes: 16, disc: 10 }]);
  });
  it("a plan is never dearer per wash than a single wash, and more washes means a lower per-wash price", () => {
    const per = rows.map((r) => r.price / r.washes);
    for (const p of per) expect(p).toBeLessThanOrEqual(WASH);
    expect([...per].sort((a, b) => b - a)).toEqual(per);
  });
});
