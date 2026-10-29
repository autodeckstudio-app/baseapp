import { describe, it, expect } from "vitest";
import { jobStage } from "./job-stage";
describe("jobStage slot started", () => {
  it("keeps the normal line before the slot", () => expect(jobStage("PENDING_VEHICLE")!.line).toBe("Bring it in at your booked time."));
  it("states the fact once the slot has started, with no instruction", () => {
    const l = jobStage("PENDING_VEHICLE", true)!.line; expect(l).not.toMatch(/Bring it in/); expect(l).toBe("Your car has not arrived yet."); expect(l).not.toMatch(/started|ended|slot/i);
  });
  it("does not touch started jobs", () => expect(jobStage("IN_PROGRESS", true)!.line).toBe("Your car is being worked on now."));
});

import { readyRowTitle } from "../lib/booking-rules";
import { visitTiming, customerTimingLine } from "@autodeck/core";
describe("timing pane + status card + row title agree for every visit phase", () => {
  const base = { id: "j", status: "PENDING_VEHICLE", scheduledAt: "2026-10-29T08:30:00.000Z", estimatedEndAt: "2026-10-29T09:15:00.000Z", scheduledDate: "2026-10-29", estimatedEndDate: "2026-10-29" } as never;
  const at = (iso: string) => Date.parse(iso);
  it.each([
    ["before start", "2026-10-29T07:00:00.000Z", "upcoming", false, "Expected ready"],
    ["inside slot", "2026-10-29T08:40:00.000Z", "due", true, "Expected ready"],
    ["after slot", "2026-10-29T10:00:00.000Z", "not_arrived", true, "Planned end"],
  ])("%s", (_n, now, phase, started, title) => {
    const t = visitTiming(base, at(now));
    expect(t.phase).toBe(phase);
    const slotStarted = t.phase === "due" || t.phase === "not_arrived";
    expect(slotStarted).toBe(started);
    expect(readyRowTitle(t.phase)).toBe(title);
    const card = jobStage("PENDING_VEHICLE", slotStarted)!.line;
    const pane = customerTimingLine(t);
    if (slotStarted) { expect(card).toBe("Your car has not arrived yet."); expect(pane).not.toBe(""); expect(card).not.toBe(pane); }
    else expect(card).toBe("Bring it in at your booked time.");
  });
  it("overrun keeps Planned end", () => expect(readyRowTitle("overrun")).toBe("Planned end"));
});
