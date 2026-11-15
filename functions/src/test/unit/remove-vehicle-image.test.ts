/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), storageDeleted: [] as string[], storageFail: false }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: (p: string) => ({ delete: async () => { if (h.storageFail) throw new Error("down"); h.storageDeleted.push(p); }, exists: async () => [true], getSignedUrl: async () => [`signed://${p}`] }) }) }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({
  collection: (c: string) => ({ doc: (id: string) => {
    const path = `${c}/${id}`;
    return { get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }), update: async (d: any) => { const cur = h.rows.get(path) ?? {}; const next: any = { ...cur };
        for (const [k, v] of Object.entries(d)) { const parts = k.split("."); let o: any = next; for (let i = 0; i < parts.length - 1; i++) { const kk = parts[i] as string; o[kk] = { ...(o[kk] ?? {}) }; o = o[kk]; } o[parts[parts.length - 1] as string] = v; }
        h.rows.set(path, next); } };
  } }),
  runTransaction: async (fn: any) => fn({
    get: async (ref: any) => ref.get(),
    update: (ref: any, d: any) => ref.update(d),
  }),
}) }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { vehicles: () => "vehicles" } }));
import { removeMyVehicleImage } from "../../functions/vehicle/removeMyVehicleImage.js";
import { publishVehiclePhoto } from "../../functions/vehicle/publishVehiclePhoto.js";
const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
beforeEach(() => {
  h.rows.clear(); h.storageDeleted.length = 0; h.storageFail = false;
  h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", make: "Skoda", photoUrl: "t/vehicles/v1/cover.jpg", rcPhotoUrl: "t/vehicles/v1/rc.jpg" });
  h.rows.set("vehicles/v2", { ownerId: "other", tenantId: "t", photoUrl: "t/vehicles/v2/cover.jpg" });
});
describe("removeMyVehicleImage (round7 p7)", () => {
  it("clears only the chosen image field and its object; the car stays", async () => {
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.rows.get("vehicles/v1")).toMatchObject({ make: "Skoda", photoUrl: null, rcPhotoUrl: "t/vehicles/v1/rc.jpg" });
    expect(h.storageDeleted).toEqual(["t/vehicles/v1/cover.jpg"]);
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "rc" }));
    expect(h.rows.get("vehicles/v1")).toMatchObject({ rcPhotoUrl: null });
  });
  it("refuses another customer's car and touches nothing", async () => {
    await expect(removeMyVehicleImage.run(req("me", { vehicleId: "v2", kind: "cover" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.storageDeleted).toHaveLength(0);
    expect(h.rows.get("vehicles/v2").photoUrl).toBe("t/vehicles/v2/cover.jpg");
  });
  it("a Storage failure keeps the delete queued (field cleared); the next drain retries it", async () => {
    h.storageFail = true;
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.rows.get("vehicles/v1").photoUrl).toBeNull();
    const q = h.rows.get("vehicles/v1").photoReapQueue;
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ path: "t/vehicles/v1/cover.jpg", kind: "cover", attempts: 1 });
    expect(h.storageDeleted).toHaveLength(0);
    h.storageFail = false;
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "rc" }));
    expect(h.storageDeleted).toContain("t/vehicles/v1/cover.jpg");
    expect(h.rows.get("vehicles/v1").photoReapQueue).toHaveLength(0);
  });
  it("never deletes an object outside the car's own cover path", async () => {
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoUrl: "t/vehicles/v2/cover.jpg" });
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.storageDeleted).toHaveLength(0);
  });
  it("remove closes legacy accept for the kind (fix 7): re-publishing the removed path fails closed", async () => {
    h.storageFail = true;
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.rows.get("vehicles/v1").photoProtocol).toMatchObject({ cover: 1 });
  });
  it("FIX 7 CHAIN: remove -> failed queued delete -> republish of the removed path is REJECTED, object and field consistent", async () => {
    const removed = "t/vehicles/v1/cover.jpg";
    h.storageFail = true; // queued delete fails; P0 stays in the reap queue
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.rows.get("vehicles/v1").photoReapQueue[0]).toMatchObject({ path: removed });
    // The removed path's object still exists (outage persists); a re-tap / pre-deploy in-flight publish of
    // that same upload must NOT legacy-accept it (that would repoint a queued object and
    // the next drain would delete the referenced photo).
    await expect(publishVehiclePhoto.run(req("me", { vehicleId: "v1", path: removed, publish: true })))
      .rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("stale-upload") });
    expect(h.rows.get("vehicles/v1").photoUrl).toBeNull(); // field never repointed
    expect(h.rows.get("vehicles/v1").photoReapQueue).toHaveLength(1); // P0 still tracked for cleanup
    // Once Storage recovers, the next drain removes the orphaned object.
    h.storageFail = false;
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" })); // field already null; drain still runs
    expect(h.storageDeleted).toContain(removed);
    expect(h.rows.get("vehicles/v1").photoReapQueue).toHaveLength(0);
  });
  it("rejects a bad kind", async () => {
    await expect(removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "x" }))).rejects.toBeTruthy();
  });
});
