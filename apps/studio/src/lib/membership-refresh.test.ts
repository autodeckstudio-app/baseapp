import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { refreshVisitState } from "./membership-refresh";

const active = { status: "active" as const, endDate: "2099-01-01", refreshesTotal: 1, refreshesUsed: 0 };
const job = { status: "IN_PROGRESS" as const };

describe("refreshVisitState", () => {
  it("plan without the benefit never offers it", () => {
    expect(refreshVisitState({ status: "active" as const, endDate: "2099-01-01", refreshesTotal: 0, refreshesUsed: 0 }, job, null)).toBe("unavailable");
    expect(refreshVisitState({ status: "active" as const, endDate: null }, job, null)).toBe("unavailable");
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

  it("stale-active membership past its endDate is never recordable (lazy-expiry parity)", () => {
    const expired = { ...active, endDate: "2020-10-31" };
    expect(refreshVisitState(expired, job, null, "2026-11-19")).toBe("unavailable");
    const live = { ...active, endDate: "2026-12-01" };
    expect(refreshVisitState(live, job, null, "2026-11-19")).toBe("recordable");
    expect(refreshVisitState({ ...active, endDate: null }, job, null, "2026-11-19")).toBe("unavailable");
  });

  it("malformed counters fail closed - recording is never offered on unverifiable numbers", () => {
    expect(refreshVisitState({ ...active, refreshesTotal: 1.5 }, job, null)).toBe("unavailable");
    expect(refreshVisitState({ ...active, refreshesUsed: Number.NaN }, job, null)).toBe("unavailable");
    expect(refreshVisitState({ ...active, refreshesUsed: -1 }, job, null)).toBe("unavailable");
    expect(refreshVisitState({ ...active, refreshesUsed: 2 }, job, null)).toBe("unavailable"); // used past total = corrupt
    // ...but a recorded visit still shows as recorded (visit truth rides on the row).
    expect(refreshVisitState({ ...active, refreshesUsed: 2 }, job, "ru1")).toBe("recorded");
  });
});

// Actual default clock path, not an injected already-computed date.
it("stops offering refresh exactly at midnight IST after last valid date", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-20T18:29:59.999Z"));
    const m = { ...active, endDate: "2026-11-20" };
    expect(refreshVisitState(m, job, null)).toBe("recordable");
    vi.setSystemTime(new Date("2026-11-20T18:30:00Z"));
    expect(refreshVisitState(m, job, null)).toBe("unavailable");
  } finally { vi.useRealTimers(); }
});
