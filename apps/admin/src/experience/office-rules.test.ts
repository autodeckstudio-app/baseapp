import { describe, expect, it } from "vitest";
import { planProblem } from "./MembershipsView";
import { daysLeft } from "./VehiclesView";

const ok = { planId: null, tier: "gold" as const, name: "Gold", priceInRupees: "1499", includedWashes: "4", discountPercent: "10" };

describe("planProblem", () => {
  it("accepts a sane plan", () => expect(planProblem(ok)).toBeNull());
  it("rejects zero price", () => expect(planProblem({ ...ok, priceInRupees: "0" })).toMatch(/Price/));
  it("rejects fractional washes", () => expect(planProblem({ ...ok, includedWashes: "2.5" })).toMatch(/whole/));
  it("rejects discount over 100", () => expect(planProblem({ ...ok, discountPercent: "120" })).toMatch(/Discount/));
  it("rejects blank name", () => expect(planProblem({ ...ok, name: "  " })).toMatch(/name/));
});

describe("daysLeft", () => {
  it("counts forward", () => expect(daysLeft("2026-10-12", "2026-09-24")).toBe(18));
  it("is negative when expired", () => expect(daysLeft("2026-09-20", "2026-09-24")).toBe(-4));
  it("is zero on the day", () => expect(daysLeft("2026-09-24", "2026-09-24")).toBe(0));
});

import { hoursProblem } from "./StudioView";
describe("hoursProblem", () => {
  const day = (open: string, close: string, closed = false) => ({ dayOfWeek: 1 as const, open, close, closed });
  it("accepts a normal day", () => expect(hoursProblem([day("09:00", "19:00")])).toBeNull());
  it("flags close before open", () => expect(hoursProblem([day("19:00", "09:00")])).toMatch(/closes before/));
  it("ignores closed days", () => expect(hoursProblem([day("", "", true)])).toBeNull());
});
