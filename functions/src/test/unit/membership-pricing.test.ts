import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const src = readFileSync(`${__dirname}/../../scripts/seed-studio.ts`, "utf8");
const WASH = 600;
describe("seeded membership prices follow the Rs 600 wash", () => {
  const rows = [...src.matchAll(/priceInPaise: (\d+)_00, includedWashes: (\d+), discountPercent: (\d+), freePickups: (\d+), prioritySlot: (true|false)/g)].map((m) => ({ price: +m[1]!, washes: +m[2]!, disc: +m[3]!, pickups: +m[4]!, priority: m[5] === "true" }));
  it("has the four plans", () => expect(rows).toHaveLength(4));
  it("each plan is priced at or below washes x 600, so it never costs more per wash than walk-in", () => {
    for (const r of rows) expect(r.price).toBeLessThanOrEqual(Math.round(r.washes * WASH * (100 - r.disc) / 100));
  });
  it("kept monthly ladder 19 Nov: the exact plans", () => {
    expect(rows).toEqual([
      { price: 900, washes: 2, disc: 0, pickups: 0, priority: false }, { price: 1700, washes: 4, disc: 0, pickups: 1, priority: false },
      { price: 2400, washes: 6, disc: 0, pickups: 2, priority: false }, { price: 3000, washes: 8, disc: 0, pickups: 3, priority: true },
    ]);
  });
  it("larger plans cost no more per included wash", () => {
    const rates=rows.map(r=>r.price/r.washes);
    for(let i=1;i<rates.length;i++)expect(rates[i]).toBeLessThanOrEqual(rates[i-1]!);
  });
  it("a plan is never dearer per wash than a single wash", () => {
    for (const r of rows) expect(r.price / r.washes).toBeLessThanOrEqual(WASH);
  });
});
