import { describe, expect, it } from "vitest";
import { refreshVisitState } from "./membership-refresh";

const active = { status: "active" as const, refreshesTotal: 1, refreshesUsed: 0 };
const job = { status: "IN_PROGRESS" as const };

describe("refreshVisitState", () => {
  it("plan without the benefit never offers it", () => {
    expect(refreshVisitState({ status: "active", refreshesTotal: 0, refreshesUsed: 0 }, job, null)).toBe("unavailable");
    expect(refreshVisitState({ status: "active" }, job, null)).toBe("unavailable");
  });

  it("an active membership with credit is recordable", () => {
    expect(refreshVisitState(active, job, null)).toBe("recordable");
  });

  it("a live record for this visit reads as recorded, never recordable again", () => {
    expect(refreshVisitState({ ...active, refreshesUsed: 1 }, job, "row-1")).toBe("recorded");
  });

  it("an exhausted benefit reads exhausted", () => {
    expect(refreshVisitState({ ...active, refreshesUsed: 1 }, job, null)).toBe("exhausted");
  });

  it("inactive membership or cancelled job is never recordable", () => {
    expect(refreshVisitState({ ...active, status: "expired" as const }, job, null)).toBe("unavailable");
    expect(refreshVisitState(active, { status: "CANCELLED" as const }, null)).toBe("unavailable");
  });
});
