/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({ doc: {} as any, update: vi.fn() }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "owner" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection: () => ({ doc: () => ({ id: "p" }) }), runTransaction: async (fn: any) => fn({ get: async () => ({ exists: true, data: () => h.doc }), update: h.update }) }) }));
import { reviewPaper } from "../../functions/papers/reviewPaper.js";
const req = (data: any): any => ({ data, auth: { uid: "admin", token: { role: "admin", tenantId: "t", studioId: null } } });
beforeEach(() => { h.doc = { tenantId: "t", studioId: "s", status: "PENDING", kind: "PUC", reference: "test", vehicleId: "v" }; h.update.mockClear(); });
describe("PUC review regression", () => {
  it("persists a rejection with its reason", async () => {
    await reviewPaper.run(req({ paperId: "p", decision: "REJECTED", rejectionReason: "Expired" }));
    expect(h.update.mock.calls[0]?.[1]).toMatchObject({ status: "REJECTED", rejectionReason: "Expired", verificationMode: "manual" });
  });
  it("requires a nonblank reason", async () => {
    for (const reason of [undefined, "   "]) await expect(reviewPaper.run(req({ paperId: "p", decision: "REJECTED", ...(reason ? { rejectionReason: reason } : {}) }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(h.update).not.toHaveBeenCalled();
  });
  it("does not review another tenant or already reviewed documents", async () => {
    h.doc.tenantId = "other";
    await expect(reviewPaper.run(req({ paperId: "p", decision: "VERIFIED" }))).rejects.toMatchObject({ code: "permission-denied" });
    h.doc.tenantId = "t"; h.doc.status = "REJECTED";
    await expect(reviewPaper.run(req({ paperId: "p", decision: "VERIFIED" }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.update).not.toHaveBeenCalled();
  });
});
