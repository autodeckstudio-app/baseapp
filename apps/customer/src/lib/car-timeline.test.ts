import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildUpcoming, buildHistory, countLabel, whenText } from "./car-timeline";
import type { CarePlan } from "./care-plan";

const day = 86_400_000;
const plan = (o: Partial<CarePlan> = {}): CarePlan => ({ done: [], due: [], nextCoat: null, warranties: [], ...o });
const iso = (days: number) => new Date(Date.now() + days * day).toISOString().slice(0, 10);

describe("car timeline", () => {
  it("coming up is in date order and mixes care plan, papers and warranties", () => {
    const u = buildUpcoming({
      plan: plan({ due: [{ name: "Ceramic", label: "Maintenance coat", dueAt: new Date(Date.now() + 21 * day), days: 21 }], warranties: [{ label: "PPF warranty", endDate: iso(200), days: 200 }] }),
      papers: [{ id: "p1", label: "Insurance", expiresOn: iso(10), days: 10 }, { id: "p2", label: "PUC Certificate", expiresOn: null, days: null }],
    });
    expect(u.map((x) => x.title)).toEqual(["Insurance expires", "Maintenance coat", "PPF warranty ends"]);
    expect(u[0]).toMatchObject({ soon: true, pill: "10 days" });
    expect(u[2]!.soon).toBe(false);
  });
  it("an expired paper is soon and says Expired", () => {
    const u = buildUpcoming({ plan: plan(), papers: [{ id: "p", label: "RC", expiresOn: iso(-3), days: -3 }] });
    expect(u[0]).toMatchObject({ soon: true, pill: "Expired" });
    expect(u[0]!.when).toContain("OVERDUE");
  });
  it("papers without a date are not invented into the timeline", () => {
    expect(buildUpcoming({ plan: plan(), papers: [{ id: "p", label: "RC", expiresOn: null, days: null }] })).toEqual([]);
  });
  it("history is newest first and keeps the job id and status", () => {
    const h = buildHistory([{ id: "a", title: "Foam wash", also: "", at: "2026-10-01T10:00:00Z", status: "QUALITY_CHECK" }, { id: "b", title: "Detail", also: "Plus wax", at: "2026-10-09T10:00:00Z", status: "CANCELLED" }]);
    expect(h.map((x) => x.jobId)).toEqual(["b", "a"]);
    expect(h[1]!.pill).toBe("QUALITY CHECK");
    expect(h.every((x) => !x.soon)).toBe(true);
  });
  it("labels", () => {
    expect(countLabel(1, "visit", "visits")).toBe("1 visit"); expect(countLabel(6, "visit", "visits")).toBe("6 visits");
    expect(whenText(0, 0)).toBe("TODAY"); expect(whenText(1, 0)).toBe("TOMORROW"); expect(whenText(21, 0)).toBe("IN 21 DAYS");
  });
});

describe("car detail lower sections use one timeline, not stacked blocks", () => {
  const src = readFileSync(`${__dirname}/../app/(tabs)/garage/[id].tsx`, "utf8");
  it("has the timeline, with counts, and no Care plan or Done block stack", () => {
    expect(src).toContain("<CareTimeline");
    expect(src).toContain("countLabel(");
    expect(src).not.toContain("Next maintenance coat");
    expect(src).not.toContain('<Kicker>Care plan</Kicker>');
    expect(src).not.toContain("Warranty certificate");
  });
  it("keeps invoice links, the PDF download and the add-document flow", () => {
    expect(src).toContain("history-invoice-");
    expect(src).toContain("Download service history (PDF)");
    expect(src).toContain("Submit for verification");
  });
  it("the orange dot is only for soon items", () => {
    const c = readFileSync(`${__dirname}/../ui/CareTimeline.tsx`, "utf8");
    expect(c).toContain("it.soon ? \"#EC8638\"");
    expect(c).not.toMatch(/Rs\s?\d/);
  });
});
