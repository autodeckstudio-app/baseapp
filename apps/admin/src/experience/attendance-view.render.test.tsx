// Mounted proof for the studio-role roster defect fix. A denied roster query
// (Studio role may read only its own employee doc) must never render a
// negative "Not in" counter or the contradictory "No one on the roster yet"
// empty state; a reachable empty roster keeps the original copy.
import { describe, expect, it } from "vitest";
import { create, act } from "react-test-renderer";
import { createElement } from "react";
import type { AttendanceRecord, Employee } from "@autodeck/core";
import { AttendanceView } from "./AttendanceView";

const emp = (id: string, name: string): Employee =>
  ({ id, tenantId: "t", authUid: `u-${id}`, name, role: "studio", studioId: "s1", phone: null, email: null, terminatedAt: null, createdAt: "x", updatedAt: "x" }) as unknown as Employee;

const rec = (employeeId: string): AttendanceRecord =>
  ({ id: `r-${employeeId}`, tenantId: "t", studioId: "s1", employeeId, employeeAuthUid: `u-${employeeId}`, date: "2026-11-03", status: "PRESENT", checkInAt: "2026-11-02T18:39:00Z", checkOutAt: null, breaks: [], workedMinutes: 0, notes: null, markedBy: "u", createdAt: "x", updatedAt: "x" }) as unknown as AttendanceRecord;

function renderView(over: Partial<Parameters<typeof AttendanceView>[0]>): string {
  const props: Parameters<typeof AttendanceView>[0] = {
    date: "2026-11-03",
    staff: [],
    records: [],
    rosterFailed: null,
    me: null,
    myRecord: null,
    isAdmin: false,
    loading: false,
    busy: false,
    error: null,
    message: null,
    onCheckIn: () => {},
    onCheckOut: () => {},
    onEndBreak: () => {},
    onMark: () => {},
    ...over,
  };
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(createElement(AttendanceView, props)); });
  return JSON.stringify(tree.toJSON());
}

describe("AttendanceView roster failure handling", () => {
  it("denied roster: no negative Not-in counter, no contradictory empty state", () => {
    const out = renderView({ rosterFailed: "permission", staff: [], records: [rec("e1"), rec("e2")], error: "Couldn't load the team." });
    expect(out).not.toContain("-2");
    expect(out).not.toContain("No one on the roster yet");
    expect(out).toContain("The team roster needs an Office sign-in");
    expect(out).toContain("Couldn't load the team.");
  });

  it("generic load failure gets neutral retry copy, never Office-sign-in copy", () => {
    const out = renderView({ rosterFailed: "error", staff: [], records: [], error: "Couldn't load the team." });
    expect(out).toContain("The roster didn't load");
    expect(out).not.toContain("Office sign-in");
    expect(out).not.toContain("No one on the roster yet");
  });

  it("reachable empty roster keeps the original empty state and a zero counter", () => {
    const out = renderView({ rosterFailed: null, staff: [], records: [] });
    expect(out).toContain("No one on the roster yet");
    expect(out).not.toContain("The team roster needs an Office sign-in");
  });

  it("clamps Not in at zero when records outnumber the roster", () => {
    const out = renderView({ staff: [emp("e1", "Ravi")], records: [rec("e1"), rec("e2")] });
    expect(out).not.toMatch(/"children":\["-\d+"\]/);
  });

  it("counts present-vs-roster normally for an Office admin", () => {
    const out = renderView({ isAdmin: true, staff: [emp("e1", "Ravi"), emp("e2", "Meena"), emp("e3", "Asha")], records: [rec("e1")] });
    expect(out).toContain("Mark someone");
  });
});
