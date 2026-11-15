import { describe, expect, it } from "vitest";
import { jobTimeline } from "./job-stage";
const h = (status: string, t: string) => ({ status, changedAt: `2026-10-16T${t}:00Z` });
describe("jobTimeline", () => {
  it("marks done, now and next with the time each began", () => {
    const t = jobTimeline("IN_PROGRESS", [h("VEHICLE_RECEIVED", "04:30"), h("IN_PROGRESS", "05:10")]);
    expect(t.map((s) => s.state)).toEqual(["done", "now", "next", "next"]);
    expect(t[0]!.at).toBe("2026-10-16T04:30:00Z");
    expect(t[2]!.at).toBeNull();
  });
  it("a delivered job shows every step done", () => {
    expect(jobTimeline("DELIVERED", [h("VEHICLE_RECEIVED", "04:00")]).every((s) => s.state === "done" || s.state === "now")).toBe(true);
  });
  it("uses the first time a status was entered and never shows notes", () => {
    const t = jobTimeline("QUALITY_CHECK", [h("IN_PROGRESS", "06:00"), h("IN_PROGRESS", "05:00")]);
    expect(t[1]!.at).toBe("2026-10-16T05:00:00Z");
    expect(Object.keys(t[0]!)).not.toContain("notes");
  });
});

it("delivered replaces the terminal pickup label and uses the actual handover time, without a fifth step",()=>{const steps=jobTimeline("DELIVERED",[h("READY_FOR_DELIVERY","10:00"),h("DELIVERED","11:30")]);expect(steps).toHaveLength(4);expect(steps[3]).toEqual({label:"Delivered",at:"2026-10-16T11:30:00Z",state:"done"});expect(steps.some(s=>s.label==="Ready for pickup")).toBe(false)});
it("missing delivery history never borrows the earlier ready time as a handover",()=>{expect(jobTimeline("DELIVERED",[h("READY_FOR_DELIVERY","10:00")])[3]).toEqual({label:"Delivered",at:null,state:"done"})});
