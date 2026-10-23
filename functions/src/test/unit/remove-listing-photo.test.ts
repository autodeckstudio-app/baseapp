/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), gone: [] as string[], fail: false, audit: [] as any[], uploaded: new Set<string>() }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_t: any, p: any) => h.audit.push(p) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: (p: string) => ({ exists: async () => [h.uploaded.has(p)], delete: async () => { if (h.fail) throw new Error("down"); h.gone.push(p); } }) }) }) }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string) => ({ path, get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }) });
  return { getFirestore: () => ({ collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }), runTransaction: async (fn: any) => fn({ get: async (r: any) => r.get(), update: (r: any, d: any) => h.rows.set(r.path, { ...h.rows.get(r.path), ...d }) }) }) };
});
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { carListings: () => "carListings" } }));
import { removeMyListingPhoto, replaceMyListingPhoto } from "../../functions/carsale/carsale.js";
const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
beforeEach(() => {
  h.rows.clear(); h.uploaded.clear(); h.gone.length = 0; h.fail = false; h.audit.length = 0;
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
describe("replaceMyListingPhoto (round7 p7, replace a saved sell-car photo)", () => {
  const rp = (o: any = {}) => ({ listingId: "L1", index: 1, expectedCount: 3, newPath: "t/listings/new.png", ...o });
  it("swaps the photo at that position, keeps count and other photos, removes the old object", async () => {
    h.uploaded.add("t/listings/new.png");
    const out: any = await replaceMyListingPhoto.run(req("me", rp()));
    expect(h.rows.get("carListings/L1").photoPaths).toEqual(["t/listings/a.jpg", "t/listings/new.png", "t/listings/c.jpg"]);
    expect(h.gone).toEqual(["t/listings/b.jpg"]);
    expect(out.oldRemoved).toBe(true);
  });
  it("refuses another seller's listing, a missing upload, a foreign path and a stale view; nothing changes", async () => {
    await expect(replaceMyListingPhoto.run(req("me", rp({ listingId: "L2", expectedCount: 2 })))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(replaceMyListingPhoto.run(req("me", rp()))).rejects.toMatchObject({ code: "failed-precondition" });
    h.uploaded.add("other/vehicles/v/x.png");
    await expect(replaceMyListingPhoto.run(req("me", rp({ newPath: "other/vehicles/v/x.png" })))).rejects.toMatchObject({ code: "invalid-argument" });
    h.uploaded.add("t/listings/new.png");
    await expect(replaceMyListingPhoto.run(req("me", rp({ expectedCount: 2 })))).rejects.toMatchObject({ code: "aborted" });
    expect(h.rows.get("carListings/L1").photoPaths).toEqual(["t/listings/a.jpg", "t/listings/b.jpg", "t/listings/c.jpg"]);
    expect(h.gone).toHaveLength(0);
  });
  it("an old-object cleanup failure does not undo the swap and is reported as a leftover", async () => {
    h.uploaded.add("t/listings/new.png"); h.fail = true;
    const out: any = await replaceMyListingPhoto.run(req("me", rp()));
    expect(h.rows.get("carListings/L1").photoPaths[1]).toBe("t/listings/new.png");
    expect(out.oldRemoved).toBe(false);
  });
  it("a concurrent edit that changed the same slot is not overwritten", async () => {
    h.uploaded.add("t/listings/new.png");
    const real = h.rows.get("carListings/L1");
    const orig = h.rows.get.bind(h.rows);
    let calls = 0;
    h.rows.get = ((k: string) => { const v = orig(k); if (k === "carListings/L1" && ++calls === 2) return { ...v, photoPaths: ["t/listings/a.jpg", "t/listings/zzz.jpg", "t/listings/c.jpg"] }; return v; }) as any;
    await expect(replaceMyListingPhoto.run(req("me", rp()))).rejects.toMatchObject({ code: "aborted" });
    h.rows.get = orig as any;
    expect(real.photoPaths[1]).toBe("t/listings/b.jpg");
    expect(h.gone).toHaveLength(0);
  });
});
