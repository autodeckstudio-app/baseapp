import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { flagMissedBookings } from "../../lib/missed-bookings.js";

function fakeDb(bookings: Array<Record<string, unknown> & { id: string }>) {
  const audit = new Map<string, Record<string, unknown>>();
  const db = {
    collection: (name: string) => {
      if (name === "bookings") {
        return {
          where: () => ({ where: () => ({ get: async () => ({ docs: bookings.map((b) => ({ id: b.id, data: () => b })) }) }) }),
        };
      }
      return {
        doc: (id: string) => ({
          create: async (data: Record<string, unknown>) => {
            if (audit.has(id)) throw Object.assign(new Error("exists"), { code: 6 });
            audit.set(id, data);
          },
        }),
      };
    },
  };
  return { db: db as unknown as Firestore, audit };
}

const NOW = Date.parse("2026-10-05T12:00:00Z");
const base = { tenantId: "t", studioId: "s", scheduledAt: "2026-10-05T06:00:00Z", status: "CONFIRMED" };

describe("flagMissedBookings", () => {
  it("writes one booking.missed audit entry per missed booking, once", async () => {
    const { db, audit } = fakeDb([{ id: "b1", ...base }, { id: "b2", ...base, status: "COMPLETED" }, { id: "b3", ...base, scheduledAt: "2026-10-05T10:00:00Z" }]);
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(1);
    expect([...audit.values()].map((a) => a["entityId"])).toEqual(["b1"]);
    expect([...audit.values()][0]?.["action"]).toBe("booking.missed");
    expect((await flagMissedBookings(db, NOW)).flagged).toBe(0);
  });
});
