import { describe, expect, it, vi } from "vitest";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { resolveServiceName } from "../../lib/service-name.js";

function mockDb(snapData: { exists: boolean; row?: unknown }) {
  const snap = { exists: snapData.exists, data: () => snapData.row };
  const tx = { get: vi.fn().mockResolvedValue(snap) } as unknown as Transaction;
  const docRef = { id: "svc1" };
  const collection = { doc: vi.fn().mockReturnValue(docRef) };
  const db = { collection: vi.fn().mockReturnValue(collection) } as unknown as Firestore;
  return { db, tx };
}

describe("resolveServiceName", () => {
  it("returns the catalogue display name for a matching service", async () => {
    const { db, tx } = mockDb({ exists: true, row: { tenantId: "t1", name: "Premium Wash" } });
    await expect(resolveServiceName(db, tx, "t1", "svc1")).resolves.toBe("Premium Wash");
  });

  it("falls back to a generic label (never the raw id) on a tenant mismatch", async () => {
    const { db, tx } = mockDb({ exists: true, row: { tenantId: "other", name: "Premium Wash" } });
    await expect(resolveServiceName(db, tx, "t1", "svc1")).resolves.toBe("Service");
  });

  it("falls back when the service is missing", async () => {
    const { db, tx } = mockDb({ exists: false });
    await expect(resolveServiceName(db, tx, "t1", "svc9")).resolves.toBe("Service");
  });

  it("trims the display name", async () => {
    const { db, tx } = mockDb({ exists: true, row: { tenantId: "t1", name: "  Ceramic Coating  " } });
    await expect(resolveServiceName(db, tx, "t1", "svc1")).resolves.toBe("Ceramic Coating");
  });
});
