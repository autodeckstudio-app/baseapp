import type * as NodeFs from "node:fs";
import type * as NodePath from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_SEED } from "@autodeck/core";
import { LIVE_PACKAGE_SAMPLE } from "./live-packages-sample";
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
  it("package rows come only from listed live ids that are active, fixed-price and describe their contents, in their own words", () => {
    const mk = (id: string, name: string, description: string, extra = {}) => ({ id, name, description, category: "washing", active: true, ...extra }) as never;
    const live = [
      mk("svc-wash-detail-spa", "Detail SPA", "Thorough wash and detailing spa treatment.\n- Engine cleaning\n- Under body cleaning"),
      mk("svc-wash-premium", "Premium Wash", "Extended premium koach foam wash with additional interior polishing of dashboard and doors."),
      mk("menu-wash-exterior", "Ceramic wash", "Extended premium koach foam wash - Includes Ceramic wash & spray"),
      mk("svc-wash-regular", "Regular Wash", "Standard wash. Includes foam and dry."),
      mk("x-unlisted", "Unlisted", "Includes everything together with additional things"),
    ];
    const ids = (l: unknown[]) => comboCards(l as never).map((x) => x.service.id);
    expect(ids(live)).toEqual(["svc-wash-detail-spa", "svc-wash-premium", "menu-wash-exterior"]);
    expect(comboCards(live as never)[0]!.parts[0]).toBe("Thorough wash and detailing spa treatment. Engine cleaning, Under body cleaning");
    const tweak = (extra: object) => live.map((s) => ((s as unknown as { id: string }).id === "svc-wash-premium" ? { ...(s as object), ...extra } : s));
    expect(ids(tweak({ active: false }))).not.toContain("svc-wash-premium");
    expect(ids(tweak({ priceOnRequest: true }))).not.toContain("svc-wash-premium");
    expect(ids(tweak({ description: "" }))).not.toContain("svc-wash-premium");
  });
  it("with the live-read catalogue, all four stated packages show: Full detail wash, Detail SPA, Premium Wash, Ceramic wash", () => {
    const live = LIVE_PACKAGE_SAMPLE as never[];
    const out = comboCards(live as never);
    expect(out.map((x) => x.service.id)).toEqual(["menu-wash-full", "svc-wash-detail-spa", "svc-wash-premium", "menu-wash-exterior"]);
    expect(out.find((x) => x.service.id === "menu-wash-full")!.parts).toEqual(["Ceramic wash", "Interior deep clean"]);
    // Regular Wash, Headlight buffing and Interior deep clean are in the catalogue but are not listed packages.
    expect(out.map((x) => x.service.id)).not.toContain("svc-wash-regular");
  });
  it("the Bookings page renders the Combos block through CombosSection", () => {
    const { readFileSync } = require("node:fs") as typeof NodeFs;
    const { join } = require("node:path") as typeof NodePath;
    const page = readFileSync(join(__dirname, "../app/(tabs)/bookings/index.tsx"), "utf8");
    expect(page).toMatch(/seg === "upcoming" && !error && !next \? <CombosSection/);
  });
  it("the empty Bookings blocks only show with no next booking, and never mention discounts or invented prices", () => {
    const { readFileSync } = require("node:fs") as typeof NodeFs;
    const { join } = require("node:path") as typeof NodePath;
    const page = readFileSync(join(__dirname, "../app/(tabs)/bookings/index.tsx"), "utf8");
    for (const h of ["Book again", "Due soon", "Earliest time for"]) expect(page).toMatch(new RegExp(`seg === "upcoming" && !error && !next && [^\\n]*\\n[^\\n]*\\n[^\\n]*${h}`));
    const src = readFileSync(join(__dirname, "booking-ideas.ts"), "utf8") + page.slice(page.indexOf("Ideas for the empty page"), page.indexOf("const doCancel"));
    expect(src).not.toMatch(/discount|% off|\bsave\b|rupees\(/i);
  });
  it("combo cards are compact rows, not full-height photo cards", () => {
    const fs = require("node:fs") as typeof NodeFs; const pth = require("node:path") as typeof NodePath;
    const page = fs.readFileSync(pth.resolve(__dirname, "../ui/CombosSection.tsx"), "utf8");
    const block = page.slice(page.indexOf("combos.map"), page.indexOf("combos.map") + 500);
    expect(block).toContain("VisitCard");
    expect(block).not.toMatch(/PhotoCard|height=\{400\}/);
  });
});
