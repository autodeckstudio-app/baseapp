import { describe, it, expect } from "vitest";
import { dayActions } from "./my-day";

const rec = (o: object) => ({ checkInAt: null, checkOutAt: null, breaks: [], ...o }) as never;

describe("my day actions", () => {
  it("not checked in: only check in", () => {
    expect(dayActions(null)).toEqual({ in: true, bs: false, be: false, out: false });
    expect(dayActions(rec({}))).toEqual({ in: true, bs: false, be: false, out: false });
  });
  it("working: break or check out, not check in", () => {
    expect(dayActions(rec({ checkInAt: "2026-10-26T04:00:00Z" }))).toEqual({ in: false, bs: true, be: false, out: true });
  });
  it("on break: only end break", () => {
    expect(dayActions(rec({ checkInAt: "x", breaks: [{ startedAt: "y" }] }))).toEqual({ in: false, bs: false, be: true, out: false });
  });
  it("checked out: nothing", () => {
    expect(dayActions(rec({ checkInAt: "x", checkOutAt: "z" }))).toEqual({ in: false, bs: false, be: false, out: false });
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
describe("Account attendance rows use the same gating as Today (source guard only)", () => {
  it("disables each row from dayActions", () => {
    const src = readFileSync(resolve(process.cwd(), "src/app/(tabs)/account.tsx"), "utf8");
    for (const k of ["in", "bs", "be", "out"]) expect(src).toContain(`!acts.${k}`);
  });
});

import { dayErrorNote } from "./my-day";
describe("attendance error text", () => {
  it("shows the server's state message", () => {
    expect(dayErrorNote(Object.assign(new Error("Already checked in for today."), { code: "functions/already-exists" }))).toBe("Already checked in for today.");
    expect(dayErrorNote(Object.assign(new Error("No active staff roster record for this account."), { code: "functions/permission-denied" }))).toMatch(/roster/);
  });
  it("hides anything else", () => {
    expect(dayErrorNote(Object.assign(new Error("boom internal"), { code: "functions/internal" }))).toBe("That did not go through. Try again.");
    expect(dayErrorNote("x")).toBe("That did not go through. Try again.");
  });
});

/** The attendance server rules, copied from functions/src/functions/attendance/{checkIn,startBreak,endBreak,checkOut}Attendance.ts: each returns true when the call would succeed. This is a source-derived model, not a call to the deployed functions. */
type Rec = { checkInAt: string | null; checkOutAt: string | null; breaks: { startedAt: string; endedAt: string | null }[] } | null;
const server = {
  in: (r: Rec) => r === null,
  bs: (r: Rec) => r !== null && r.checkOutAt === null && !r.breaks.some((b) => b.endedAt === null),
  be: (r: Rec) => r !== null && r.breaks.some((b) => b.endedAt === null),
  out: (r: Rec) => r !== null && r.checkOutAt === null && !r.breaks.some((b) => b.endedAt === null),
};
describe("buttons match what the server would accept (source-derived model)", () => {
  const states: [string, Rec][] = [
    ["no record", null],
    ["working", { checkInAt: "t", checkOutAt: null, breaks: [] }],
    ["on break", { checkInAt: "t", checkOutAt: null, breaks: [{ startedAt: "t", endedAt: null }] }],
    ["after a finished break", { checkInAt: "t", checkOutAt: null, breaks: [{ startedAt: "t", endedAt: "u" }] }],
    ["checked out", { checkInAt: "t", checkOutAt: "z", breaks: [{ startedAt: "t", endedAt: "u" }] }],
  ];
  for (const [name, r] of states) {
    it(name, () => {
      const ui = dayActions(r as never);
      for (const k of ["in", "bs", "be", "out"] as const) {
        const serverOk = server[k](r);
        // "end break" is also accepted by the server only with an open break; UI must show a button iff the server would accept it.
        expect(ui[k], `${name} / ${k}`).toBe(serverOk);
      }
    });
  }
});
