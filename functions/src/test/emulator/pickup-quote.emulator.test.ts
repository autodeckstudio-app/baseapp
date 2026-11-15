/**
 * Emulator integration tests for the road-distance pickup quote flow:
 * getPickupQuote measures each selected leg in the direction actually driven, stores the quote, and
 * requestPickupDrop charges exactly the stored fee - never a recompute, never an estimate. Stale pre-quote
 * clients (bare lat/lng, no quoteId) are rejected with a refresh/re-check instruction, never silently priced.
 * The Google Routes call is stubbed (vi.stubGlobal fetch); no network.
 * Run with: pnpm test:emulator (requires Firestore Emulator).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { STUDIO_COORDS } from "@autodeck/core";
import { getPickupQuote } from "../../functions/booking/pickupQuote.js";
import { requestPickupDrop } from "../../functions/booking/pickupRequests.js";
import { utcDayKey, ROUTING_CALL_LIMIT, ROUTING_USAGE_DOC } from "../../lib/road-distance.js";

process.env.GOOGLE_ROUTES_API_KEY = "test-routes-key";

const db = getFirestore();
const TENANT = "quote-tenant";
const STUDIO = "quote-studio";
let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}
const customerAuth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
// A customer spot several road-km from the studio.
const FAR = { lat: 23.15, lng: 72.65 };

type LegStubs = { pinToStudio: number | null; studioToPin: number | null };
/** Direction-aware Routes stub: a number sets both directions; null fails that direction like a network/vendor error. */
function stubRoutes(opts: number | null | Partial<LegStubs>) {
  const cfg: LegStubs =
    opts === null || typeof opts === "number"
      ? { pinToStudio: opts, studioToPin: opts }
      : { pinToStudio: opts.pinToStudio ?? null, studioToPin: opts.studioToPin ?? null };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}") as { origin: { location: { latLng: { latitude: number } } } };
      const fromPin = Math.abs(body.origin.location.latLng.latitude - FAR.lat) < 1e-6;
      const meters = fromPin ? cfg.pinToStudio : cfg.studioToPin;
      if (meters === null) throw new Error("network down");
      return new Response(JSON.stringify({ routes: [{ distanceMeters: meters }] }), { status: 200 });
    }),
  );
}

async function seedBooking(customerId: string): Promise<string> {
  const bookingId = uid("bk");
  await db.collection(COLLECTIONS.bookings()).doc(bookingId).set({
    id: bookingId, tenantId: TENANT, studioId: STUDIO, customerId, status: "CONFIRMED", createdAt: new Date().toISOString(),
  });
  return bookingId;
}

type QuoteResult = { quoteId: string; feePaise: number; legs: { leg: "pickup" | "drop"; km: number; feePaise: number }[] };
async function makeQuote(customerId: string, kind: "pickup" | "drop" | "both", lat = FAR.lat, lng = FAR.lng): Promise<QuoteResult> {
  return (await getPickupQuote.run({ data: { kind, lat, lng }, auth: customerAuth(customerId) } as never)) as QuoteResult;
}
async function usageDays(): Promise<Record<string, number>> {
  const snap = await db.collection(COLLECTIONS.routingUsage()).doc(ROUTING_USAGE_DOC).get();
  return ((snap.data() as { days?: Record<string, number> } | undefined)?.days) ?? {};
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("getPickupQuote", () => {
  it("stores per-leg road quotes and returns the owner-accepted example fee (8 km both = Rs 112)", async () => {
    stubRoutes(8000);
    const customer = uid("cust");
    const q = await makeQuote(customer, "both");
    expect(q.feePaise).toBe(11_200);
    expect(q.legs).toEqual([
      { leg: "pickup", km: 8, feePaise: 5_600 },
      { leg: "drop", km: 8, feePaise: 5_600 },
    ]);
    const doc = (await db.collection(COLLECTIONS.pickupQuotes()).doc(q.quoteId).get()).data() as {
      legs: { leg: string; roadMeters: number }[]; roadMeters: number; consumedAt: string | null;
    };
    expect(doc.legs).toEqual([
      { leg: "pickup", roadMeters: 8000, feePaise:5600 },
      { leg: "drop", roadMeters: 8000, feePaise:5600 },
    ]);
    expect(doc.roadMeters).toBe(16_000);
    expect(doc.consumedAt).toBeNull();
    // Two vendor attempts were reserved (one per leg), before the calls.
    expect((await usageDays())[utcDayKey()]).toBeGreaterThanOrEqual(2);
  });

  it("measures each leg in the direction actually driven - asymmetric routes are priced per leg, not doubled", async () => {
    stubRoutes({ pinToStudio: 8000, studioToPin: 2900 });
    const q = await makeQuote(uid("cust"), "both");
    expect(q.legs).toEqual([
      { leg: "pickup", km: 8, feePaise: 5_600 },
      { leg: "drop", km: 2.9, feePaise: 0 },
    ]);
    expect(q.feePaise).toBe(5_600);
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  });

  it("asks for exactly one route per selected single leg, in that leg's driving direction", async () => {
    stubRoutes({ pinToStudio: 8000, studioToPin: 2900 });
    const p = await makeQuote(uid("cust"), "pickup");
    expect(p.legs).toEqual([{ leg: "pickup", km: 8, feePaise: 5_600 }]);
    expect(p.feePaise).toBe(5_600);
    const d = await makeQuote(uid("cust"), "drop");
    expect(d.legs).toEqual([{ leg: "drop", km: 2.9, feePaise: 0 }]);
    expect(d.feePaise).toBe(0);
  });

  it("inside the free 3 road km the quote is exactly 0", async () => {
    stubRoutes(2900);
    const q = await makeQuote(uid("cust"), "pickup");
    expect(q.feePaise).toBe(0);
  });

  it("routing failure rejects unavailable and stores no quote", async () => {
    stubRoutes(null);
    await expect(makeQuote(uid("cust"), "pickup")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("a failed second leg fails the whole quote honestly (no partial-price quote stored)", async () => {
    stubRoutes({ pinToStudio: 8000, studioToPin: null });
    const customer = uid("cust");
    await expect(makeQuote(customer, "both")).rejects.toMatchObject({ code: "unavailable" });
    // Both attempts still consumed their reserved slots (conservative: attempts count, not just successes).
    expect((await usageDays())[utcDayKey()]).toBeGreaterThanOrEqual(2);
  });

  it("rolling kill-switch rejects before any vendor call", async () => {
    stubRoutes(8000);
    await db.collection(COLLECTIONS.routingUsage()).doc(ROUTING_USAGE_DOC).set({ days: { [utcDayKey()]: ROUTING_CALL_LIMIT } });
    await expect(makeQuote(uid("cust"), "pickup")).rejects.toMatchObject({ code: "unavailable" });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
    await db.collection(COLLECTIONS.routingUsage()).doc(ROUTING_USAGE_DOC).delete();
  });

  it("the rolling window prunes buckets older than 31 days - they no longer count", async () => {
    stubRoutes(8000);
    const old = new Date(Date.now() - 40 * 86_400_000);
    await db.collection(COLLECTIONS.routingUsage()).doc(ROUTING_USAGE_DOC).set({ days: { [utcDayKey(old)]: ROUTING_CALL_LIMIT } });
    const q = await makeQuote(uid("cust"), "pickup");
    expect(q.feePaise).toBe(5_600);
    const days = await usageDays();
    expect(days[utcDayKey(old)]).toBeUndefined();
    expect(days[utcDayKey()]).toBe(1);
    await db.collection(COLLECTIONS.routingUsage()).doc(ROUTING_USAGE_DOC).delete();
  });
});

describe("requestPickupDrop with a quote", () => {
  it("charges exactly the quoted fee, stores road metres and consumes the quote", async () => {
    stubRoutes(8000);
    const customer = uid("cust");
    const q = await makeQuote(customer, "both");
    const bookingId = await seedBooking(customer);
    await requestPickupDrop.run({
      data: { bookingId, kind: "both", address: "12 Ring Road, Ahmedabad", lat: FAR.lat, lng: FAR.lng, quoteId: q.quoteId },
      auth: customerAuth(customer),
    } as never);
    const doc = (await db.collection(COLLECTIONS.pickupRequests()).doc(bookingId).get()).data() as { feePaise: number; roadMeters: number; quoteId: string };
    expect(doc.feePaise).toBe(11_200);
    expect(doc.roadMeters).toBe(16_000);
    expect(doc.quoteId).toBe(q.quoteId);
    const qAfter = (await db.collection(COLLECTIONS.pickupQuotes()).doc(q.quoteId).get()).data() as { consumedAt: string | null };
    expect(qAfter.consumedAt).not.toBeNull();
  });

  it("refuses a second use of the same quote", async () => {
    stubRoutes(8000);
    const customer = uid("cust");
    const q = await makeQuote(customer, "pickup");
    const b1 = await seedBooking(customer);
    await requestPickupDrop.run({ data: { bookingId: b1, kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: q.quoteId }, auth: customerAuth(customer) } as never);
    const b2 = await seedBooking(customer);
    await expect(
      requestPickupDrop.run({ data: { bookingId: b2, kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: q.quoteId }, auth: customerAuth(customer) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("refuses expired, foreign and kind-mismatched quotes", async () => {
    stubRoutes(8000);
    const customer = uid("cust");
    const q = await makeQuote(customer, "pickup");
    // expired
    await db.collection(COLLECTIONS.pickupQuotes()).doc(q.quoteId).update({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const b1 = await seedBooking(customer);
    await expect(
      requestPickupDrop.run({ data: { bookingId: b1, kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: q.quoteId }, auth: customerAuth(customer) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    // foreign customer
    const q2 = await makeQuote(customer, "pickup");
    const b2 = await seedBooking(customer);
    await expect(
      requestPickupDrop.run({ data: { bookingId: b2, kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: q2.quoteId }, auth: customerAuth(uid("intruder")) } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
    // kind mismatch
    const b3 = await seedBooking(customer);
    await expect(
      requestPickupDrop.run({ data: { bookingId: b3, kind: "both", address: "12 Ring Road, Ahmedabad", quoteId: q2.quoteId }, auth: customerAuth(customer) } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("refuses when the pin drifted from the quoted spot", async () => {
    stubRoutes(8000);
    const customer = uid("cust");
    const q = await makeQuote(customer, "pickup");
    const bookingId = await seedBooking(customer);
    await expect(
      requestPickupDrop.run({
        data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad", lat: FAR.lat + 0.05, lng: FAR.lng, quoteId: q.quoteId },
        auth: customerAuth(customer),
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("STALE CLIENT guard: bare lat/lng without a quote is rejected with a refresh/re-check instruction, never silently priced", async () => {
    stubRoutes(8000); // must NOT be called on this path
    const customer = uid("cust");
    const bookingId = await seedBooking(customer);
    await expect(
      requestPickupDrop.run({ data: { bookingId, kind: "pickup", address: "12 Ring Road, Ahmedabad", lat: FAR.lat, lng: FAR.lng }, auth: customerAuth(customer) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("refresh") as unknown as string });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
    // No pickup request doc written either.
    const doc = await db.collection(COLLECTIONS.pickupRequests()).doc(bookingId).get();
    expect(doc.exists).toBe(false);
  });
});
