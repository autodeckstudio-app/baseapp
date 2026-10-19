import type * as NodeFs from "node:fs";
import type * as NodePath from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_SEED } from "@autodeck/core";
import { comboCards, dueSoonFor, lastServiceFor, pickDay } from "./booking-ideas";

const svc = (m: (typeof MENU_SEED)[number]) => ({ id: m.id, name: m.name, category: m.category, active: true, priceOnRequest: m.consult === true }) as never;
const cat = MENU_SEED.map(svc);

describe("booking ideas", () => {
  it("last service is the newest completed one on that car only", () => {
    const b = [
      { vehicleId: "a", serviceId: "s1", status: "COMPLETED", scheduledAt: "2026-09-01" },
      { vehicleId: "a", serviceId: "s2", status: "COMPLETED", scheduledAt: "2026-10-01" },
      { vehicleId: "a", serviceId: "s3", status: "CANCELLED", scheduledAt: "2026-10-10" },
      { vehicleId: "b", serviceId: "s4", status: "COMPLETED", scheduledAt: "2026-10-12" },
    ];
    expect(lastServiceFor(b, "a")).toBe("s2");
    expect(lastServiceFor(b, "c")).toBeNull();
    expect(lastServiceFor(b, null)).toBeNull();
  });
  it("due soon needs a delivered visit on this car and a date within 30 days; otherwise hidden", () => {
    const services = Object.fromEntries(cat.map((s: { id: string }) => [s.id, s]));
    const now = new Date("2026-10-18T10:00:00Z").getTime();
    const job = (daysAgo: number, vehicleId = "a", serviceId = "menu-wash-foam") => ({ serviceId, status: "DELIVERED", createdAt: new Date(now - daysAgo * 86_400_000).toISOString(), vehicleId });
    expect(dueSoonFor([job(40)], "a", services as never, now)?.days).toBe(-10);
    expect(dueSoonFor([job(10)], "a", services as never, now)?.days).toBe(20);
    expect(dueSoonFor([job(10, "a", "menu-coat-fireball-1")], "a", services as never, now)).toBeNull();
    expect(dueSoonFor([job(40, "b")], "a", services as never, now)).toBeNull();
    expect(dueSoonFor([], "a", services as never, now)).toBeNull();
  });
  it("day chips pick a real offered date and report null when that day has none", () => {
    const dates = ["2026-10-19", "2026-10-20", "2026-10-24", "2026-10-25"]; // Mon..Sun
    expect(pickDay(dates, "today", "2026-10-19")).toBe("2026-10-19");
    expect(pickDay(dates, "tomorrow", "2026-10-19")).toBe("2026-10-20");
    expect(pickDay(dates, "weekend", "2026-10-19")).toBe("2026-10-24");
    expect(pickDay(["2026-10-20"], "today", "2026-10-19")).toBeNull();
    expect(pickDay(["2026-10-20"], "weekend", "2026-10-19")).toBeNull();
    expect(pickDay(dates, undefined, "2026-10-19")).toBeNull();
  });
  it("combos are only bundles the menu states, with no new price", () => {
    const c = comboCards(cat);
    expect(c.map((x) => x.service.id)).toEqual(["menu-wash-full"]);
    expect(c[0]!.parts).toEqual(["Exterior detail wash", "Interior deep clean"]);
    expect(comboCards(cat.filter((s: { id: string }) => s.id !== "menu-wash-interior"))).toEqual([]);
  });
  it("the empty Bookings blocks only show with no next booking, and never mention discounts or invented prices", () => {
    const { readFileSync } = require("node:fs") as typeof NodeFs;
    const { join } = require("node:path") as typeof NodePath;
    const page = readFileSync(join(__dirname, "../app/(tabs)/bookings/index.tsx"), "utf8");
    for (const h of ["Book again", "Due soon", "Earliest time for", "Combos"]) expect(page).toMatch(new RegExp(`seg === "upcoming" && !error && !next && [^\\n]*\\n[^\\n]*\\n[^\\n]*${h}`));
    const src = readFileSync(join(__dirname, "booking-ideas.ts"), "utf8") + page.slice(page.indexOf("Ideas for the empty page"), page.indexOf("const doCancel"));
    expect(src).not.toMatch(/discount|% off|\bsave\b|rupees\(/i);
  });
});
