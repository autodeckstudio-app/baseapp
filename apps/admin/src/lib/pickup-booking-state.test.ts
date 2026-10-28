import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { pickupRowState } from "./pickup-booking-state";

const r = { kind: "drop", status: "REQUESTED" };
describe("admin pickup row state", () => {
  it("flags cancelled and missing bookings and blocks approve", () => {
    expect(pickupRowState(r, "b1", { b1: "CANCELLED" }, 300).actionable).toBe(false);
    expect(pickupRowState(r, "gone", { b1: "ACTIVE" }, 300)).toMatchObject({ actionable: false });
  });
  it("keeps a completed booking with a drop owed actionable", () => {
    expect(pickupRowState(r, "b1", { b1: "COMPLETED" }, 300)).toMatchObject({ actionable: true });
  });
  it("does not call a booking missing when the feed is not loaded or is at its cap", () => {
    expect(pickupRowState(r, "b1", null, 300).actionable).toBe(true);
    const full = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`x${i}`, "ACTIVE"]));
    expect(pickupRowState(r, "unseen", full, 300).actionable).toBe(true);
  });
  it("the page keeps the request visible and disables Approve/Mark done, not Decline", () => {
    const p = readFileSync(join(__dirname, "../app/(admin)/pickups/page.tsx"), "utf8");
    expect(p).toContain("pickupRowState(");
    expect(p).toContain('disabled={busy !== null || blocked} onClick={() => void act(r, "CONFIRMED")}');
    expect(p).toContain('disabled={busy !== null || blocked} onClick={() => void act(r, "DONE")}');
    expect(p).toMatch(/disabled=\{busy !== null\} onClick=\{\(\) => void act\(r, "DECLINED"\)\}/);
  });
});
