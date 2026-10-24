// Hourly pickup-time preference slots for the booking day. A pickup must
// happen before the service starts, so only slots up to the booking's own
// scheduled time are offered: a 10:00 booking cannot have an 11:00 pickup.
// Times are "HH:mm" in the studio timezone, the same format the booking
// flow already carries (AvailableSlot.startTime / confirm screen params), so
// no Date or timezone conversion happens here. The caller passes the booking
// day's actual opening time from the live studio record (the same hours the
// booking engine uses); 09:00 is only the fallback and matches the engine's
// own seeded default, so a failed hours fetch never silently drops valid
// earlier choices.
export const PICKUP_SLOT_OPEN = "09:00";

const toMinutes = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins < 24 * 60 ? mins : null;
};

const toClock = (mins: number): string => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function pickupSlotsFor(scheduledTime: string, openTime: string = PICKUP_SLOT_OPEN): string[] {
  const open = toMinutes(openTime);
  const latest = toMinutes(scheduledTime);
  if (open === null || latest === null) return [];
  const slots: string[] = [];
  for (let mins = open; mins <= latest; mins += 60) slots.push(toClock(mins));
  // A booking on a non-hourly mark (e.g. 10:30) still gets its own time as
  // the last, latest allowed slot.
  const last = slots.length > 0 ? toMinutes(slots[slots.length - 1] ?? "") : null;
  if (last === null || last < latest) slots.push(toClock(latest));
  return slots;
}
