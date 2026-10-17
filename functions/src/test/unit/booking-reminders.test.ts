import { describe, it, expect } from "vitest";
import { bookingReminderText } from "@autodeck/core";
import { reminderMark, sendBookingReminders } from "../../lib/booking-reminders.js";

const H = 3_600_000, M = 60_000;
const now = Date.parse("2026-10-17T06:00:00Z");
const bk = (o: Record<string, unknown>) => ({ id: "b1", tenantId: "t", customerId: "c1", status: "CONFIRMED", scheduledAt: new Date(now + 24 * H - 5 * M).toISOString(), ...o });
function fakeDb(rows: Record<string, unknown>[]) {
  const notes = new Map<string, unknown>();
  const db = { collection: () => ({
    where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: rows.map((r) => ({ data: () => r })) }) }) }) }),
    doc: (id: string) => ({ create: async (n: unknown) => { if (notes.has(id)) throw Object.assign(new Error("x"), { code: 6 }); notes.set(id, n); } }),
  }) };
  return { db: db as never, notes };
}

describe("booking reminders", () => {
  it("fires only in the 15 minutes under 24h and 2h", () => {
    expect(reminderMark(24 * H - 5 * M)).toBe(24);
    expect(reminderMark(2 * H - 1 * M)).toBe(2);
    expect(reminderMark(12 * H)).toBeNull();
    expect(reminderMark(24 * H + M)).toBeNull();
    expect(reminderMark(2 * H - 20 * M)).toBeNull();
  });
  it("sends once per booking, slot and mark, and a reschedule gets fresh ones", async () => {
    const { db, notes } = fakeDb([bk({})]);
    expect((await sendBookingReminders(db, now)).sent).toBe(1);
    expect((await sendBookingReminders(db, now)).sent).toBe(0);
    const t = Date.parse(bk({}).scheduledAt as string);
    expect([...notes.keys()]).toEqual([`bkrem-b1-${t}-24`]);
    const moved = fakeDb([bk({ scheduledAt: new Date(now + 2 * H - M).toISOString() })]);
    expect((await sendBookingReminders(moved.db, now)).sent).toBe(1);
  });
  it("skips unconfirmed, cancelled and customer-less bookings", async () => {
    const { db } = fakeDb([bk({ status: "PENDING" }), bk({ id: "x", status: "CANCELLED" }), bk({ id: "y", customerId: "" })]);
    expect((await sendBookingReminders(db, now)).sent).toBe(0);
  });
  it("wording is plain: no offer, price or promise", () => {
    for (const h of [24, 2] as const) expect(JSON.stringify(bookingReminderText(h, "Sun, 18 Oct, 10:00 am"))).not.toMatch(/\boff\b|%|discount|\bfree\b|\bRs\b|\u20b9|\u2014/i);
  });
});
