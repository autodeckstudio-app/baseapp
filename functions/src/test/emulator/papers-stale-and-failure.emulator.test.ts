/**
 * Two bounded paper-edit checks against the real Firestore/Storage emulators (no mocks):
 *
 * 1. STALE METADATA EDIT (documents the gap, does not bless it): the server's conflict guard in
 *    updateMyPaper compares evidencePath/pendingEvidencePath only. A client holding a stale form
 *    (opened before another save) who changes NO photo paths saves straight over the newer edit -
 *    last write wins, no expectedRevision anywhere in the protocol. This test records that CURRENT
 *    behavior as executable evidence; it is not a desired property.
 *
 * 2. FAILED FINALIZE RETAINS THE PREVIOUS PHOTO: a staged replacement whose object never landed
 *    (abandoned/failed upload) must promote nothing and delete nothing - evidencePath keeps serving
 *    the previous photo and the record stays in manual review.
 */
import { describe, it, expect } from "vitest";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { submitMyPaper, finalizeMyPaper } from "../../functions/papers/submitMyPaper.js";
import { reviewPaper } from "../../functions/papers/reviewPaper.js";
import { getStorage } from "firebase-admin/storage";
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";

const db = getFirestore();
const TENANT = "papers-tenant";
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const auth = (u: string, tenantId = TENANT) => ({ uid: u, token: { role: "customer", tenantId, studioId: null } });
const submit = (u: string, data: Record<string, unknown>) => submitMyPaper.run({ data: { studioId: "s", ...data }, auth: auth(u) } as never);
const update = (u: string, data: Record<string, unknown>) => updateMyPaper.run({ data, auth: auth(u) } as never);
const finalize = (u: string, paperId: string) => finalizeMyPaper.run({ data: { paperId }, auth: auth(u) } as never);
const del = (u: string, data: Record<string, unknown>) => deleteMyPaper.run({ data, auth: auth(u) } as never);
const staffAuth = (u: string, tenantId = TENANT) => ({ uid: u, token: { role: "admin", tenantId, studioId: null } });
const review = (u: string, data: Record<string, unknown>) => reviewPaper.run({ data, auth: staffAuth(u) } as never);
async function car(owner: string) { const id = uid("veh"); await db.collection("vehicles").doc(id).set({ id, ownerId: owner, tenantId: TENANT, registrationNumber: "GJ01AB1234" }); return id; }
const paperDoc = async (id: string) => (await db.collection("papers").doc(id).get()).data() as Record<string, unknown>;

describe("stale edit + failed finalize (emulator)", () => {
  it("unguarded caller (no expectedRevision, older builds) still last-write-wins - documented backward compatibility", async () => {
    const me = uid("cust"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "STALE-1", expiresOn: "2026-12-31" });
    // Two form sessions on the same record; session A saves first. Session B's form predates A's save
    // but touches no photo paths, so the path-equality guard does not fire.
    await update(me, { paperId: sub.id, expiresOn: "2030-01-01" }); // session A (newer information)
    const outB: any = await update(me, { paperId: sub.id, expiresOn: "2029-06-01" }); // session B (stale form)
    expect(outB.id).toBe(sub.id); // no aborted/conflict error: the stale save went through
    const after = await paperDoc(sub.id);
    expect(after.expiresOn).toBe("2029-06-01"); // last write won; A's 2030-01-01 silently lost
    expect(after.status).toBe("PENDING");
  });

  it("revision guard: a stale form's save aborts and the newer save survives", async () => {
    const me = uid("cust"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "GUARD-1", expiresOn: "2026-12-31" });
    expect((await paperDoc(sub.id)).revision).toBe(0); // submit initializes the counter
    // Two form sessions opened on revision 0. Session A saves first.
    await update(me, { paperId: sub.id, expectedRevision: 0, expiresOn: "2030-01-01" });
    expect((await paperDoc(sub.id)).revision).toBe(1);
    // Session B's form still holds revision 0: the save must abort, not overwrite.
    await expect(update(me, { paperId: sub.id, expectedRevision: 0, expiresOn: "2029-06-01" }))
      .rejects.toMatchObject({ code: "aborted", message: "This document changed while you were saving. Open it and save again." });
    const after = await paperDoc(sub.id);
    expect(after.expiresOn).toBe("2030-01-01"); // the newer save is untouched
    expect(after.revision).toBe(1); // the aborted save did not bump the counter
    // Reopened on the current revision, B's save goes through.
    await update(me, { paperId: sub.id, expectedRevision: 1, expiresOn: "2029-06-01" });
    expect(await paperDoc(sub.id)).toMatchObject({ expiresOn: "2029-06-01", revision: 2 });
  });

  it("legacy record without a revision field reads as revision 0 and gains the counter on save", async () => {
    const me = uid("cust"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "PUC", reference: "LEG-1", expiresOn: "2026-12-31" });
    await db.collection("papers").doc(sub.id).update({ revision: FieldValue.delete() });
    expect((await paperDoc(sub.id)).revision).toBeUndefined();
    await update(me, { paperId: sub.id, expectedRevision: 0, expiresOn: "2030-03-01" });
    expect(await paperDoc(sub.id)).toMatchObject({ expiresOn: "2030-03-01", revision: 1 });
    // and from there the guard is live: a repeat of the same stale save aborts
    await expect(update(me, { paperId: sub.id, expectedRevision: 0, expiresOn: "2028-01-01" })).rejects.toMatchObject({ code: "aborted" });
  });

  it("revision guard on delete: a delete from a stale view aborts; on the current revision it deletes", async () => {
    const me = uid("cust"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "DEL-1", expiresOn: "2026-12-31" });
    // A view opened on revision 0; a newer edit lands first (revision 1).
    await update(me, { paperId: sub.id, expectedRevision: 0, expiresOn: "2030-01-01" });
    // The stale delete must abort and erase nothing.
    await expect(del(me, { paperId: sub.id, expectedRevision: 0 }))
      .rejects.toMatchObject({ code: "aborted", message: "This document changed while you were deleting it. Open it and delete again." });
    const after = await paperDoc(sub.id);
    expect(after).toMatchObject({ reference: "DEL-1", expiresOn: "2030-01-01", revision: 1 });
    // Reopened on the current revision, the delete goes through.
    await expect(del(me, { paperId: sub.id, expectedRevision: 1 })).resolves.toMatchObject({ deleted: true });
    expect((await db.collection("papers").doc(sub.id).get()).exists).toBe(false);
  });

  it("cross-principal: staff review bumps the counter, so a stale customer save/delete aborts and the VERIFIED outcome survives", async () => {
    const me = uid("cust"); const staff = uid("staff"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "XPR-1", expiresOn: "2026-12-31" });
    // Customer form/view opened on revision 0; staff verifies meanwhile (revision 1).
    await review(staff, { paperId: sub.id, decision: "VERIFIED", inspectedPlate: "GJ01AB1234", originalInspected: true });
    expect((await paperDoc(sub.id)).revision).toBe(1);
    await expect(update(me, { paperId: sub.id, expectedRevision: 0, expiresOn: "2030-01-01" })).rejects.toMatchObject({ code: "aborted" });
    await expect(del(me, { paperId: sub.id, expectedRevision: 0 })).rejects.toMatchObject({ code: "aborted" });
    const after = await paperDoc(sub.id);
    expect(after).toMatchObject({ status: "VERIFIED", revision: 1, expiresOn: "2026-12-31" }); // nothing clobbered back to PENDING
  });

  it("cross-principal: a committed finalize bumps the counter, so a stale customer save aborts and the promoted photo survives", async () => {
    const me = uid("cust"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "XPF-1", expiresOn: "2026-12-31" });
    const stagedPath = `${TENANT}/vehicles/${v}/paper-${sub.id}.abcd1234.png`;
    await db.collection("papers").doc(sub.id).update({ status: "PENDING", verificationMode: "review", submittedBy: "customer", evidencePath: null, pendingEvidencePath: stagedPath, pendingContentMd5: null });
    // The upload lands; finalize promotes it (revision 0 -> 1).
    const img = readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png"));
    await getStorage().bucket().file(stagedPath).save(img, { metadata: { contentType: "image/png" } });
    await finalize(me, sub.id);
    const promoted = await paperDoc(sub.id);
    expect(promoted.evidencePath).toBe(stagedPath);
    expect(promoted.revision).toBe(1);
    // A customer save from a form opened before the finalize must abort, not reset the promoted state.
    await expect(update(me, { paperId: sub.id, expectedRevision: 0, reference: "XPF-2" })).rejects.toMatchObject({ code: "aborted" });
    const after = await paperDoc(sub.id);
    expect(after).toMatchObject({ evidencePath: stagedPath, reference: "XPF-1", revision: 1 });
  });

  it("failed finalize of a staged replacement keeps the previous photo and promotes nothing", async () => {
    const me = uid("cust"); const v = await car(me);
    const sub: any = await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "FIN-1", expiresOn: "2026-12-31" });
    const oldPath = `${TENANT}/vehicles/${v}/paper-${sub.id}.old.png`;
    const stagedPath = `${TENANT}/vehicles/${v}/paper-${sub.id}.abcd1234.png`; // never uploaded
    await db.collection("papers").doc(sub.id).update({
      status: "PENDING", verificationMode: "review", submittedBy: "customer",
      evidencePath: oldPath, evidenceGeneration: "111", pendingEvidencePath: stagedPath, pendingContentMd5: null,
    });
    const res: any = await finalize(me, sub.id);
    expect(res).toMatchObject({ status: "PENDING", reason: "The new photo could not be read. The previous photo is still on file." });
    const after = await paperDoc(sub.id);
    expect(after.evidencePath).toBe(oldPath); // previous photo still serving
    expect(after.pendingEvidencePath).toBe(stagedPath); // staging left for retry, not promoted
    expect(after.evidenceGeneration).toBe("111"); // checked-bytes binding untouched
    expect(after.status).toBe("PENDING");
  });
});
