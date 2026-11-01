/* eslint-disable @typescript-eslint/no-explicit-any */
// Fault-injection verification of the photo publish retry contract:
// publish is the ONLY writer of the photo field - a failed publish is retried ONCE
// with the SAME issued path (replay-safe), a second failure surfaces, and nothing
// ever falls back to updateVehicle({photoUrl}).
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ calls: [] as { name: string; payload: any }[], publishFails: 0 }));
vi.mock("firebase/functions", () => ({
  httpsCallable: (_f: any, name: string) => async (payload: any) => {
    h.calls.push({ name, payload });
    if (name === "issueVehiclePhotoUploadUrl") return { data: { uploadUrl: "https://upload", path: "t/vehicles/v1/cover.abc.jpg", requiredHeaders: {} } };
    if (name === "publishVehiclePhoto") {
      if (h.publishFails > 0) { h.publishFails--; throw Object.assign(new Error("stale-upload: no pending upload matches"), { code: "functions/failed-precondition" }); }
      return { data: { url: "read://url" } };
    }
    if (name === "updateVehicle") throw new Error("updateVehicle must never be called for photos");
    throw new Error(`unexpected callable ${name}`);
  },
}));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(), getDocs: vi.fn() }));
vi.mock("firebase/storage", () => ({ getDownloadURL: vi.fn(), ref: vi.fn() }));
vi.mock("./firebase", () => ({ auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { vehicles: () => "vehicles" } }));
import { uploadVehiclePhoto } from "./vehicle-service";
beforeEach(() => {
  h.calls.length = 0; h.publishFails = 0;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
});
describe("uploadVehiclePhoto publish retry (fault injection)", () => {
  it("one failed publish retries with the SAME issued path and succeeds", async () => {
    h.publishFails = 1;
    const path = await uploadVehiclePhoto("v1", new Blob(["x"]), "image/jpeg");
    expect(path).toBe("t/vehicles/v1/cover.abc.jpg");
    const publishes = h.calls.filter((c) => c.name === "publishVehiclePhoto");
    expect(publishes).toHaveLength(2);
    expect(publishes[0]?.payload).toEqual(publishes[1]?.payload);
    expect(publishes[0]?.payload).toEqual({ vehicleId: "v1", path: "t/vehicles/v1/cover.abc.jpg", publish: true });
  });
  it("two failed publishes surface the error; no direct field write is attempted", async () => {
    h.publishFails = 2;
    await expect(uploadVehiclePhoto("v1", new Blob(["x"]), "image/jpeg")).rejects.toThrow(/stale-upload/);
    expect(h.calls.filter((c) => c.name === "publishVehiclePhoto")).toHaveLength(2);
    expect(h.calls.some((c) => c.name === "updateVehicle")).toBe(false);
  });
});
