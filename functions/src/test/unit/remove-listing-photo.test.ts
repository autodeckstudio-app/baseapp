/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), gone: [] as string[], fail: false, audit: [] as any[] }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_t: any, p: any) => h.audit.push(p) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: (p: string) => ({ delete: async () => { if (h.fail) throw new Error("down"); h.gone.push(p); } }) }) }) }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string) => ({ path, get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }) });
  return { getFirestore: () => ({ collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }), runTransaction: async (fn: any) => fn({ get: async (r: any) => r.get(), update: (r: any, d: any) => h.rows.set(r.path, { ...h.rows.get(r.path), ...d }) }) }) };
});
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { carListings: () => "carListings" } }));
import { removeMyListingPhoto } from "../../functions/carsale/carsale.js";
const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
beforeEach(() => {
  h.rows.clear(); h.gone.length = 0; h.fail = false; h.audit.length = 0;
  h.rows.set("carListings/L1", { id: "L1", sellerId: "me", tenantId: "t", studioId: "s", status: "live", photoPaths: ["t/listings/a.jpg", "t/listings/b.jpg", "t/listings/c.jpg"] });
  h.rows.set("carListings/L2", { id: "L2", sellerId: "other", tenantId: "t", studioId: "s", status: "live", photoPaths: ["t/listings/x.jpg", "t/listings/y.jpg"] });
});
describe("removeMyListingPhoto (round7 p7, sell-car images)", () => {
  it("removes exactly the chosen photo and its object; listing and other photos stay", async () => {
    await removeMyListingPhoto.run(req("me", { listingId: "L1", index: 1, expectedCount: 3 }));
    expect(h.rows.get("carListings/L1").photoPaths).toEqual(["t/listings/a.jpg", "t/listings/c.jpg"]);
    expect(h.gone).toEqual(["t/listings/b.jpg"]);
    expect(h.rows.get("carListings/L1").status).toBe("live");
    expect(h.audit[0].action).toBe("carListing.photoRemoved");
  });
  it("refuses someone else's listing and touches nothing", async () => {
    await expect(removeMyListingPhoto.run(req("me", { listingId: "L2", index: 0, expectedCount: 2 }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.gone).toHaveLength(0);
    expect(h.rows.get("carListings/L2").photoPaths).toHaveLength(2);
  });
  it("a Storage failure leaves the listing untouched and a retry succeeds", async () => {
    h.fail = true;
    await expect(removeMyListingPhoto.run(req("me", { listingId: "L1", index: 0, expectedCount: 3 }))).rejects.toMatchObject({ code: "unavailable" });
    expect(h.rows.get("carListings/L1").photoPaths).toHaveLength(3);
    h.fail = false;
    await removeMyListingPhoto.run(req("me", { listingId: "L1", index: 0, expectedCount: 3 }));
    expect(h.rows.get("carListings/L1").photoPaths).toEqual(["t/listings/b.jpg", "t/listings/c.jpg"]);
  });
  it("a stale view (count changed) is refused; the last photo cannot be removed; sold listings are closed", async () => {
    await expect(removeMyListingPhoto.run(req("me", { listingId: "L1", index: 0, expectedCount: 2 }))).rejects.toMatchObject({ code: "aborted" });
    h.rows.set("carListings/L1", { ...h.rows.get("carListings/L1"), photoPaths: ["t/listings/a.jpg"] });
    await expect(removeMyListingPhoto.run(req("me", { listingId: "L1", index: 0, expectedCount: 1 }))).rejects.toMatchObject({ code: "failed-precondition" });
    h.rows.set("carListings/L1", { ...h.rows.get("carListings/L1"), photoPaths: ["t/listings/a.jpg", "t/listings/b.jpg"], status: "sold" });
    await expect(removeMyListingPhoto.run(req("me", { listingId: "L1", index: 0, expectedCount: 2 }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.gone).toHaveLength(0);
  });
  it("never deletes an object outside the tenant's listings folder", async () => {
    h.rows.set("carListings/L1", { ...h.rows.get("carListings/L1"), photoPaths: ["other/vehicles/v/cover.jpg", "t/listings/b.jpg"] });
    await expect(removeMyListingPhoto.run(req("me", { listingId: "L1", index: 0, expectedCount: 2 }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(h.gone).toHaveLength(0);
  });
});
