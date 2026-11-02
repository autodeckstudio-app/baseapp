import type { AttendanceRecord } from "@autodeck/core";

export type DayAction = "in" | "bs" | "be" | "out";

/** Which attendance buttons make sense right now, from the real record. Nothing here changes data. */
export function dayActions(today: Pick<AttendanceRecord, "checkInAt" | "checkOutAt" | "breaks"> | null): Record<DayAction, boolean> {
  const checkedIn = !!today?.checkInAt;
  const out = !!today?.checkOutAt;
  const onBreak = !!today?.breaks?.some((b) => !b.endedAt);
  return {
    in: !checkedIn,
    // Break controls removed from the UI (Gauri 2 Nov basket item 3; Meet 16:25 "Accept gauris
    // changes"). UI-only: records, history and the backend functions are untouched. "End break"
    // stays available while a break is actually open so anyone mid-break can still finish the
    // day and check out; no new break can be started.
    bs: false,
    be: checkedIn && !out && onBreak,
    out: checkedIn && !out && !onBreak,
  };
}

/** What staff see when an attendance call fails. The server's own wording is plain English for state problems (already checked in, no roster record, end the break first), so show it; anything else gets a generic retry line. */
export function dayErrorNote(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  const msg = e instanceof Error ? e.message : "";
  const stateProblem = /(^|\/)(failed-precondition|permission-denied|already-exists)$/.test(code);
  return stateProblem && msg ? msg : "That did not go through. Try again.";
}
