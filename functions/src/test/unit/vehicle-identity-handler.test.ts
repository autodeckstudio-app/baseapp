import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: [] as any[], archived: null as any, set: vi.fn(), update: vi.fn(), uid: "owner" }));
vi.mock("../../middleware/auth.js", () => ({ extractUser: () => ({ uid: h.uid, claims: { tenantId: "tenant", role: "customer" } }), assertRole: vi.fn(), assertTenant: vi.fn() }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "owner" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({
  collection: () => { const q: any = { where: () => q, doc: (id = "new") => ({ id, isDoc: true }) }; return q; },
  runTransaction: async (fn: any) => fn({ get: async (ref: any) => ref.isDoc ? { exists: !!h.archived, data: () => h.archived } : { docs: h.rows.map((v) => ({ id: v.id, data: () => v })) }, set: h.set, update: h.update }),
}) }));
import { createVehicle } from "../../functions/vehicle/createVehicle.js";
import { restoreVehicle } from "../../functions/vehicle/restoreVehicle.js";
const data = { registrationNumber: "MH40CQ3182", make: "Maruti Suzuki", model: "Fronx", year: 2022, color: "White" };
const req = (payload: any): any => ({ data: payload });
const row = (plate: string, deletedAt: string | null = null) => ({ id: "original", registrationNumber: plate, deletedAt, tenantId: "tenant", ownerId: "owner", make: "Maruti Suzuki", model: "Fronx", year: 2022, color: "White" });
beforeEach(() => { h.rows = []; h.archived = null; vi.clearAllMocks(); });
describe("vehicle identity handlers", () => {
  it("creates a different registration even with identical car details", async () => {
    h.rows = [row("MH40CQ3181", "2026-10-01")];
    const out: any = await createVehicle.run(req(data));
    expect(out.vehicle.id).toBe("new"); expect(h.set).toHaveBeenCalledOnce();
  });
  it("does not create a live duplicate with plate formatting differences", async () => {
    h.rows = [row("MH 40 CQ 3182")];
    await expect(createVehicle.run(req(data))).rejects.toMatchObject({ code: "already-exists", details: { vehicleId: "original" } });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("does not create an archived duplicate even with the old new-car override", async () => {
    h.rows = [row("mh 40 cq 3182", "2026-10-01")];
    await expect(createVehicle.run(req({ ...data, archivedChoice: "new" }))).rejects.toMatchObject({ code: "failed-precondition", details: { vehicleId: "original" } });
    expect(h.set).not.toHaveBeenCalled();
  });
  it("restores the original row by id without creating any row", async () => {
    h.archived = row("MH40CQ3182", "2026-10-01"); h.rows = [h.archived];
    expect(await restoreVehicle.run(req({ vehicleId: "original" }))).toEqual({ vehicleId: "original", restored: true });
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ id: "original" }), expect.objectContaining({ deletedAt: null }));
    expect(h.set).not.toHaveBeenCalled();
  });
});
