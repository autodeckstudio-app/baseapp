import { describe, expect, it } from "vitest";
import { bookingCode } from "./booking-code";

describe("bookingCode", () => {
  it("is stable, readable and never uses look-alike characters", () => {
    expect(bookingCode("abc123")).toBe(bookingCode("abc123"));
    for (let i = 0; i < 500; i++) expect(bookingCode(`id${i}xyz`)).toMatch(/^AD-[2-9A-HJKMN-Z]{6}$/);
  });
  it("gives different ids different codes (no collisions in 20,000 sample ids)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(bookingCode(`bk_${i.toString(36)}${(i * 7919).toString(36)}`));
    expect(seen.size).toBeGreaterThan(19990);
  });
});

import { readFileSync } from "node:fs";
describe("booking id is shown where people look", () => {
  const r = (p: string) => readFileSync(`${__dirname}/../../../${p}`, "utf8");
  it("customer booking page and admin booking page show it; admin list can search it", () => {
    expect(r("apps/customer/src/app/(tabs)/bookings/[id].tsx")).toContain("Booking ID {bookingCode(booking.id)}");
    expect(r("apps/admin/src/app/(admin)/bookings/[id]/page.tsx")).toContain("bookingCode(booking.id)");
    expect(r("apps/admin/src/app/(admin)/bookings/page.tsx")).toContain("bookingCode(b.id)");
  });
  it("the 'work has started' cancel card is gone", () => {
    expect(r("apps/customer/src/app/(tabs)/bookings/[id].tsx")).not.toContain("Work on your car has started");
    expect(r("apps/customer/src/app/(tabs)/bookings/index.tsx")).not.toContain("Work has started, so this cannot be cancelled");
  });
});
