// CI-covered contract for the studio-role roster defect fix (source guard).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const view = readFileSync(`${__dirname}/AttendanceView.tsx`, "utf8");
const page = readFileSync(`${__dirname}/../app/(admin)/attendance/page.tsx`, "utf8");

describe("roster failure is modelled explicitly", () => {
  it("Not-in counter is clamped and never computed from a failed roster", () => {
    expect(view).toContain("Math.max(0, activeStaff.length - present)");
    expect(view).toContain('p.rosterFailed !== null');
  });
  it("denied roster shows a rule-aware message instead of the empty-roster copy", () => {
    expect(view).toContain("The team roster needs an Office sign-in");
    expect(view.indexOf('p.rosterFailed === "permission"')).toBeLessThan(view.indexOf("No one on the roster yet"));
  });
  it("the page distinguishes roster-load failure from an empty roster", () => {
    expect(page).toContain("rosterFailed");
    expect(page).toContain('setRosterFailed(code === "permission-denied" ? "permission" : "error")');
    expect(page).toContain("rosterFailed={rosterFailed}");
  });
});
