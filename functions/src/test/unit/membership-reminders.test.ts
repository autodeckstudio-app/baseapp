import { describe, it, expect } from "vitest";
import { membershipReminderText } from "@autodeck/core";
import { sendMembershipReminders } from "../../lib/membership-reminders.js";

function fakeDb(rows: Record<string, unknown>[]) {
  const notes = new Map<string, unknown>();
  const db = { collection: () => ({
    where: (_f: string, _o: string, v: string) => ({ limit: () => ({ get: async () => ({ docs: rows.filter((r) => r["status"] === v).map((r) => ({ data: () => r })) }) }) }),
    doc: (id: string) => ({ create: async (n: unknown) => { if (notes.has(id)) throw Object.assign(new Error("x"), { code: 6 }); notes.set(id, n); } }),
  }) };
  return { db: db as never, notes };
}
const now = Date.parse("2026-10-16T04:00:00Z");
const m = (o: Record<string, unknown>) => ({ id: "m1", tenantId: "t", customerId: "c1", tier: "gold", status: "active", endDate: "2026-10-23", ...o });

describe("sendMembershipReminders", () => {
  it("reminds at 7 days and today, once each", async () => {
    const { db, notes } = fakeDb([m({}), m({ id: "m2", endDate: "2026-10-16T00:00:00.000Z" })]);
    expect((await sendMembershipReminders(db, now)).sent).toBe(2);
    expect((await sendMembershipReminders(db, now)).sent).toBe(0);
    expect([...notes.keys()].sort()).toEqual(["memrem-m1-2026-10-23-7", "memrem-m2-2026-10-16-0"]);
    expect((notes.get("memrem-m1-2026-10-23-7") as { entityType: string }).entityType).toBe("Membership");
  });
  it("skips other days, pending or cancelled plans and plans with no customer", async () => {
    const { db } = fakeDb([m({ endDate: "2026-10-20" }), m({ id: "a", status: "pending" }), m({ id: "b", customerId: "" })]);
    expect((await sendMembershipReminders(db, now)).sent).toBe(0);
  });
  it("wording is plain: no offer or price", () => {
    for (const d of [7, 0] as const) expect(JSON.stringify(membershipReminderText(d, "silver"))).not.toMatch(/\boff\b|%|discount|\bfree\b|\bRs\b|\u20b9/i);
  });
});
