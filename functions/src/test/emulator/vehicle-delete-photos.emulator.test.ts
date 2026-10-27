/**
 * deleteVehicle photo sweep against the REAL local Firestore + Storage emulators.
 * Proves the cover object is actually removed, RC/papers/other cars/job photos
 * survive, and the tombstone carries durable cleanup truth. Fixtures only,
 * emulator only - no production data.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { deleteApp, getApp, initializeApp } from "firebase-admin/app";
import type { getStorage } from "firebase-admin/storage";

const TENANT = "photo-del-tenant";
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const auth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
let db: FirebaseFirestore.Firestore;
let bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>;
let deleteVehicleFn: { run: (r: unknown) => Promise<unknown> };
const put = (p: string) => bucket.file(p).save(Buffer.from("x"), { contentType: "image/jpeg" });
const has = async (p: string) => (await bucket.file(p).exists())[0];

beforeAll(async () => {
  await deleteApp(getApp());
  initializeApp({ projectId: "autodeck-dev", storageBucket: "autodeck-dev.appspot.com" });
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  db = getFirestore(); bucket = getStorage().bucket();
  ({ deleteVehicle: deleteVehicleFn } = await import("../../functions/vehicle/deleteVehicle.js") as never);
});

describe("deleteVehicle photo sweep (emulator)", () => {
  it("deletes only the cover picture and records durable cleanup truth on the tombstone", async () => {
    const me = uid("c"); const v = uid("v"); const other = uid("v");
    await db.collection("vehicles").doc(v).set({
      id: v, tenantId: TENANT, ownerId: me, registrationNumber: "GJ01XX9999",
      make: "Tata", model: "Nexon", year: 2022, color: "Blue",
      photoUrl: `${TENANT}/vehicles/${v}/cover.1.jpg`, rcPhotoUrl: `${TENANT}/vehicles/${v}/rc.2.jpg`,
    });
    await put(`${TENANT}/vehicles/${v}/cover.1.jpg`);
    await put(`${TENANT}/vehicles/${v}/rc.2.jpg`);
    await put(`${TENANT}/vehicles/${v}/paper-p1.jpg`);
    await put(`${TENANT}/vehicles/${other}/cover.9.jpg`);
    await put(`${TENANT}/jobs/j1/photos/insp.jpg`);

    const result = await deleteVehicleFn.run({ data: { vehicleId: v }, auth: auth(me) }) as {
      deleted: boolean; alreadyDeleted: boolean; photos: { deleted: number; failed: boolean };
    };
    expect(result.deleted).toBe(true);
    expect(result.alreadyDeleted).toBe(false);
    expect(result.photos).toEqual({ deleted: 1, failed: false });

    expect((await db.collection("vehicles").doc(v).get()).exists).toBe(false);
    const tomb = (await db.collection("deletedVehicles").doc(v).get()).data();
    expect(tomb?.photoCleanup?.status).toBe("done");
    expect(tomb?.photoCleanup?.deleted).toBe(1);
    expect(tomb?.snapshot?.registrationNumber).toBe("GJ01XX9999");

    expect(await has(`${TENANT}/vehicles/${v}/cover.1.jpg`)).toBe(false); // picture deleted
    expect(await has(`${TENANT}/vehicles/${v}/rc.2.jpg`)).toBe(true); // RC document kept
    expect(await has(`${TENANT}/vehicles/${v}/paper-p1.jpg`)).toBe(true); // papers kept
    expect(await has(`${TENANT}/vehicles/${other}/cover.9.jpg`)).toBe(true); // other car untouched
    expect(await has(`${TENANT}/jobs/j1/photos/insp.jpg`)).toBe(true); // inspection photo kept

    // Retry (alreadyDeleted path): no-op sweep, tombstone status rewritten, still no failure
    const again = await deleteVehicleFn.run({ data: { vehicleId: v }, auth: auth(me) }) as {
      alreadyDeleted: boolean; photos: { deleted: number; failed: boolean };
    };
    expect(again.alreadyDeleted).toBe(true);
    expect(again.photos.failed).toBe(false);
    expect((await db.collection("deletedVehicles").doc(v).get()).data()?.photoCleanup?.status).toBe("done");
  });

  it("a refused delete (open booking) removes nothing", async () => {
    const me = uid("c"); const v = uid("v");
    await db.collection("vehicles").doc(v).set({
      id: v, tenantId: TENANT, ownerId: me, registrationNumber: "GJ02YY1111",
      make: "Tata", model: "Punch", year: 2023, color: "Red", photoUrl: null,
    });
    await db.collection("bookings").doc(uid("b")).set({
      tenantId: TENANT, customerId: me, vehicleId: v, status: "CONFIRMED",
    });
    await put(`${TENANT}/vehicles/${v}/cover.1.jpg`);
    await expect(deleteVehicleFn.run({ data: { vehicleId: v }, auth: auth(me) })).rejects.toThrow(/upcoming booking/i);
    expect((await db.collection("vehicles").doc(v).get()).exists).toBe(true);
    expect(await has(`${TENANT}/vehicles/${v}/cover.1.jpg`)).toBe(true);
  });
});
