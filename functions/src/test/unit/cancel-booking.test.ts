import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cancellationTerms, pickupZone, pickupFeePaise, STUDIO_COORDS } from "@autodeck/core";
import { planRefund, readCancelReads, writeCancelRestores } from "../../lib/cancel-booking.js";
import { fakeFirestore } from "./fake-firestore.js";

const src = (p: string) => readFileSync(`${__dirname}/../../${p}`, "utf8");
const H = 3600000;

describe("fee and refund arithmetic", () => {
  it("paid money pays the fee first, the rest goes back", () => {
    expect(planRefund({ paidPaise: 100000, feePaise: 10000, waive: false })).toEqual({ paidPaise: 100000, feePaise: 10000, refundPaise: 90000, feeStatus: "withheld" });
  });
  it("the fee is capped at what was paid and the refund floor is 0", () => {
    expect(planRefund({ paidPaise: 5000, feePaise: 10000, waive: false })).toMatchObject({ feePaise: 5000, refundPaise: 0 });
  });
  it("unpaid: the fee is recorded as due, nothing to refund", () => {
    expect(planRefund({ paidPaise: 0, feePaise: 10000, waive: false })).toMatchObject({ feePaise: 10000, refundPaise: 0, feeStatus: "due" });
  });
  it("waived: full refund, no fee", () => {
    expect(planRefund({ paidPaise: 100000, feePaise: 10000, waive: true })).toMatchObject({ feePaise: 0, refundPaise: 100000, feeStatus: "waived" });
  });
  it("no fee in policy: nothing withheld, status none", () => {
    expect(planRefund({ paidPaise: 100000, feePaise: 0, waive: false })).toMatchObject({ feePaise: 0, refundPaise: 100000, feeStatus: "none" });
  });
  it("refund never exceeds paid or goes below 0", () => {
    for (const paid of [0, 1, 99, 10000, 123456]) for (const fee of [0, 1, 10000, 999999]) for (const waive of [true, false]) {
      const p = planRefund({ paidPaise: paid, feePaise: fee, waive });
      expect(p.refundPaise).toBeGreaterThanOrEqual(0);
      expect(p.refundPaise).toBeLessThanOrEqual(paid);
      if (paid > 0) expect(p.refundPaise + p.feePaise).toBe(paid);
    }
  });
});

describe("policy rules", () => {
  const at = Date.parse("2026-10-20T10:00:00Z");
  it("multi-service visit uses the biggest service band", () => {
    const small = cancellationTerms({ categories: ["washing"], totalPaise: 100000, scheduledAtMs: at, nowMs: at - 10 * H });
    expect(small.feePaise).toBe(0);
    const mixed = cancellationTerms({ categories: ["washing", "ppf"], totalPaise: 100000, scheduledAtMs: at, nowMs: at - 10 * H });
    expect(mixed.feePaise).toBe(20000);
  });
  it("pickup tier uses the raw distance: 2.96 km is Rs 100 and shows 2.9 km, 3.0 km is Rs 150", () => {
    const z = (km: number) => pickupZone({ lat: STUDIO_COORDS.lat + km / 111.19, lng: STUDIO_COORDS.lng });
    expect(z(2.96).feePerLegPaise).toBe(10000);
    expect(z(2.96).km).toBeLessThan(3);
    expect(z(3.02).feePerLegPaise).toBe(15000);
    expect(pickupFeePaise(z(2.96).km, "both")).toBe(20000);
  });
});

describe("restores on cancel", () => {
  const booking = { tenantId: "t", studioId: "s", membershipId: "m1", membershipWashUsed: true, giftId: "g1" } as never;
  const user = { uid: "u", claims: { role: "admin", tenantId: "t" } } as never;
  async function run(seed: Record<string, Record<string, Record<string, unknown>>>) {
    const { db, data } = fakeFirestore(seed);
    await db.runTransaction(async (tx: never) => {
      const reads = await readCancelReads(tx, db, booking, "b1");
      writeCancelRestores(tx, reads, booking, "b1", user, "2026-10-18T00:00:00Z", "test", false);
    });
    return data;
  }
  it("gives back the wash, the member pickup, the gift, and closes the pickup request", async () => {
    const d = await run({
      memberships: { m1: { washesUsed: 2, pickupsUsed: 1 }, m2: { pickupsUsed: 3 } },
      gifts: { g1: { status: "REDEEMED", bookingId: "b1", redeemedBy: "c" } },
      pickupRequests: { b1: { status: "CONFIRMED", memberMembershipId: "m1" } },
    });
    expect(d["memberships"]!["m1"]).toMatchObject({ washesUsed: 1, pickupsUsed: 0 });
    expect(d["gifts"]!["g1"]).toMatchObject({ status: "ACTIVE", bookingId: null, redeemedBy: null });
    expect(d["pickupRequests"]!["b1"]).toMatchObject({ status: "DECLINED", memberMembershipId: null });
  });
  it("returns the pickup credit to the membership that paid for it, even if it is not the booking's", async () => {
    const d = await run({
      memberships: { m1: { washesUsed: 1, pickupsUsed: 0 }, m2: { pickupsUsed: 3 } },
      pickupRequests: { b1: { status: "REQUESTED", memberMembershipId: "m2" } },
    });
    expect(d["memberships"]!["m2"]).toMatchObject({ pickupsUsed: 2 });
    expect(d["memberships"]!["m1"]).toMatchObject({ washesUsed: 0 });
  });
  it("does not touch a gift redeemed by another booking, or a finished pickup", async () => {
    const d = await run({
      memberships: { m1: { washesUsed: 1 } },
      gifts: { g1: { status: "REDEEMED", bookingId: "other" } },
      pickupRequests: { b1: { status: "DONE", memberMembershipId: "m1" } },
    });
    expect(d["gifts"]!["g1"]).toMatchObject({ status: "REDEEMED", bookingId: "other" });
    expect(d["pickupRequests"]!["b1"]).toMatchObject({ status: "DONE" });
    expect((d["memberships"]!["m1"] as { pickupsUsed?: number }).pickupsUsed).toBeUndefined();
  });
});

describe("guards on the server code", () => {
  it("cancelBooking re-reads the booking inside the transaction, is admin-only for staff, and restores through the shared helper", () => {
    const s = src("functions/booking/cancelBooking.ts");
    expect(s).toContain("await tx.get(bookingRef)");
    expect(s).toContain("writeCancelRestores(");
    expect(s).not.toContain('user.claims.role === "studio" ||');
  });
  it("adminCancelBooking is admin-only, App Check enforced, previews, and routes provider refunds through the outbox only", () => {
    const s = src("functions/booking/adminCancelBooking.ts");
    expect(s).toContain('assertRole(user, "admin", "superadmin")');
    expect(s).toContain("enforceAppCheck: shouldEnforceAppCheck()");
    expect(s).toContain("data.preview");
    // Single refund authority: provider refunds are RESERVED in the outbox
    // INSIDE the cancellation transaction (no standalone runnable
    // reservation); this callable never calls the provider, never releases a
    // claim on an unknown outcome, and holds malformed provider payments.
    // Production activation: no environment gate remains in this callable.
    expect(s).toContain("planReserveInTx(tx, db, {");
    expect(s).toContain("applyReserveInTx(tx, reservePlan)");
    expect(s).toContain("amountPaise: txPlan.refundPaise");
    expect(s).not.toContain(".initiateRefund(");
    expect(s).not.toContain("isProductionProject()");
    expect(s).toContain("The booking is NOT cancelled");
    expect(s).toContain("missing its provider payment id");
  });
  it("the close-time auto-cancel records the fee and restores through the shared helper", () => {
    const s = src("lib/missed-bookings.ts");
    expect(s).toContain("writeCancelRestores(");
    expect(s).toContain("cancellationFeeStatus");
  });
  it("reschedule holds the bay for the whole visit, not the primary service only", () => {
    const s = src("functions/booking/rescheduleBooking.ts");
    expect(s).toContain("booking.durationMinutes");
    expect(s).not.toContain("serviceDurationMinutes: service.estimatedDurationMinutes");
  });
  it("a quote keeps pickup fees and refuses when money or an invoice exists", () => {
    const s = src("functions/booking/setBookingQuote.ts");
    expect(s).toContain("applyPickupFees(");
    expect(s).toContain("A payment or invoice already exists");
  });
  it("pickup requests: closed bookings refused, one-way state graph, admin-only fee override for no-pin requests", () => {
    const s = src("functions/booking/pickupRequests.ts");
    expect(s).toContain("This booking is closed");
    expect(s).toContain('DONE: [], DECLINED: []');
    expect(s).toContain("Only an admin can set the pickup fee.");
  });
  it("createBooking saves the visit's service categories for the cancel band", () => {
    expect(src("functions/booking/createBooking.ts")).toContain("cancelCategories: cancelCategories");
  });
});

describe("every bookable bay type has a bay in the studio seed", () => {
  it("wash, protection and general are all seeded, so no service shows Fully booked for lack of a bay", () => {
    const seed = src("scripts/seed-studio.ts");
    const menu = readFileSync(`${__dirname}/../../../../packages/core/src/menu.ts`, "utf8");
    for (const t of ["wash", "protection", "general"]) {
      if (menu.includes(`bay: "${t}"`)) expect(seed, t).toContain(`bayType: "${t}"`);
    }
  });
});

describe("studio layout: 6 bays as lanes (owner 18 Oct 6:25)", () => {
  it("seed has 2 wash, 2 protection, 2 general bays", () => {
    const seed = src("scripts/seed-studio.ts");
    const n = (t: string) => (seed.match(new RegExp(`bayType: "${t}"`, "g")) ?? []).length;
    expect([n("wash"), n("protection"), n("general")]).toEqual([2, 2, 2]);
  });
});

import { extrasProblem } from "../../lib/booking-lines.js";
describe("server refuses a bundle together with what it includes", () => {
  const svc = (id: string, name: string) => ({ id, name, active: true, requiredBayType: "wash", priceOnRequest: false }) as never;
  const foam = svc("menu-wash-foam", "Foam wash"), ext = svc("menu-wash-exterior", "Exterior detail wash"), int = svc("menu-wash-interior", "Interior deep clean"), full = svc("menu-wash-full", "Full detail wash");
  it("rejects Full with Exterior or Interior, either as main or as extra", () => {
    expect(extrasProblem(foam, [ext, full], { gift: false })).toContain("already includes");
    expect(extrasProblem(full, [ext], { gift: false })).toContain("Full detail wash already includes Exterior detail wash");
    expect(extrasProblem(ext, [full], { gift: false })).toContain("already includes");
  });
  it("owner 18 Oct 6:26 PM: Foam cannot go with Exterior or Full, either order", () => {
    expect(extrasProblem(foam, [ext], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(ext, [foam], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(foam, [full], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(foam, [int], { gift: false })).toBeNull();
  });
  it("two ceramic coatings and two PPF tiers or brands are refused; a coating with its add-on is fine", () => {
    const p = (id: string) => ({ id, name: id, active: true, requiredBayType: "protection", priceOnRequest: false }) as never;
    expect(extrasProblem(p("menu-coat-autodeck-1"), [p("menu-coat-autodeck-2")], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(p("menu-coat-fireball-1"), [p("menu-coat-3m-ceramic")], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(p("menu-ppf-xpel-full-front"), [p("menu-ppf-xpel-full-body")], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(p("menu-ppf-xpel-full-front"), [p("menu-ppf-3m-full-front")], { gift: false })).toContain("cannot be booked together");
    expect(extrasProblem(p("menu-coat-fireball-1"), [p("menu-coat-glass")], { gift: false })).toBeNull();
  });
});

describe("server points Exterior + Interior at the Full detail wash", () => {
  const s = (id: string, name: string) => ({ id, name, active: true, requiredBayType: "wash", priceOnRequest: false }) as never;
  it("rejects with an upgrade message, not a silent change", () => {
    const msg = extrasProblem(s("menu-wash-exterior", "Exterior detail wash"), [s("menu-wash-interior", "Interior deep clean")], { gift: false });
    expect(msg).toContain("together is the Full detail wash");
  });
});
