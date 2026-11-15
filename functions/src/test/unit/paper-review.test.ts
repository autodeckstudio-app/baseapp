/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({ doc: {} as any, vehicle: {} as any, update: vi.fn() }));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "owner" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection: (c:string) => ({ doc: () => ({ id: "p", c }) }), runTransaction: async (fn: any) => fn({ get: async (ref:any) => ({ exists: true, data: () => ref.c === "vehicles" ? h.vehicle : h.doc }), update: h.update }) }) }));
import { reviewPaper } from "../../functions/papers/reviewPaper.js";
const req = (data: any): any => ({ data, auth: { uid: "admin", token: { role: "admin", tenantId: "t", studioId: null } } });
beforeEach(() => { h.doc = { tenantId: "t", studioId: "s", status: "PENDING", kind: "PUC", reference: "test", vehicleId: "v", customerId:"c" }; h.vehicle={ownerId:"c",tenantId:"t",registrationNumber:"GJ01AB1234"}; h.update.mockClear(); });
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
    await expect(reviewPaper.run(req({ paperId: "p", decision: "VERIFIED", inspectedPlate: "GJ01AB1234", originalInspected: true }))).rejects.toMatchObject({ code: "permission-denied" });
    h.doc.tenantId = "t"; h.doc.status = "REJECTED";
    await expect(reviewPaper.run(req({ paperId: "p", decision: "VERIFIED", inspectedPlate: "GJ01AB1234", originalInspected: true }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.update).not.toHaveBeenCalled();
  });
});

it('staff cannot verify a known document plate mismatch or a transferred/archived car',async()=>{
 for(const row of [{extractedPlate:'MH40CQ3187'},{kind:'RC',reference:'MH40CQ3187'}]){Object.assign(h.doc,row);await expect(reviewPaper.run(req({paperId:'p',decision:'VERIFIED', inspectedPlate:'GJ01AB1234', originalInspected:true}))).rejects.toMatchObject({code:'failed-precondition'});}
 h.doc.extractedPlate=null;h.doc.kind='PUC';h.doc.reference='p';
 for(const over of [{ownerId:'new-owner'},{deletedAt:'2026-11-09'}]){h.vehicle={ownerId:'c',tenantId:'t',registrationNumber:'GJ01AB1234',...over};await expect(reviewPaper.run(req({paperId:'p',decision:'VERIFIED', inspectedPlate:'GJ01AB1234', originalInspected:true}))).rejects.toMatchObject({code:'failed-precondition'});}
 expect(h.update).not.toHaveBeenCalled();
});

it('manual approval needs explicit original inspection and the plate actually read from it',async()=>{
 for(const extra of [{},{inspectedPlate:'GJ01AB1234'},{originalInspected:true},{inspectedPlate:'MH40CQ3187',originalInspected:true}]) {
 await expect(reviewPaper.run(req({paperId:'p',decision:'VERIFIED',...extra}))).rejects.toBeDefined();
 }
 expect(h.update).not.toHaveBeenCalled();
 await reviewPaper.run(req({paperId:'p',decision:'VERIFIED',inspectedPlate:'gj 01 ab 1234',originalInspected:true}));
 expect(h.update.mock.calls[0]?.[1]).toMatchObject({status:'VERIFIED',inspectedPlate:'GJ01AB1234',originalInspected:true});
});
