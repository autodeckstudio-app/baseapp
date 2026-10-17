import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const src = readFileSync(`${__dirname}/../../scripts/seed-studio.ts`, "utf8");
const WASH = 1000;
describe("seeded membership prices follow the Rs 1000 wash", () => {
  const rows = [...src.matchAll(/priceInPaise: (\d+)_00, includedWashes: (\d+), discountPercent: (\d+), freePickups: (\d+), prioritySlot: (true|false)/g)].map((m) => ({ price: +m[1]!, washes: +m[2]!, disc: +m[3]!, pickups: +m[4]!, priority: m[5] === "true" }));
  it("has the four plans", () => expect(rows).toHaveLength(4));
  it("each plan is priced at or below washes x 1000, so it never costs more per wash than walk-in", () => {
    for (const r of rows) expect(r.price).toBeLessThanOrEqual(Math.round(r.washes * WASH * (100 - r.disc) / 100));
  });
  it("owner Club structure 17 Oct: the exact plans", () => {
    expect(rows).toEqual([
      { price: 1800, washes: 2, disc: 0, pickups: 0, priority: false }, { price: 3600, washes: 4, disc: 0, pickups: 1, priority: false },
      { price: 5400, washes: 6, disc: 0, pickups: 3, priority: false }, { price: 9000, washes: 10, disc: 0, pickups: 5, priority: true },
    ]);
  });
  it("every plan is Rs 900 per wash, so a bigger plan never looks dearer per wash", () => {
    for (const r of rows) expect(r.price / r.washes).toBe(900);
  });
  it("a plan is never dearer per wash than a single wash", () => {
    for (const r of rows) expect(r.price / r.washes).toBeLessThanOrEqual(WASH);
  });
});
