import { describe, it, expect } from "vitest";
import { selectWinbackTargets, WINBACK_DAYS } from "@autodeck/core";
import { WINBACK_BODY } from "../../lib/winback.js";

const DAY = 86_400_000;
const now = Date.parse("2026-10-16T00:00:00Z");
const ago = (d: number) => new Date(now - d * DAY).toISOString();
const base = { hasOpenBooking: new Set<string>(), lastNudge: {}, now };

describe("win-back targeting", () => {
  it("default window is 90 days", () => expect(WINBACK_DAYS).toBe(90));
  it("nudges only those past the window", () => {
    expect(selectWinbackTargets({ ...base, lastVisit: { a: ago(91), b: ago(30), c: ago(90) } })).toEqual(["a", "c"]);
  });
  it("skips customers with an open booking", () => {
    expect(selectWinbackTargets({ ...base, hasOpenBooking: new Set(["a"]), lastVisit: { a: ago(200) } })).toEqual([]);
  });
  it("skips customers nudged inside the cooldown, but not after it", () => {
    expect(selectWinbackTargets({ ...base, lastNudge: { a: ago(10) }, lastVisit: { a: ago(200) } })).toEqual([]);
    expect(selectWinbackTargets({ ...base, lastNudge: { a: ago(100) }, lastVisit: { a: ago(200) } })).toEqual(["a"]);
  });
  it("the message is plain: no offer, no discount, no price", () => {
    expect(WINBACK_BODY).not.toMatch(/off|%|discount|free|Rs|\u20b9/i);
  });
  it("a bad date never sends", () => expect(selectWinbackTargets({ ...base, lastVisit: { a: "nope" } })).toEqual([]));
});
