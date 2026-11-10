import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Backward-compatible ownership across the customer-identity migration.
// Legacy carListings/carLeads rows key the customer by AUTH UID; current rows
// key by the resolved customer DOCUMENT id. A claimed staged customer
// (doc id != auth uid) must still own their legacy rows, a different customer
// must never gain access by either id, and an office transfer (sellerId
// reassigned to another doc) must cut the old owner off. The REAL resolver
// runs against the fake store.
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), seq: 0 }));

vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: () => {} }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (_p: string) => ({
        getSignedUrl: async () => ["https://signed.example/read"],
        exists: async () => [true],
        getMetadata: async () => { throw new Error("not found"); },
        delete: async () => {},
      }),
    }),
  }),
}));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({
    id: path.split("/").pop()!,
    path,
    get: async () => ({ id: path.split("/").pop()!, exists: h.rows.has(path), data: () => h.rows.get(path) }),
    set: async (d: any) => { h.rows.set(path, d); },
    update: async (d: any) => { h.rows.set(path, { ...h.rows.get(path), ...d }) },
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
        create: (r: any, d: any) => { if (h.rows.has(r.path)) throw new Error("exists"); h.rows.set(r.path, d); },
        update: (r: any, d: any) => { h.rows.set(r.path, { ...h.rows.get(r.path), ...d }) },
      }),
    }),
  };
});

import {
  expressInterest,
  getMyListingSubmission,
  listCarListings,
  markMyListingSold,
  removeMyListingPhoto,
  replaceMyListingPhoto,
  submitMyListing,
} from "../../functions/carsale/carsale.js";

const UID = "auth-1"; // caller's verified auth uid
const DOC = "cust-staged"; // claimed staged customer: doc id != auth uid
const OTHER_UID = "auth-9";
const OTHER_DOC = "cust-other";
const req = (data: any, uid = UID): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
const now = () => new Date().toISOString();

const listing = (id: string, sellerId: string | null, status = "live") => ({
  id, tenantId: "t", studioId: "st1", source: "customer", sellerId, status,
  make: "Maruti", model: "Swift", variant: null, year: 2019, kmDriven: 45000, fuel: "petrol", gearbox: "manual",
  bodyType: null, owners: 1, colour: "White", area: "Satellite", askingPrice: 450000, description: "Clean car",
  insuranceValidTill: null, photoPaths: ["t/listings/a.jpg", "t/listings/b.jpg"],
  sellerName: "Seller", sellerPhone: "9876543210", registrationNumber: null,
  reservePrice: null, adminNotes: null, rejectionReason: null,
  createdAt: now(), updatedAt: now(), approvedAt: now(), expiresAt: null,
});
const editPayload = (listingId: string) => ({
  listingId, make: "Maruti", model: "Swift", year: 2019, kmDriven: 46000, fuel: "petrol", gearbox: "manual",
  owners: 1, colour: "White", area: "Satellite", askingPrice: 440000,
  sellerName: "Seller", sellerPhone: "9876543210", photoPaths: ["t/listings/a.jpg", "t/listings/b.jpg"],
});

beforeEach(() => {
  h.rows.clear(); h.seq = 0;
  h.rows.set(`customers/${DOC}`, { authUid: UID, tenantId: "t", deletedAt: null, name: "Staged Seller" });
  h.rows.set(`customers/${OTHER_DOC}`, { authUid: OTHER_UID, tenantId: "t", deletedAt: null, name: "Other" });
  h.rows.set("carListings/L1", listing("L1", UID)); // legacy row keyed by the caller's auth uid
  h.rows.set("carListings/L2", listing("L2", DOC, "pending")); // current row keyed by the caller's doc id
  h.rows.set("carListings/L3", listing("L3", OTHER_UID)); // someone else's legacy row
  h.rows.set("carListings/L4", listing("L4", OTHER_UID)); // someone else's row, never asked about
  h.rows.set("carLeads/lead1", { id: "lead1", tenantId: "t", listingId: "L3", kind: "interest", buyerId: UID, buyerName: "Staged Seller", buyerPhone: null, note: null, status: "new", createdAt: now(), updatedAt: now() });
});

describe("carsale legacy ownership (staged customer, doc id != auth uid)", () => {
  it("edits a legacy auth-uid-keyed listing and re-stamps the canonical doc id", async () => {
    const out = await (submitMyListing as any).run(req(editPayload("L1")));
    expect(out.id).toBe("L1");
    expect(h.rows.get("carListings/L1")?.sellerId).toBe(DOC);
    expect(h.rows.get("carListings/L1")?.status).toBe("pending");
  });

  it("still edits a current doc-id-keyed listing", async () => {
    const out = await (submitMyListing as any).run(req(editPayload("L2")));
    expect(out.id).toBe("L2");
    expect(h.rows.get("carListings/L2")?.sellerId).toBe(DOC);
  });

  it("refuses to edit another customer's legacy listing", async () => {
    await expect((submitMyListing as any).run(req(editPayload("L3")))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("marks a legacy listing sold, and refuses another customer's", async () => {
    await (markMyListingSold as any).run(req({ listingId: "L1" }));
    expect(h.rows.get("carListings/L1")?.status).toBe("sold");
    await expect((markMyListingSold as any).run(req({ listingId: "L3" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("removes and replaces photos on a legacy listing, and refuses another customer's", async () => {
    await (removeMyListingPhoto as any).run(req({ listingId: "L1", index: 0, expectedCount: 2 }));
    expect(h.rows.get("carListings/L1")?.photoPaths).toEqual(["t/listings/b.jpg"]);
    const out = await (replaceMyListingPhoto as any).run(req({ listingId: "L1", index: 0, expectedCount: 1, newPath: "t/listings/c.jpg" }));
    expect(out.oldRemoved).toBe(true);
    expect(h.rows.get("carListings/L1")?.photoPaths).toEqual(["t/listings/c.jpg"]);
    await expect((removeMyListingPhoto as any).run(req({ listingId: "L3", index: 0, expectedCount: 2 }))).rejects.toMatchObject({ code: "permission-denied" });
    await expect((replaceMyListingPhoto as any).run(req({ listingId: "L3", index: 0, expectedCount: 2, newPath: "t/listings/d.jpg" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("treats a legacy listing as the seller's own for interest, and stamps new leads with the doc id", async () => {
    await expect((expressInterest as any).run(req({ listingId: "L1", kind: "interest", phone: "9876543210" }))).rejects.toMatchObject({ code: "failed-precondition" });
    const out = await (expressInterest as any).run(req({ listingId: "L4", kind: "interest", phone: "9876543210" }));
    expect(h.rows.get(`carLeads/${out.id}`)?.buyerId).toBe(DOC);
  });

  it("mine=true returns both legacy and current rows and never another customer's", async () => {
    const out = await (listCarListings as any).run(req({ mine: true }));
    const ids = out.listings.map((l: any) => l.id).sort();
    expect(ids).toEqual(["L1", "L2"]);
    expect(out.listings.every((l: any) => l.mine)).toBe(true);
  });

  it("price gating honours a legacy auth-uid-keyed interest lead and hides unasked prices", async () => {
    const out = await (listCarListings as any).run(req({}));
    const l3 = out.listings.find((l: any) => l.id === "L3");
    const l4 = out.listings.find((l: any) => l.id === "L4");
    expect(l3.askingPrice).toBe(450000); // asked under the pre-migration buyer key
    expect(l4.askingPrice).toBe(0);
    expect(l4.priceHidden).toBe(true);
  });

  it("an office transfer of a legacy uid-keyed record cuts the old owner off and moves it to the new auth", async () => {
    h.rows.set("carListings/L1", { ...listing("L1", OTHER_DOC) }); // office reassigned the legacy record to another customer doc
    // Old owner is still a valid customer (resolver intact) and still owns their other records...
    const stillMine = await (listCarListings as any).run(req({ mine: true }));
    expect(stillMine.listings.map((l: any) => l.id)).toEqual(["L2"]);
    // ...but can no longer write the transferred record under either id.
    await expect((submitMyListing as any).run(req(editPayload("L1")))).rejects.toMatchObject({ code: "permission-denied" });
    await expect((markMyListingSold as any).run(req({ listingId: "L1" }))).rejects.toMatchObject({ code: "permission-denied" });
    // The new owner is a different auth mapped to a different doc, and the record follows them.
    const newOwnerMine = await (listCarListings as any).run(req({ mine: true }, OTHER_UID));
    expect(newOwnerMine.listings.map((l: any) => l.id)).toEqual(["L1", "L3", "L4"]); // L1 transfer plus their own legacy rows
    await (markMyListingSold as any).run(req({ listingId: "L1" }, OTHER_UID));
    expect(h.rows.get("carListings/L1")?.status).toBe("sold");
  });

  it("a keyed submission readback accepts the legacy seller key", async () => {
    const op = "op-legacy-submit-1";
    const key = createHash("sha256").update(JSON.stringify(["t", DOC, op])).digest("hex");
    h.rows.set(`carListingSubmissions/${key}`, { tenantId: "t", customerId: DOC, listingId: "L1", payloadHash: "x", createdAt: now() });
    const out = await (getMyListingSubmission as any).run(req({ operationId: op }));
    expect(out).toEqual({ status: "committed", id: "L1", listingStatus: "live" });
  });
});
