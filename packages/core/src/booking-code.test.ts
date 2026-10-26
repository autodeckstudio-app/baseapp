import { describe, expect, it } from "vitest";
import { bookingCode, matchBookingCode, parseBookingCode } from "./booking-code";

describe("bookingCode", () => {
  it("is stable, readable and never uses look-alike characters", () => {
    expect(bookingCode("abc123")).toBe(bookingCode("abc123"));
    for (let i = 0; i < 500; i++) expect(bookingCode(`id${i}xyz`)).toMatch(/^AD-[2-9A-HJKMN-Z]{4}-[2-9A-HJKMN-Z]{4}$/);
  });
  it("collisions are rare on realistic ids (200,000 random 20-char ids) but never claimed impossible", () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
    const seen = new Set<string>(); let dup = 0;
    for (let i = 0; i < 200000; i++) { let id = ""; for (let j = 0; j < 20; j++) id += chars[Math.floor(rnd() * 62)]; const c = bookingCode(id); if (seen.has(c)) dup++; seen.add(c); }
    expect(dup).toBeLessThanOrEqual(2);
  });
  it("lookup tolerates spacing and case, rejects non-codes, and surfaces every match", () => {
    const code = bookingCode("bkA");
    expect(parseBookingCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
    expect(parseBookingCode("hello")).toBeNull();
    const r = matchBookingCode([{ id: "bkA" }, { id: "bkB" }], code);
    if (!r) throw new Error("expected a match");
    expect(r.matches.map((b) => b.id)).toEqual(["bkA"]);
    expect(r.ambiguous).toBe(false);
    const duplicate = matchBookingCode([{ id: "bkA" }, { id: "bkA" }], code);
    if (!duplicate) throw new Error("expected duplicate matches");
    expect(duplicate.ambiguous).toBe(true);
  });
});


import { readFileSync } from "node:fs";
describe("booking id is shown where people look", () => {
  const r = (p: string) => readFileSync(`${__dirname}/../../../${p}`, "utf8");
  it("customer and admin booking pages show it; admin list search uses matchBookingCode", () => {
    expect(r("apps/customer/src/app/(tabs)/bookings/[id].tsx")).toContain("Booking ID {bookingCode(booking.id)}");
    expect(r("apps/admin/src/app/(admin)/bookings/[id]/page.tsx")).toContain("bookingCode(booking.id)");
    expect(r("apps/admin/src/app/(admin)/bookings/page.tsx")).toContain("matchBookingCode");
  });
  it("the 'work has started' cancel card is gone", () => {
    expect(r("apps/customer/src/app/(tabs)/bookings/[id].tsx")).not.toContain("Work on your car has started");
    expect(r("apps/customer/src/app/(tabs)/bookings/index.tsx")).not.toContain("Work has started, so this cannot be cancelled");
  });
});

describe("dev preview sample is development only", () => {
  const r = (p: string) => readFileSync(`${__dirname}/../../../${p}`, "utf8");
  it("the sample booking path is gated by __DEV__", () => {
    expect(r("apps/customer/src/app/(tabs)/bookings/[id].tsx")).toContain('__DEV__ && mock === "1"');
    expect(r("apps/customer/src/app/preview-booking.tsx")).toContain("if (!__DEV__) return null");
  });
});
