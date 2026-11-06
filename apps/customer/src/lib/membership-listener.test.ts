import { it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({
  preflight: vi.fn(async () => []),
  cb: null as any,
}));
vi.mock("./membership-service", () => ({
  getMyMemberships: () => h.preflight(),
}));
vi.mock("./firebase", () => ({ db: {} }));
vi.mock("./customer-job-read", () => ({ SAFE_CUSTOMER_JOBS_READY: false }));
vi.mock("firebase/firestore", () => ({
  collection: (_: any, p: any) => p,
  query: (...a: any[]) => a,
  where: (...a: any[]) => a,
  onSnapshot: (_: any, cb: any) => {
    h.cb = cb;
    return () => {};
  },
}));
import { listenToMyMemberships } from "./home-service";
it("real membership listener projects past-endDate active as expired without mutating source; pending/cancelled unchanged", async () => {
  const result = vi.fn();
  listenToMyMemberships("t", "canonical", result, vi.fn());
  await Promise.resolve();
  const rows = [
    { id: "expired", status: "active", endDate: "2000-01-01" },
    { id: "pending", status: "pending", endDate: null },
    { id: "cancelled", status: "cancelled", endDate: "2000-01-01" },
    { id: "future", status: "active", endDate: "2099-01-01" },
  ];
  h.cb({ docs: rows.map((r) => ({ data: () => r })) });
  expect(result.mock.calls[0]![0].map((r: any) => r.status)).toEqual([
    "expired",
    "pending",
    "cancelled",
    "active",
  ]);
  expect(rows[0]!.status).toBe("active");
});

it("historical identity preflight failure surfaces review error instead of empty membership list and prevents listener", async () => {
  h.cb = null;
  h.preflight.mockRejectedValueOnce(
    Error("earlier membership needs a studio identity review"),
  );
  const rows = vi.fn(),
    error = vi.fn();
  listenToMyMemberships("t", "canonical", rows, error);
  await Promise.resolve();
  await Promise.resolve();
  expect(error).toHaveBeenCalled();
  expect(rows).not.toHaveBeenCalled();
  expect(h.cb).toBeNull();
});
