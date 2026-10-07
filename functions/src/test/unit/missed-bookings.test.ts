import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { flagMissedBookings } from "../../lib/missed-bookings.js";

function fakeDb(bookings: Array<Record<string, unknown> & { id: string }>, concurrentStatus?: string, jobStatus?: string, washUsed = false) {
  const audit = new Map<string, Record<string, unknown>>();
  const rows = new Map(bookings.map(b => [b.id, { ...b }]));
  const membership = { washesUsed: 2 };
  const job = { id: "job", status: jobStatus, statusHistory: [] };
  const ref = (name: string, id: string) => ({ name, id });
  const db = {
    collection: (name: string) => ({
      where: () => ({ get: async () => ({ docs: bookings.map(b => ({ id: b.id, ref: ref(name, b.id), data: () => b })) }) }),
      doc: (id: string) => ref(name, id),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (r: { name?: string; id?: string }) => {
        if (!r.id) return { docs: jobStatus ? [{ ref: ref("jobs", "job"), data: () => job }] : [] };
        if (r.name === "memberships") return { exists: washUsed, data: () => membership };
        const v = r.name === "bookings" ? rows.get(r.id) : audit.get(r.id);
        return { exists: !!v, data: () => r.name === "bookings" && concurrentStatus ? { ...v, status: concurrentStatus } : v };
      },
      update: (r: { name: string; id: string }, data: Record<string, unknown>) => Object.assign(r.name === "memberships" ? membership : r.name === "jobs" ? job : rows.get(r.id)!, data),
      create: (r: { id: string }, data: Record<string, unknown>) => audit.set(r.id, data),
    }),
  };
  return { db: db as unknown as Firestore, audit, rows, job, membership };
}
const NOW = Date.parse("2026-10-05T15:30:00Z");
const base = { tenantId: "t", studioId: "s", scheduledAt: "2026-10-05T06:00:00Z", status: "CONFIRMED" };
describe("flagMissedBookings", () => {
  it("auto-cancels and notifies once per missed slot, including older than 72 hours", async () => {
    const { db, audit, rows } = fakeDb([{ id: "b1", ...base }, { id: "old", ...base, scheduledAt: "2026-10-01T06:00:00Z" }, { id: "active", ...base, status: "ACTIVE" }, { id: "future", ...base, scheduledAt: "2026-10-06T06:00:00Z" }]);
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(2);
    expect(rows.get("b1")?.["missedForScheduledAt"]).toBe(base.scheduledAt);
    expect(rows.get("b1")?.["status"]).toBe("CANCELLED");
    expect(rows.get("b1")?.["cancellationReason"]).toContain("Auto-cancelled:");
    expect(audit.size).toBe(2);
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(0);
  });
  it("does nothing before close", async () => {
    const { db, audit } = fakeDb([{ id: "b1", ...base }]);
    expect((await flagMissedBookings(db, NOW - 1)).flagged).toBe(0);
    expect(audit.size).toBe(0);
  });
  it("rechecks arrival inside the transaction", async () => {
    const { db, audit, rows } = fakeDb([{ id: "b1", ...base }], "ACTIVE");
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(0);
    expect(audit.size).toBe(0);
    expect(rows.get("b1")?.["missedAt"]).toBeUndefined();
  });
});

describe("auto-cancel related state", () => {
  it("cancels the waiting job and restores a consumed wash exactly once", async () => {
    const { db, rows, job, membership } = fakeDb([{ id: "b1", ...base, membershipId: "m", membershipWashUsed: true }], undefined, "PENDING_VEHICLE", true);
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(1);
    expect(rows.get("b1")?.["status"]).toBe("CANCELLED");
    expect(job.status).toBe("CANCELLED");
    expect(job.statusHistory).toHaveLength(1);
    expect(membership.washesUsed).toBe(1);
    await flagMissedBookings(db, NOW);
    expect(membership.washesUsed).toBe(1);
  });
  it("protects a vehicle that has arrived and is waiting for a bay", async () => {
    const { db, rows } = fakeDb([{ id: "b1", ...base }], undefined, "STANDBY");
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(0);
    expect(rows.get("b1")?.["status"]).toBe("CONFIRMED");
  });
});
