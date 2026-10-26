import type { getStorage } from "firebase-admin/storage";
/**
 * Round 7 photo handling against the REAL local Firestore + Storage emulators (success path). Failure paths are unit-tested with mocks.
 * Proves objects are actually removed from Storage, only the intended one, and records match. Fixtures only, emulator only.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { deleteApp, getApp, initializeApp } from "firebase-admin/app";

const TENANT = "storage-tenant";
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const auth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
let db: FirebaseFirestore.Firestore;
let bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>;
let fns: { deleteMyPaper: any; updateMyPaper: any; removeMyVehicleImage: any; removeMyListingPhoto: any; replaceMyListingPhoto: any };
const put = (p: string) => bucket.file(p).save(Buffer.from("x"), { contentType: "image/jpeg" });
const has = async (p: string) => (await bucket.file(p).exists())[0];

beforeAll(async () => {
  await deleteApp(getApp());
  initializeApp({ projectId: "autodeck-dev", storageBucket: "autodeck-dev.appspot.com" });
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  db = getFirestore(); bucket = getStorage().bucket();
  const papers = await import("../../functions/papers/myPaperEdits.js");
  const veh = await import("../../functions/vehicle/removeMyVehicleImage.js");
  const sale = await import("../../functions/carsale/carsale.js");
  fns = { deleteMyPaper: papers.deleteMyPaper, updateMyPaper: papers.updateMyPaper, removeMyVehicleImage: veh.removeMyVehicleImage, removeMyListingPhoto: sale.removeMyListingPhoto, replaceMyListingPhoto: sale.replaceMyListingPhoto };
});

describe("Storage success path (emulator)", () => {
  it("deleteMyPaper removes that paper's photo only", async () => {
    const me = uid("c"); const v = uid("v"); const pid = uid("p"); const other = uid("p");
    await db.collection("vehicles").doc(v).set({ id: v, ownerId: me, tenantId: TENANT });
    const mine = `${TENANT}/vehicles/${v}/paper-${pid}.jpg`; const keep = `${TENANT}/vehicles/${v}/paper-${other}.jpg`;
    await put(mine); await put(keep);
    await db.collection("papers").doc(pid).set({ id: pid, tenantId: TENANT, studioId: "s", vehicleId: v, customerId: me, kind: "INSURANCE", reference: "R-" + pid, status: "VERIFIED", evidencePath: mine });
    await fns.deleteMyPaper.run({ data: { paperId: pid }, auth: auth(me) });
    expect(await has(mine)).toBe(false);
    expect(await has(keep)).toBe(true);
    expect((await db.collection("papers").doc(pid).get()).exists).toBe(false);
  });

  it("updateMyPaper with another file type removes the old own photo object", async () => {
    const me = uid("c"); const v = uid("v"); const pid = uid("p");
    await db.collection("vehicles").doc(v).set({ id: v, ownerId: me, tenantId: TENANT });
    const old = `${TENANT}/vehicles/${v}/paper-${pid}.jpg`;
    await put(old);
    await db.collection("papers").doc(pid).set({ id: pid, tenantId: TENANT, studioId: "s", vehicleId: v, customerId: me, kind: "INSURANCE", reference: "R-" + pid, status: "VERIFIED", evidencePath: old });
    // The emulator has no credentials to mint the upload URL (getSignedUrl), which happens AFTER the record update and old-object cleanup,
    // so that final step may throw here. Signed-URL minting is therefore NOT covered by this test.
    await fns.updateMyPaper.run({ data: { paperId: pid, contentType: "image/png" }, auth: auth(me) }).catch((e: Error) => { if (!/credentials/i.test(e.message)) throw e; });
    expect(await has(old)).toBe(false);
    expect((await db.collection("papers").doc(pid).get()).data()?.evidencePath).toBe(`${TENANT}/vehicles/${v}/paper-${pid}.png`);
  });

  it("removeMyVehicleImage removes the cover object and clears only that field", async () => {
    const me = uid("c"); const v = uid("v");
    const cover = `${TENANT}/vehicles/${v}/cover.jpg`; const rc = `${TENANT}/vehicles/${v}/rc.jpg`;
    await put(cover); await put(rc);
    await db.collection("vehicles").doc(v).set({ id: v, ownerId: me, tenantId: TENANT, photoUrl: cover, rcPhotoUrl: rc });
    await fns.removeMyVehicleImage.run({ data: { vehicleId: v, kind: "cover" }, auth: auth(me) });
    expect(await has(cover)).toBe(false); expect(await has(rc)).toBe(true);
    expect((await db.collection("vehicles").doc(v).get()).data()).toMatchObject({ photoUrl: null, rcPhotoUrl: rc });
  });

  it("listing photo remove and replace act on the chosen photo only; others keep their objects", async () => {
    const me = uid("c"); const lid = uid("L");
    const a = `${TENANT}/listings/${lid}-a.jpg`, b = `${TENANT}/listings/${lid}-b.jpg`, c = `${TENANT}/listings/${lid}-c.jpg`, nw = `${TENANT}/listings/${lid}-new.png`;
    await Promise.all([put(a), put(b), put(c), put(nw)]);
    await db.collection("carListings").doc(lid).set({ id: lid, sellerId: me, tenantId: TENANT, studioId: "s", status: "live", photoPaths: [a, b, c] });
    await fns.replaceMyListingPhoto.run({ data: { listingId: lid, index: 1, expectedCount: 3, newPath: nw }, auth: auth(me) });
    expect((await db.collection("carListings").doc(lid).get()).data()?.photoPaths).toEqual([a, nw, c]);
    expect(await has(b)).toBe(false); expect(await has(a)).toBe(true); expect(await has(nw)).toBe(true);
    await fns.removeMyListingPhoto.run({ data: { listingId: lid, index: 0, expectedCount: 3 }, auth: auth(me) });
    expect((await db.collection("carListings").doc(lid).get()).data()?.photoPaths).toEqual([nw, c]);
    expect(await has(a)).toBe(false); expect(await has(c)).toBe(true);
  });
});
