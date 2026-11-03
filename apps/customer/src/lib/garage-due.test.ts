import { describe, expect, it } from "vitest";
import { compactDueChip, dueChip } from "./garage-due";

const svc = { s1: { id: "s1", name: "Interior clean", category: "washing" } };
const now = Date.parse("2026-10-17T00:00:00Z");
const job = (vehicleId: string, daysAgo: number, status = "DELIVERED") => ({ serviceId: "s1", vehicleId, status, createdAt: new Date(now - daysAgo * 86_400_000).toISOString() });
describe("garage due chip", () => {
  it("counts days to the next due from delivered visits of that car only", () => {
    expect(dueChip([job("v1", 78)], "v1", svc, now)).toBe("Interior clean due in 12 days");
    expect(dueChip([job("v1", 78)], "v2", svc, now)).toBeNull();
  });
  it("says overdue and ignores undelivered visits", () => {
    expect(dueChip([job("v1", 100)], "v1", svc, now)).toBe("Interior clean overdue 10 days");
    expect(dueChip([job("v1", 78, "IN_PROGRESS")], "v1", svc, now)).toBeNull();
  });
});

it("keeps visual due badges short without dropping overdue/today semantics",()=>{expect(compactDueChip("Detail wash due in 21 days")).toBe("Due in 21 days");expect(compactDueChip("Interior clean overdue 1 day")).toBe("Overdue 1 day");expect(compactDueChip("Wash due today")).toBe("Due today");});
