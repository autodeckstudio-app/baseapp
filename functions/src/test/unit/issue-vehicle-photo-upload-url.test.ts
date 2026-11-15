/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), updates: [] as any[] }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: () => ({ getSignedUrl: async () => ["upload://signed"] }) }) }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({
  collection: (c: string) => ({ doc: (id: string) => {
    const path = `${c}/${id}`;
    return { get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }),
      update: async (d: any) => { h.updates.push(d); const cur = h.rows.get(path) ?? {}; const next: any = { ...cur };
        for (const [k, v] of Object.entries(d)) { const parts = k.split("."); let o: any = next; for (let i = 0; i < parts.length - 1; i++) { const kk = parts[i] as string; o[kk] = { ...(o[kk] ?? {}) }; o = o[kk]; } o[parts[parts.length - 1] as string] = v; }
        h.rows.set(path, next); } };
  } }),
}) }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { vehicles: () => "vehicles" } }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: async () => {}, subjectFrom: () => "s" }));
import { issueVehiclePhotoUploadUrl } from "../../functions/vehicle/issueVehiclePhotoUploadUrl.js";
const req = (uid: string, data: any, role = "customer"): any => ({ data, auth: { uid, token: { role, tenantId: "t" } } });
beforeEach(() => {
  h.rows.clear(); h.updates.length = 0;
  h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", photoUrl: "t/vehicles/v1/cover.a.jpg" });
});
describe("issueVehiclePhotoUploadUrl pending write", () => {
  it("records a per-kind pending path under the vehicle's own tenant prefix", async () => {
    const res = await issueVehiclePhotoUploadUrl.run(req("me", { vehicleId: "v1", contentType: "image/jpeg" }));
    const pending = h.rows.get("vehicles/v1").pendingPhoto;
    expect(pending.cover.path).toBe(res.path);
    expect(pending.cover.path).toMatch(/^t\/vehicles\/v1\/cover\.[\w-]+\.jpg$/);
    expect(pending.rc).toBeUndefined();
    expect(pending.cover.issuedAt).toBeTruthy();
  });
  it("rc issue writes pendingPhoto.rc without clobbering a pending cover", async () => {
    await issueVehiclePhotoUploadUrl.run(req("me", { vehicleId: "v1", contentType: "image/jpeg" }));
    const coverPath = h.rows.get("vehicles/v1").pendingPhoto.cover.path;
    await issueVehiclePhotoUploadUrl.run(req("me", { vehicleId: "v1", kind: "rc", contentType: "image/jpeg" }));
    const pending = h.rows.get("vehicles/v1").pendingPhoto;
    expect(pending.rc.path).toMatch(/^t\/vehicles\/v1\/rc\.[\w-]+\.jpg$/);
    expect(pending.cover.path).toBe(coverPath);
  });
  it("a second issue of the same kind supersedes the pending path (last issue wins)", async () => {
    const r1 = await issueVehiclePhotoUploadUrl.run(req("me", { vehicleId: "v1", contentType: "image/jpeg" }));
    const r2 = await issueVehiclePhotoUploadUrl.run(req("me", { vehicleId: "v1", contentType: "image/jpeg" }));
    expect(h.rows.get("vehicles/v1").pendingPhoto.cover.path).toBe(r2.path);
    expect(r2.path).not.toBe(r1.path);
  });
  it("refuses a vehicle the customer does not own and writes nothing", async () => {
    h.rows.set("vehicles/v1", { ownerId: "other", tenantId: "t" });
    await expect(issueVehiclePhotoUploadUrl.run(req("me", { vehicleId: "v1", contentType: "image/jpeg" })))
      .rejects.toMatchObject({ code: "permission-denied" });
    expect(h.updates).toHaveLength(0);
  });
});
