import { describe, expect, it } from "vitest";
import { buildCarePlan, dueText } from "./care-plan";

const NOW = Date.parse("2026-10-17T00:00:00Z");
const services = {
  coat: { id: "coat", name: "Ceramic coating", category: "ceramic" },
  wash: { id: "wash", name: "Foam wash", category: "washing" },
  quote: { id: "quote", name: "Custom mod", category: "mods" },
};
const job = (serviceId: string, sealedAt: string, status = "DELIVERED") => ({ serviceId, status, sealedAt, createdAt: sealedAt });

describe("care plan", () => {
  it("lists delivered work newest first and ignores cancelled jobs", () => {
    const p = buildCarePlan({ jobs: [job("wash", "2026-09-01T00:00:00Z"), job("coat", "2026-10-01T00:00:00Z"), job("wash", "2026-10-02T00:00:00Z", "CANCELLED")], services, warranties: [], now: NOW });
    expect(p.done.map((d) => d.name)).toEqual(["Ceramic coating", "Foam wash"]);
  });
  it("due dates use the care rules: coating 8 months, wash 30 days; no rule means no row", () => {
    const p = buildCarePlan({ jobs: [job("coat", "2026-10-01T00:00:00Z"), job("wash", "2026-09-01T00:00:00Z"), job("quote", "2026-09-01T00:00:00Z")], services, warranties: [], now: NOW });
    expect(p.due.map((d) => d.label)).toEqual(["Wash", "Maintenance coat"]);
    expect(p.due[0]!.days).toBe(-16);
    expect(p.nextCoat?.name).toBe("Ceramic coating");
    expect(p.nextCoat?.days).toBe(224);
  });
  it("warranty ends sorted soonest first, skipping missing dates", () => {
    const p = buildCarePlan({ jobs: [], services, warranties: [{ label: "A", endDate: "2027-10-17" }, { label: "B", endDate: "2026-11-16" }, { label: "C", endDate: null }], now: NOW });
    expect(p.warranties.map((w) => w.label)).toEqual(["B", "A"]);
    expect(p.warranties[0]!.days).toBe(30);
  });
  it("is empty for a car with no history and words overdue and upcoming plainly", () => {
    const p = buildCarePlan({ jobs: [], services, warranties: [], now: NOW });
    expect(p.done).toEqual([]);
    expect(p.nextCoat).toBeNull();
    expect(dueText(0)).toBe("Due today");
    expect(dueText(1)).toBe("Due tomorrow");
    expect(dueText(12)).toBe("Due in 12 days");
    expect(dueText(-5)).toBe("Overdue by 5 days");
  });
});
