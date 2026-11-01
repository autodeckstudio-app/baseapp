/**
 * Staff document-review save-read proof against the real Firestore emulator
 * (no Firestore mocks): a studio staff review writes the decision and the
 * exact fields the customer's listener reads back - status, reviewer,
 * timestamp, truthful reason copy - plus the audit entry. Role, tenant,
 * studio and already-decided gates deny as structured errors.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { reviewPaper } from "../../functions/papers/reviewPaper.js";

const db = getFirestore();
const TENANT = "review-tenant";
const STUDIO = "s";
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const staff = (u: string, studioId = STUDIO, tenantId = TENANT) => ({ uid: u, token: { role: "studio", tenantId, studioId } });
const customer = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
const review = (auth: unknown, data: Record<string, unknown>) => reviewPaper.run({ data, auth } as never);

async function pendingPaper(owner: string, overrides: Record<string, unknown> = {}) {
  const vehId = uid("veh");
  await db.collection("vehicles").doc(vehId).set({ id: vehId, ownerId: owner, tenantId: TENANT, registrationNumber: "GJ01AB1234" });
  const id = uid("paper");
  await db.collection("papers").doc(id).set({
    id, tenantId: TENANT, studioId: STUDIO, vehicleId: vehId, customerId: owner, kind: "INSURANCE",
    reference: "POL-1", title: null, issuedOn: null, expiresOn: "2030-01-01", status: "PENDING",
    verificationMode: "review", verificationReason: "Edited by the owner. Manual review needed.",
    reviewedBy: null, reviewedAt: null, rejectionReason: null, evidenceUrl: null, evidencePath: null,
    submittedBy: "customer", submissionId: null, supersededAt: null, createdAt: "c", updatedAt: "u",
    ...overrides,
  });
  return id;
}
const readPaper = async (id: string) => (await db.collection("papers").doc(id).get()).data() as Record<string, unknown>;
const auditFor = async (id: string) => (await db.collection("auditLog").where("entityId", "==", id).get()).docs.map((d) => d.data());

describe("staff document review save-read (emulator)", () => {
  it("verify: the decision persists with reviewer + timestamp + manual-verification copy, and the audit entry records before/after", async () => {
    const paperId = await pendingPaper(uid("cust"));
    const reviewer = uid("staff");
    const out = (await review(staff(reviewer), { paperId, decision: "VERIFIED" })) as { id: string; status: string };
    expect(out).toEqual({ id: paperId, status: "VERIFIED" });
    const saved = await readPaper(paperId); // the read the office + customer listeners serve
    expect(saved["status"]).toBe("VERIFIED");
    expect(saved["reviewedBy"]).toBe(reviewer);
    expect(typeof saved["reviewedAt"]).toBe("string");
    expect((saved["reviewedAt"] as string).length).toBeGreaterThan(0); // the "verified" claim carries its timestamp pair
    expect(saved["verificationMode"]).toBe("manual");
    expect(saved["verificationReason"]).toBe("Original document verified by staff.");
    expect(saved["rejectionReason"]).toBeNull();
    const audit = await auditFor(paperId);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "paper.reviewed", entityType: "paper", before: { status: "PENDING" }, after: { status: "VERIFIED", kind: "INSURANCE", reference: "POL-1" } });
  });

  it("reject: the exact rejection reason persists as both the rejection and the review copy", async () => {
    const paperId = await pendingPaper(uid("cust"));
    await review(staff(uid("staff")), { paperId, decision: "REJECTED", rejectionReason: "Document is expired." });
    const saved = await readPaper(paperId);
    expect(saved["status"]).toBe("REJECTED");
    expect(saved["rejectionReason"]).toBe("Document is expired.");
    expect(saved["verificationReason"]).toBe("Document is expired.");
    expect(saved["reviewedBy"]).toBeTruthy();
  });

  it("a customer's own review call is denied; nothing is written", async () => {
    const paperId = await pendingPaper(uid("cust"));
    await expect(review(customer(uid("cust")), { paperId, decision: "VERIFIED" })).rejects.toMatchObject({ code: "permission-denied" });
    expect((await readPaper(paperId))["status"]).toBe("PENDING");
  });

  it("an already-decided paper cannot be re-reviewed", async () => {
    const paperId = await pendingPaper(uid("cust"));
    await review(staff(uid("staff")), { paperId, decision: "VERIFIED" });
    await expect(review(staff(uid("staff2")), { paperId, decision: "REJECTED", rejectionReason: "late flip" })).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await readPaper(paperId))["status"]).toBe("VERIFIED"); // the first decision stands
  });

  it("cross-tenant staff and another studio's staff are both denied", async () => {
    const paperId = await pendingPaper(uid("cust"));
    await expect(review(staff(uid("staff"), STUDIO, "other-tenant"), { paperId, decision: "VERIFIED" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(review(staff(uid("staff"), "other-studio"), { paperId, decision: "VERIFIED" })).rejects.toMatchObject({ code: "permission-denied" });
    expect((await readPaper(paperId))["status"]).toBe("PENDING");
  });
});
