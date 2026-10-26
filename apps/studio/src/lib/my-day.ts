import type { AttendanceRecord } from "@autodeck/core";

export type DayAction = "in" | "bs" | "be" | "out";

/** Which attendance buttons make sense right now, from the real record. Nothing here changes data. */
export function dayActions(today: Pick<AttendanceRecord, "checkInAt" | "checkOutAt" | "breaks"> | null): Record<DayAction, boolean> {
  const checkedIn = !!today?.checkInAt;
  const out = !!today?.checkOutAt;
  const onBreak = !!today?.breaks?.some((b) => !b.endedAt);
  return {
    in: !checkedIn,
    bs: checkedIn && !out && !onBreak,
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
