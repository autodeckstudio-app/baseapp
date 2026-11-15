/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), storageDeleted: [] as string[], deleteAttempts: [] as string[], storageFail: false, objectMissing: false }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({
  file: (p: string) => ({
    delete: async () => { h.deleteAttempts.push(p); if (h.storageFail) throw new Error("down"); h.storageDeleted.push(p); },
    exists: async () => [!h.objectMissing],
    getSignedUrl: async () => [`signed://${p}`],
  }),
}) }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({
  collection: (c: string) => ({ doc: (id: string) => {
    const path = `${c}/${id}`;
    return { get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }), update: async (d: any) => { const cur = h.rows.get(path) ?? {}; const next: any = { ...cur };
        for (const [k, v] of Object.entries(d)) { const parts = k.split("."); let o: any = next; for (let i = 0; i < parts.length - 1; i++) { const kk = parts[i] as string; o[kk] = { ...(o[kk] ?? {}) }; o = o[kk]; } o[parts[parts.length - 1] as string] = v; }
        h.rows.set(path, next); } };
  } }),
  runTransaction: async (fn: any) => fn({ get: async (ref: any) => ref.get(), update: (ref: any, d: any) => ref.update(d) }),
}) }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { vehicles: () => "vehicles" } }));
import { publishVehiclePhoto } from "../../functions/vehicle/publishVehiclePhoto.js";
const req = (data: any): any => ({ data, auth: { uid: "me", token: { role: "customer", tenantId: "t" } } });
const P = (n: string) => `t/vehicles/v1/cover.${n}.jpg`;
beforeEach(() => {
  h.rows.clear(); h.storageDeleted.length = 0; h.deleteAttempts.length = 0; h.storageFail = false; h.objectMissing = false;
  h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", photoUrl: P("old"), photoProtocol: { cover: 1 }, pendingPhoto: { cover: { path: P("new") } } });
});
describe("publishVehiclePhoto photo protocol", () => {
  it("consumes pending, moves the field, enqueues and drains the superseded path", async () => {
    const res = await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    expect(res).toMatchObject({ path: P("new") });
    const v = h.rows.get("vehicles/v1");
    expect(v.photoUrl).toBe(P("new"));
    expect(h.storageDeleted).toEqual([P("old")]);
    expect(v.photoReapQueue).toHaveLength(0);
  });
  it("rejects a path that is not the pending one (stale-upload)", async () => {
    await expect(publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("other"), publish: true })))
      .rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("stale-upload") });
    expect(h.rows.get("vehicles/v1").photoUrl).toBe(P("old"));
  });
  it("fails closed when pending was already consumed (replay of superseded path)", async () => {
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoUrl: P("new"), photoProtocol: { cover: 1 }, pendingPhoto: { cover: null } });
    await expect(publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("old2"), publish: true })))
      .rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("replaying the CURRENT path is a no-op success (lost-response retry)", async () => {
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoUrl: P("new"), photoProtocol: { cover: 1 }, pendingPhoto: { cover: null } });
    const res = await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    expect(res.path).toBe(P("new"));
    expect(h.storageDeleted).toHaveLength(0);
  });
  it("legacy car (no protocol fields): one accept, initializes protocol, enqueues previous own-path", async () => {
    h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", photoUrl: P("legacy") });
    h.storageFail = true; // keep the entry observable
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    const v = h.rows.get("vehicles/v1");
    expect(v.photoUrl).toBe(P("new"));
    expect(v.photoProtocol).toMatchObject({ cover: 1 });
    expect(v.photoReapQueue[0]).toMatchObject({ path: P("legacy"), attempts: 1 });
  });
  it("legacy previous value that is a URL is skipped, not enqueued", async () => {
    h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", photoUrl: "https://example.com/x.jpg" });
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    expect(h.rows.get("vehicles/v1").photoReapQueue).toBeUndefined();
  });
  it("rc pending is independent of cover pending", async () => {
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), rcPhotoUrl: "t/vehicles/v1/rc.old.jpg", pendingPhoto: { cover: { path: P("new") }, rc: { path: "t/vehicles/v1/rc.new.jpg" } } });
    await expect(publishVehiclePhoto.run(req({ vehicleId: "v1", kind: "rc", path: "t/vehicles/v1/rc.new.jpg", publish: true }))).resolves.toBeTruthy();
    expect(h.rows.get("vehicles/v1").rcPhotoUrl).toBe("t/vehicles/v1/rc.new.jpg");
    expect(h.rows.get("vehicles/v1").photoUrl).toBe(P("old"));
  });
  it("fails closed when the reap queue is at cap", async () => {
    const q = Array.from({ length: 25 }, (_, i) => ({ path: P(`q${i}`), kind: "cover", enqueuedAt: "t", attempts: 10, lastError: "x" }));
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoReapQueue: q });
    h.storageFail = true;
    await expect(publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true })))
      .rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("photo-cleanup-backlog") });
    expect(h.rows.get("vehicles/v1").photoUrl).toBe(P("old"));
  });
  it("a failed delete is retained and retried by the next publish's drain", async () => {
    h.storageFail = true;
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    expect(h.rows.get("vehicles/v1").photoReapQueue[0]).toMatchObject({ path: P("old"), attempts: 1 });
    h.storageFail = false;
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoUrl: P("new"), pendingPhoto: { cover: { path: P("newer") } } });
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("newer"), publish: true }));
    expect(h.storageDeleted).toContain(P("old"));
    expect(h.rows.get("vehicles/v1").photoReapQueue).toHaveLength(0);
  });
  it("publish=false mints a read URL with no protocol checks", async () => {
    h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", photoUrl: P("legacy") });
    const res = await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("legacy") }));
    expect(res.url).toContain("signed://");
  });
  it("one invocation never exceeds 10 delete attempts across both drains", async () => {
    const q = Array.from({ length: 20 }, (_, i) => ({ path: P(`b${i}`), kind: "cover", enqueuedAt: "t", attempts: 0, lastError: null }));
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoReapQueue: q });
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    // 10 backlog deletes in the pre-drain; the post-drain budget is exhausted, so the
    // freshly superseded path stays queued for the next invocation.
    expect(h.storageDeleted.length).toBeLessThanOrEqual(10);
    expect(h.rows.get("vehicles/v1").photoUrl).toBe(P("new"));
    expect(h.rows.get("vehicles/v1").photoReapQueue.length).toBeGreaterThan(0);
  });
  it("entries past the attempt cap are retained but not retried", async () => {
    const q = [{ path: P("stuck"), kind: "cover", enqueuedAt: "t", attempts: 10, lastError: "down" }];
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoReapQueue: q });
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    expect(h.storageDeleted).not.toContain(P("stuck"));
    expect(h.rows.get("vehicles/v1").photoReapQueue.some((e: any) => e.path === P("stuck"))).toBe(true);
  });
  it("missing new object: nothing moves, current photo is NOT reaped", async () => {
    h.objectMissing = true;
    await expect(publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true })))
      .rejects.toMatchObject({ code: "not-found" });
    expect(h.rows.get("vehicles/v1").photoUrl).toBe(P("old"));
    expect(h.rows.get("vehicles/v1").photoReapQueue ?? []).toHaveLength(0);
    expect(h.storageDeleted).toHaveLength(0);
  });
  it("replace on an archived car still follows the protocol (no archived block)", async () => {
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), deletedAt: "2026-01-01T00:00:00Z" });
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    expect(h.rows.get("vehicles/v1").photoUrl).toBe(P("new"));
    expect(h.storageDeleted).toEqual([P("old")]);
  });
  it("legacy marker is per-kind: cover migrated, first rc publish still legacy-accepts", async () => {
    h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t", photoUrl: P("old"), photoProtocol: { cover: 1 }, rcPhotoUrl: "t/vehicles/v1/rc.old.jpg" });
    h.storageFail = true; // observe the rc enqueue
    await publishVehiclePhoto.run(req({ vehicleId: "v1", kind: "rc", path: "t/vehicles/v1/rc.new.jpg", publish: true }));
    const v = h.rows.get("vehicles/v1");
    expect(v.rcPhotoUrl).toBe("t/vehicles/v1/rc.new.jpg");
    expect(v.photoReapQueue[0]).toMatchObject({ path: "t/vehicles/v1/rc.old.jpg", kind: "rc" });
  });
  it("backlog rejection is a real HttpsError failed-precondition", async () => {
    const q = Array.from({ length: 25 }, (_, i) => ({ path: P(`q${i}`), kind: "cover", enqueuedAt: "t", attempts: 10, lastError: "x" }));
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoReapQueue: q });
    h.storageFail = true;
    try {
      await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
      expect.unreachable();
    } catch (e: any) {
      expect(e.constructor.name).toBe("HttpsError");
      expect(e.code).toBe("failed-precondition");
      expect(e.message).toContain("photo-cleanup-backlog");
    }
  });
  it("a path failed in the pre-drain is not attempted twice in one invocation", async () => {
    h.storageFail = true;
    h.rows.set("vehicles/v1", { ...h.rows.get("vehicles/v1"), photoReapQueue: [{ path: P("stuck"), kind: "cover", enqueuedAt: "t", attempts: 0, lastError: null }] });
    await publishVehiclePhoto.run(req({ vehicleId: "v1", path: P("new"), publish: true }));
    const tries = h.deleteAttempts.filter((p) => p === P("stuck")).length;
    expect(tries).toBe(1);
  });
});
