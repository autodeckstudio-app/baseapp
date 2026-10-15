import { describe, expect, it } from "vitest";
import { carNeed } from "./home-needs";
const svc = { w: { id: "w", name: "Foam wash", category: "washing" } };
const day = 86_400_000;
const now = Date.parse("2026-10-16T10:00:00Z");
const job = (ago: number, status = "DELIVERED") => ({ serviceId: "w", status, createdAt: new Date(now - ago * day).toISOString() });
describe("carNeed", () => {
  it("nothing when recently done", () => expect(carNeed([job(5)], svc, now)).toBeNull());
  it("due within a week shows", () => expect(carNeed([job(26)], svc, now)?.title).toBe("Wash due"));
  it("overdue says how long", () => expect(carNeed([job(40)], svc, now)?.detail).toContain("10 days past due"));
  it("cancelled or in-flight jobs never count", () => expect(carNeed([job(90, "CANCELLED")], svc, now)).toBeNull());
  it("no history, no prompt", () => expect(carNeed([], svc, now)).toBeNull());
});

import { readFileSync } from "node:fs";
describe("Home wiring", () => {
  it("Home shows the need card, quick actions and open status from real sources", () => {
    const h = readFileSync(`${__dirname}/../app/(tabs)/index.tsx`, "utf8");
    expect(h).toContain("carNeed(carJobs");
    expect(h).toContain("openStatus(liveInfo");
    expect(h).toContain("STUDIO_INFO.phone ?");
  });
});
