import { describe, it, expect } from "vitest";
import { visitTiming, formatSpan } from "./visit-timing.js";

const T = (s: string) => Date.parse(`2026-10-29T${s}:00+05:30`);
const slot = { scheduledAt: "2026-10-29T15:00:00+05:30", estimatedEndAt: "2026-10-29T15:45:00+05:30" };

describe("visitTiming", () => {
  it("counts down before the slot and only emphasises when soon is set", () => {
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("12:50"))).toMatchObject({ phase: "upcoming", label: "In 2h 10m", soon: false, needsAttention: false });
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("13:30"), { soonMinutes: 120 })).toMatchObject({ soon: true, tone: "warning", label: "In 1h 30m" });
  });
  it("is due from the slot start with elapsed time and no invented grace", () => {
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("15:00")).label).toBe("Due now");
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("15:20"))).toMatchObject({ phase: "due", label: "Due now, 20 min since start", needsAttention: true });
  });
  it("turns Late only when a grace is configured", () => {
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("15:20"), { lateAfterMinutes: 15 })).toMatchObject({ label: "Late, 20 min past start", tone: "error" });
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("15:10"), { lateAfterMinutes: 15 }).label).toBe("Due now, 10 min since start");
  });
  it("keeps an unarrived booking visible after its planned end", () => {
    expect(visitTiming({ status: "PENDING_VEHICLE", ...slot }, T("18:00"))).toMatchObject({ phase: "not_arrived", needsAttention: true, label: "Not arrived, slot ended 2h 15m ago" });
  });
  it("running then overrun, never hidden", () => {
    expect(visitTiming({ status: "IN_PROGRESS", ...slot }, T("15:30"))).toMatchObject({ phase: "running", label: "Planned end in 15 min" });
    expect(visitTiming({ status: "IN_PROGRESS", ...slot }, T("16:25"))).toMatchObject({ phase: "overrun", label: "Over planned end by 40 min", needsAttention: true });
  });
  it("the 26 Oct job started 13h29m before its slot is running, then overrun days later", () => {
    const old = { scheduledAt: "2026-10-26T14:00:00+05:30", estimatedEndAt: "2026-10-26T14:45:00+05:30" };
    expect(visitTiming({ status: "IN_PROGRESS", ...old }, T("04:50")).label).toBe("Over planned end by 2d 14h");
  });
  it("ready, and closed states carry no timing", () => {
    expect(visitTiming({ status: "READY_FOR_DELIVERY", ...slot }, T("16:00")).phase).toBe("ready");
    for (const s of ["DELIVERED", "CANCELLED"]) expect(visitTiming({ status: s, ...slot }, T("16:00"))).toMatchObject({ phase: "closed", label: "", needsAttention: false });
  });
  it("formats spans", () => {
    expect([0, 59, 60, 125, 1440, 1500].map(formatSpan)).toEqual(["0 min", "59 min", "1h", "2h 5m", "1d", "1d 1h"]);
  });
});
