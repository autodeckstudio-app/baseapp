import { describe, it, expect } from "vitest";
import { dueRule, lastFinishedJob, nextDue } from "./care-due";

const svc = {
  wash: { id: "w", name: "Foam wash", category: "washing" },
  int: { id: "i", name: "Interior deep clean", category: "washing" },
  cer: { id: "c", name: "Ceramic 1-year", category: "ceramic" },
  tint: { id: "t", name: "Window tint", category: "modifications" },
};
describe("care due", () => {
  it("coatings are due at 8 months, a wash at 30 days, mods never", () => {
    expect(dueRule(svc.cer)?.days).toBe(240);
    expect(dueRule(svc.wash)?.days).toBe(30);
    expect(dueRule(svc.int)?.days).toBe(90);
    expect(dueRule(svc.tint)).toBeNull();
  });
  it("only delivered visits count as the last service", () => {
    const jobs = [
      { serviceId: "w", status: "CANCELLED", createdAt: "2026-10-14T10:00:00Z" },
      { serviceId: "w", status: "DELIVERED", createdAt: "2026-09-01T10:00:00Z" },
    ];
    expect(lastFinishedJob(jobs)?.createdAt).toBe("2026-09-01T10:00:00Z");
    expect(lastFinishedJob([jobs[0]!])).toBeNull();
  });
  it("picks the soonest due item and flags overdue days", () => {
    const jobs = [
      { serviceId: "w", status: "DELIVERED", createdAt: "2026-09-01T00:00:00Z" },
      { serviceId: "c", status: "DELIVERED", createdAt: "2026-09-20T00:00:00Z" },
    ];
    const r = nextDue(jobs, { w: svc.wash, c: svc.cer }, Date.parse("2026-10-15T00:00:00Z"));
    expect(r?.service.id).toBe("w");
    expect(r?.overdueDays).toBe(14);
  });
});
