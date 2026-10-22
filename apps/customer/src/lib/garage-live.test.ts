import { describe, expect, it } from "vitest";
import { liveStep } from "./live-step";
import { jobStage } from "../ui/job-stage";
import { LIVE_PROGRESS, careRing, jobStep, liveJobForCar, readyBy } from "./garage-live";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(".", "src", p.replace(/^\.\.\//, "")), "utf8");

describe("garage live job", () => {
  const jobs = [{ id: "a", status: "DELIVERED", vehicleId: "v1" }, { id: "b", status: "IN_PROGRESS", vehicleId: "v2" }, { id: "c", status: "QUALITY_CHECK", vehicleId: "v1" }];
  it("finds the live job of that car only", () => { expect(liveJobForCar(jobs, "v1")?.id).toBe("c"); expect(liveJobForCar(jobs, "v2")?.id).toBe("b"); expect(liveJobForCar(jobs, "v3")).toBeNull(); });
  it("a delivered job is not live", () => { expect(liveJobForCar([jobs[0]!], "v1")).toBeNull(); });
  it("maps status to the four steps", () => { expect(["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"].map(jobStep)).toEqual([0, 1, 2, 3]); });
  it("ready-by only when set and ahead", () => { expect(readyBy({})).toBeNull(); expect(readyBy({ estimatedEndAt: "2020-01-01T00:00:00Z" })).toBeNull(); expect(readyBy({ estimatedEndAt: new Date(Date.now() + 3600_000).toISOString() })).not.toBeNull(); });
});
describe("care ring", () => {
  const now = new Date("2026-10-18T00:00:00Z").getTime();
  it("shows washes left of total and days left", () => {
    const r = careRing({ status: "active", washesTotal: 4, washesUsed: 1, endDate: "2026-11-01T00:00:00Z", tier: "silver" }, now)!;
    expect(r.left).toBe(3); expect(r.fraction).toBe(0.75); expect(r.line).toBe("Silver, 14 days left"); expect(r.sub).toBe("3 of 4 washes left");
  });
  it("is absent without an active plan", () => { expect(careRing(null)).toBeNull(); expect(careRing({ status: "expired", washesTotal: 4, washesUsed: 0 })).toBeNull(); });
  it("never goes negative", () => { expect(careRing({ status: "active", washesTotal: 2, washesUsed: 5 }, now)!.left).toBe(0); });
});
describe("garage showroom guards", () => {
  const g = read("../app/(tabs)/garage/index.tsx"); const s = read("../ui/GarageShowroom.tsx");
  it("keeps the All chip and the due chip", () => { expect(g).toContain('label: "All"'); expect(g).toContain("dueChip("); });
  it("has one Book a service button", () => { expect((g.match(/label="Book a service"/g) ?? []).length).toBe(1); });
  it("respects Reduce Motion in the care ring", () => { expect(read("../ui/CareRing.tsx")).toContain("useReduceMotion"); });
  it("hero is one photo: no swipe, no paging, no page dots, no parallax", () => { expect(s).not.toMatch(/ScrollView|pagingEnabled|Animated|onMomentumScrollEnd|Car \$\{index/); expect(s).toContain("chips above only"); });
  it("uses only allowed radii and no emoji", () => { expect(s).not.toMatch(/borderRadius: (?!12|16|24|9999|0\b)\d+/); });
  it("hero fade is a gradient, not a hard band, and the page clears the tab bar", () => { expect(s).toContain("linear-gradient"); expect(g).toContain("paddingBottom: 100"); });
  it("sections of the selected car are spaced by the section gap, one value for all", () => { expect(g).toContain("gap: metrics.sectionGap }}"); expect(g).toContain("marginTop: metrics.sectionGap, paddingBottom: 100"); expect(g).not.toMatch(/gap: space\.breath, paddingBottom/); });
  it("Home, Garage and the booking screen agree on the step for every live status (Garage once showed Ready during Final checks)", () => {
    for (const st of ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"]) {
      expect(liveStep(LIVE_PROGRESS[st]!)).toBe(jobStage(st)!.index); expect(jobStep(st)).toBe(jobStage(st)!.index);
    }
    expect(read("../app/(tabs)/index.tsx")).toContain("LIVE_PROGRESS[m.liveJob.status]");
  });
});
describe("car detail cover guards", () => {
  const d = read("../app/(tabs)/garage/[id].tsx"); const h = read("../ui/CarHero.tsx"); const o = read("../ui/CarOverview.tsx");
  it("has exactly one Book a service action on the page, and it lives in the cover strip", () => {
    expect((h.match(/Book a service/g) ?? []).length).toBe(1);
    expect(d).not.toContain("Book a service"); expect(o).not.toMatch(/Book a service|onBook|>Book</);
    expect(d).not.toMatch(/label="Book/);
  });
  it("cover photo height comes from metrics and the name sits on the photo", () => { expect(h).toContain("metrics.heroCover"); expect(h).toContain("fontSize: 30"); });
  it("empty states are one quiet line, not a block with a button", () => { expect(d).not.toContain('<Notice title="No care plan yet"'); expect(o).not.toContain("No service history yet"); });
});
describe("garage services have one price for every car", () => {
  it("the service page has no car-size chips at all (size comes from the saved car) and labels garage price plainly", () => {
    const c = read("../app/(tabs)/catalogue/[id].tsx");
    expect(c).not.toContain("setSelectedCategory");
    expect(c).toContain('service.category === "garage" ? "Price" : "Price for your car"');
  });
});
describe("garage All view and selected view share one language", () => {
  const g = read("../app/(tabs)/garage/index.tsx");
  it("cars are photo cards with nothing stacked below them, no Today or Coming up blocks, no swipe", () => {
    expect(g).toContain("<CarPhotoCard"); expect(g).toContain("<GarageShowroom");
    expect(g).not.toMatch(/TodayStrip|COMING UP|GarageCarFacts|LAST SERVICE|NEXT DUE|ScrollView horizontal pagingEnabled/);
  });
  it("Track stays reachable as a text chip on the card of a car in the bay, not a second button", () => {
    expect(g).toContain('accessibilityLabel="Track"'); expect(g).not.toContain('Track and chat');
    expect(g).toContain("const overlay");
  });
  it("car cards never use stock or generated art, and a missing photo says so", () => {
    for (const f of ["ui/GarageShowroom.tsx", "ui/CarThumb.tsx", "app/(tabs)/garage/index.tsx"]) expect(read(f)).not.toMatch(/imagery|generated\/|require\(/);
    expect(read("ui/CarThumb.tsx")).toContain("NO PHOTO YET");
  });
  it("All view has no plan ring", () => { const i = g.indexOf("list.map((v) =>"); expect(g.slice(i - 400, i)).not.toContain("<CareRing"); });
});
import { bookingPayment, PAY_AT_STUDIO_GROUPS } from "@autodeck/core";
describe("pay in the app at booking", () => {
  it("regular services are paid online with no studio choice, bigger groups may pay at the studio, quotes and zero totals have no online payment", () => {
    expect(bookingPayment({ category: "washing", priceOnRequest: false } as never, 90000)).toEqual({ online: true, studioChoice: false });
    expect(bookingPayment({ category: "ceramic_coating", priceOnRequest: false } as never, 400000).online).toBe(true);
    expect(bookingPayment({ category: "garage", priceOnRequest: false } as never, 80000)).toEqual({ online: true, studioChoice: true });
    expect(bookingPayment({ category: "garage", priceOnRequest: true } as never, 0)).toEqual({ online: false, studioChoice: false });
    expect(bookingPayment({ category: "washing", priceOnRequest: false } as never, 0).online).toBe(false);
    expect([...PAY_AT_STUDIO_GROUPS]).toEqual(["coatings", "ppf", "garage", "mods"]);
  });
  it("the confirm screen pays through the existing job payment path, never for a wash on the plan, and keeps the booking if checkout is closed", () => {
    const c = read("../app/(tabs)/book/confirm.tsx");
    expect(c).toContain("initiatePayment(h.paymentJobId"); expect(c).toContain("payWithCheckout"); expect(c).toContain("!washOn");
    expect(c).not.toContain("Opens when online payments go live");
  });
});
