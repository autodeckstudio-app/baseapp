/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), storageDeleted: [] as string[], storageFail: false }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: (p: string) => ({ delete: async () => { if (h.storageFail) throw new Error("down"); h.storageDeleted.push(p); } }) }) }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection: (c: string) => ({ doc: (id: string) => {
  const path = `${c}/${id}`;
  return { get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }), update: async (d: any) => { h.rows.set(path, { ...h.rows.get(path), ...d }); } };
} }) }) }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { vehicles: () => "vehicles" } }));
import { removeMyVehicleImage } from "../../functions/vehicle/removeMyVehicleImage.js";
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
  it("a Storage failure keeps the field; a retry succeeds", async () => {
    h.storageFail = true;
    await expect(removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }))).rejects.toMatchObject({ code: "unavailable" });
    expect(h.rows.get("vehicles/v1").photoUrl).toBe("t/vehicles/v1/cover.jpg");
    h.storageFail = false;
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.rows.get("vehicles/v1").photoUrl).toBeNull();
  });
  it("never deletes an object outside the car's own cover path", async () => {
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoUrl: "t/vehicles/v2/cover.jpg" });
    await removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "cover" }));
    expect(h.storageDeleted).toHaveLength(0);
  });
  it("rejects a bad kind", async () => {
    await expect(removeMyVehicleImage.run(req("me", { vehicleId: "v1", kind: "x" }))).rejects.toBeTruthy();
  });
});
