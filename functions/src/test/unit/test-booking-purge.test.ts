import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { planTestBookingPurge, type PurgeCandidate } from "../../lib/test-booking-purge.js";

const src = (p: string) => readFileSync(`${__dirname}/../../${p}`, "utf8");
const TEST_CUSTOMER = "cust-test-owner";

const base = (over: Partial<PurgeCandidate> = {}): PurgeCandidate => ({
  bookingId: "b1",
  bookingExists: true,
  bookingStatus: "CANCELLED",
  bookingCustomerId: TEST_CUSTOMER,
  jobs: [{ id: "j1", status: "CANCELLED" }],
  paymentCount: 0,
  invoiceCount: 0,
  intentIds: ["i1"],
  pickupRequestIds: [],
  ...over,
});

describe("test-booking purge validation (fail-closed)", () => {
  it("accepts a fully-cancelled, payment-free booking on the named test account", () => {
    expect(planTestBookingPurge(base(), TEST_CUSTOMER)).toEqual({ ok: true, bookingId: "b1" });
  });
  it("accepts a cancelled booking with no job at all", () => {
    expect(planTestBookingPurge(base({ jobs: [] }), TEST_CUSTOMER).ok).toBe(true);
  });
  it("rejects a booking that does not exist", () => {
    const v = planTestBookingPurge(base({ bookingExists: false }), TEST_CUSTOMER);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("does not exist");
  });
  it.each(["CONFIRMED", "COMPLETED", "PENDING", "EXPIRED"])("rejects status %s - only CANCELLED can be purged", (status) => {
    const v = planTestBookingPurge(base({ bookingStatus: status }), TEST_CUSTOMER);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain(status);
  });
  it("rejects a booking on any other customer account (real-customer guard)", () => {
    const v = planTestBookingPurge(base({ bookingCustomerId: "cust-real-person" }), TEST_CUSTOMER);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("different customer");
  });
  it("rejects when any payment record exists - money evidence is never purged", () => {
    const v = planTestBookingPurge(base({ paymentCount: 1 }), TEST_CUSTOMER);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("payment");
  });
  it("rejects when an invoice exists", () => {
    const v = planTestBookingPurge(base({ invoiceCount: 1 }), TEST_CUSTOMER);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("invoice");
  });
  it("rejects when any linked job is not cancelled", () => {
    const v = planTestBookingPurge(base({ jobs: [{ id: "j1", status: "CANCELLED" }, { id: "j2", status: "IN_PROGRESS" }] }), TEST_CUSTOMER);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("j2");
  });
});

describe("purgeTestBookings endpoint shape (source pins)", () => {
  const fn = src("functions/booking/purgeTestBookings.ts");
  it("is admin/superadmin only - not a generalized destructive endpoint", () => {
    expect(fn).toContain('assertRole(user, "admin", "superadmin")');
  });
  it("validates input with a strict schema", () => {
    expect(fn).toContain(".strict()");
  });
  it("writes the recovery snapshot before any delete inside one transaction", () => {
    expect(fn.indexOf("cleanupSnapshots()")).toBeGreaterThan(-1);
    expect(fn.indexOf("tx.set(snapshotRef")).toBeLessThan(fn.indexOf("tx.delete(bookingRef)"));
  });
  it("writes an audit log entry per purged booking", () => {
    expect(fn).toContain('"booking.test_purged"');
  });
  it("defaults to dry-run when dryRun is not passed", () => {
    expect(fn).toContain("data.dryRun ?? true");
  });
});
