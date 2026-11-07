import { beforeEach, describe, expect, it, vi } from "vitest";

// Claimed-customer identity split: the customer DOCUMENT id (cust-staged)
// differs from the Auth uid (auth-1). Every changed writer must stamp and
// guard on the resolved doc id, never the uid. The REAL resolver runs here
// against a fake store holding only the claimed doc.
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), seq: 0 }));

vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: () => {} }));
vi.mock("../../lib/road-distance.js", () => ({ roadMetersBetween: async () => 12000, GOOGLE_ROUTES_API_KEY: { value: () => "k" } }));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({
    id: path.split("/").pop()!,
    path,
    get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }),
    set: async (d: any) => { h.rows.set(path, d); },
    update: async (d: any) => { h.rows.set(path, { ...h.rows.get(path), ...d }); },
  });
  const query = (col: string, filters: Array<[string, unknown]>, lim: number) => ({
    where: (f: string, _o: string, v: unknown) => query(col, [...filters, [f, v]], lim),
    limit: (n: number) => query(col, filters, n),
    get: async () => ({
      docs: [...h.rows.entries()]
        .filter(([k, r]) => k.startsWith(col + "/") && filters.every(([f, v]) => r[f] === v))
        .slice(0, lim || 25)
        .map(([k, r]) => ({ id: k.split("/").pop()!, data: () => r })),
    }),
  });
  return {
    getFirestore: () => ({
      collection: (c: string) => ({
        doc: (id?: string) => docRef(`${c}/${id ?? `auto-${++h.seq}`}`),
        where: (f: string, o: string, v: unknown) => query(c, [[f, v]], 0),
      }),
      runTransaction: async (fn: any) => fn({
        get: async (r: any) => r.get(),
        set: (r: any, d: any) => { h.rows.set(r.path, d); },
        update: (r: any, d: any) => { h.rows.set(r.path, { ...h.rows.get(r.path), ...d }); },
      }),
    }),
  };
});

import { getPickupQuote } from "../../functions/booking/pickupQuote.js";
import { submitReview } from "../../functions/booking/submitReview.js";
import { requestPickupDrop } from "../../functions/booking/pickupRequests.js";

const UID = "auth-1";
const DOC = "cust-staged"; // claimed walk-in: doc id != auth uid
const req = (data: any): any => ({ data, auth: { uid: UID, token: { role: "customer", tenantId: "t" } } });
const future = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

beforeEach(() => {
  h.rows.clear(); h.seq = 0;
  h.rows.set(`customers/${DOC}`, { authUid: UID, tenantId: "t", deletedAt: null });
  h.rows.set("bookings/b1", { id: "b1", tenantId: "t", customerId: DOC, serviceId: "s1", studioId: "st1", status: "COMPLETED" });
  h.rows.set("pickupQuotes/q1", { id: "q1", tenantId: "t", customerId: DOC, kind: "pickup", lat: 23.0, lng: 72.5, roadMeters: 12000, feePaise: 50000, createdAt: new Date().toISOString(), expiresAt: future(), consumedAt: null });
});

describe("claimed customer (doc id != auth uid): writers stamp and guard the canonical doc id", () => {
  it("getPickupQuote stores the quote under the resolved customer doc id", async () => {
    const out = await (getPickupQuote as any).run(req({ kind: "pickup", lat: 23.0, lng: 72.5 }));
    const written = h.rows.get(`pickupQuotes/${out.quoteId}`);
    expect(written?.customerId).toBe(DOC);
  });

  it("submitReview accepts the claimed owner's booking and stamps the doc id", async () => {
    const out = await (submitReview as any).run(req({ bookingId: "b1", rating: 5, comment: "Great" }));
    expect(out).toEqual({ ok: true });
    expect(h.rows.get("reviews/b1")?.customerId).toBe(DOC);
  });

  it("submitReview refuses a booking owned by someone else", async () => {
    h.rows.set("bookings/b2", { id: "b2", tenantId: "t", customerId: "other", serviceId: "s1", status: "COMPLETED" });
    await expect((submitReview as any).run(req({ bookingId: "b2", rating: 1 }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.rows.has("reviews/b2")).toBe(false);
  });

  it("submitReview refuses a booking in another tenant and a missing booking", async () => {
    h.rows.set("bookings/b3", { id: "b3", tenantId: "other-tenant", customerId: DOC, serviceId: "s1", status: "COMPLETED" });
    await expect((submitReview as any).run(req({ bookingId: "b3", rating: 1 }))).rejects.toBeDefined();
    await expect((submitReview as any).run(req({ bookingId: "nope", rating: 1 }))).rejects.toMatchObject({ code: "not-found" });
  });

  it("requestPickupDrop consumes the owner's quote and stamps the doc id", async () => {
    h.rows.set("bookings/b5", { id: "b5", tenantId: "t", customerId: DOC, serviceId: "s1", studioId: "st1", status: "CONFIRMED" });
    const out = await (requestPickupDrop as any).run(req({ bookingId: "b5", kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: "q1" }));
    expect(out.request.customerId).toBe(DOC);
    expect(h.rows.get("pickupRequests/b5")?.customerId).toBe(DOC);
    expect(h.rows.get("pickupQuotes/q1")?.consumedAt).toBeTruthy();
  });

  it("requestPickupDrop refuses someone else's quote and someone else's booking", async () => {
    h.rows.set("pickupQuotes/q2", { ...h.rows.get("pickupQuotes/q1"), id: "q2", customerId: "other" });
    await expect((requestPickupDrop as any).run(req({ bookingId: "b1", kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: "q2" }))).rejects.toMatchObject({ code: "permission-denied" });
    h.rows.set("bookings/b4", { id: "b4", tenantId: "t", customerId: "other", serviceId: "s1", studioId: "st1", status: "CONFIRMED" });
    await expect((requestPickupDrop as any).run(req({ bookingId: "b4", kind: "pickup", address: "12 Ring Road, Ahmedabad", quoteId: "q1" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.rows.get("pickupQuotes/q1")?.consumedAt).toBeNull();
  });
});
