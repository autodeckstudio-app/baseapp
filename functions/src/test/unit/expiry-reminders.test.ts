import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { reminderTargetDates, expiryReminderText } from "@autodeck/core";
import { sendExpiryReminders } from "../../lib/expiry-reminders.js";

describe("expiry reminder dates", () => {
  it("targets 30 days, 7 days and today, across a month end", () => {
    expect(reminderTargetDates("2026-10-16")).toEqual([{ date: "2026-11-15", daysLeft: 30 }, { date: "2026-10-23", daysLeft: 7 }, { date: "2026-10-16", daysLeft: 0 }]);
    expect(reminderTargetDates("2026-12-20")[0]).toEqual({ date: "2027-01-19", daysLeft: 30 });
  });
  it("wording is plain: no offer, no price", () => {
    for (const d of [30, 7, 0] as const) expect(JSON.stringify(expiryReminderText("INSURANCE", d, "GJ01AB1234"))).not.toMatch(/off|%|discount|free|Rs|\u20b9/i);
    expect(expiryReminderText("PUC", 0, null).title).toBe("PUC expires today");
  });
});

// A tiny in-memory Firestore: papers, vehicles and notifications only.
function fakeDb(papers: Record<string, unknown>[], vehicles: Record<string, unknown>) {
  const notes = new Map<string, unknown>();
  const db = {
    collection: (name: string) => ({
      where: (_f: string, _o: string, dates: string[]) => ({ limit: () => ({ get: async () => ({ docs: papers.filter((p) => dates.includes(p["expiresOn"] as string)).map((p) => ({ data: () => p })) }) }) }),
      doc: (id: string) => ({
        get: async () => ({ exists: name === "vehicles" && id in vehicles, data: () => vehicles[id] }),
        create: async (n: unknown) => { if (notes.has(id)) throw Object.assign(new Error("exists"), { code: 6 }); notes.set(id, n); },
      }),
    }),
  };
  return { db: db as never, notes };
}
const now = Date.parse("2026-10-16T04:00:00Z");
const paper = (o: Record<string, unknown>) => ({ id: "p1", tenantId: "t", vehicleId: "v1", customerId: "c1", kind: "INSURANCE", status: "VERIFIED", expiresOn: "2026-10-23", ...o });

describe("sendExpiryReminders", () => {
  it("sends once for a verified paper, and a second run adds nothing", async () => {
    const { db, notes } = fakeDb([paper({})], { v1: { registrationNumber: "GJ01AB1234" } });
    expect((await sendExpiryReminders(db, now)).sent).toBe(1);
    expect((await sendExpiryReminders(db, now)).sent).toBe(0);
    expect([...notes.keys()]).toEqual(["expiry-p1-2026-10-23-7"]);
    expect((notes.get("expiry-p1-2026-10-23-7") as { body: string }).body).toContain("GJ01AB1234");
  });
  it("skips unverified papers, papers without a customer, other dates and deleted cars", async () => {
    const { db, notes } = fakeDb([paper({ id: "a", status: "PENDING" }), paper({ id: "b", customerId: "" }), paper({ id: "c", expiresOn: "2026-10-20" }), paper({ id: "d", vehicleId: "v2" })], { v1: {}, v2: { deletedAt: "2026-10-01" } });
    expect((await sendExpiryReminders(db, now)).sent).toBe(0);
    expect(notes.size).toBe(0);
  });
  it("is scheduled daily in IST", () => {
    const s = readFileSync(`${__dirname}/../../functions/notification/expiryRemindersScheduled.ts`, "utf8");
    expect(s).toContain('"0 9 * * *"');
    expect(s).toContain("Asia/Kolkata");
  });
});
