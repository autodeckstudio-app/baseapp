import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SHOP_FIXTURE } from "@autodeck/core/shop-fixture";
import { placeGuestShopOrder, type OrderStore } from "../../lib/shop-guest-order.js";

const guest = { name: "Test Buyer", mobile: "9876543210", address: "12 Test Street", city: "Pune", state: "MH", pincode: "411001", clientKey: "test-key-0123456789" };
const mem = () => { const m = new Map<string, Record<string, unknown>>(); const s: OrderStore = { async createOnce(k, r) { const p = m.get(k); if (p) return { created: false, record: p }; m.set(k, r); return { created: true, record: r }; } }; return { m, s }; };
const line = [{ productId: "fixture-tee", variantId: "m", quantity: 2 }];

describe("guest shop order handler", () => {
  it("prices on the server, ignores client amounts, and a retry returns the same order (durable key)", async () => {
    const { m, s } = mem();
    const cat = { ...SHOP_FIXTURE, productionLive: false };
    const bad = [{ ...line[0], unitPaise: 1 } as never];
    const a = await placeGuestShopOrder({ catalogue: cat, store: s, now: () => "t" }, bad, guest);
    const b = await placeGuestShopOrder({ catalogue: cat, store: s, now: () => "t2" }, line, guest);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) { expect(a.totalPaise).toBe(b.totalPaise); expect(b.replay).toBe(true); expect(a.replay).toBe(false); }
    expect(m.size).toBe(1);
  });
  it("refuses fixtures in production and an empty catalogue, storing nothing", async () => {
    const { m, s } = mem();
    const prod = await placeGuestShopOrder({ catalogue: { ...SHOP_FIXTURE, productionLive: true }, store: s, now: () => "t" }, line, guest);
    const empty = await placeGuestShopOrder({ catalogue: { products: [], productionLive: true }, store: s, now: () => "t" }, line, guest);
    expect(prod.ok).toBe(false); expect(empty.ok).toBe(false); expect(m.size).toBe(0);
  });
  it("is not exported from the functions index (not deployed)", () => {
    expect(readFileSync(`${__dirname}/../../index.ts`, "utf8")).not.toContain("shop-guest-order");
  });
});
