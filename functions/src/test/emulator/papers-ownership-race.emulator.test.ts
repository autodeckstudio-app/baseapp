/**
 * Ownership / archive / tenant negatives for the customer document write path,
 * against the real Firestore emulator (no Firestore mocks): submit, edit, and
 * finalize must refuse or abstain when the vehicle is transferred or archived,
 * and nothing may be written, promoted, or deleted.
 *
 * The archive-during-finalize case exercises the fresh re-read INSIDE the write
 * transaction: finalize's pre-checks run before the download + OCR and do not
 * cover archive, so the in-transaction guard is the only thing between the OCR
 * decision and the record. The race window proper (state flipping between the
 * pre-transaction reads and the transaction's own reads) is covered
 * deterministically by the mocked buffered-transaction harness in
 * paper-evidence-staging.test.ts; Firestore retry timing is not controllable here.
 */
import { describe, it, expect, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { submitMyPaper, finalizeMyPaper } from "../../functions/papers/submitMyPaper.js";
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";
import { numberLockId, PAPER_LOCKS } from "../../lib/paper-numbers.js";

const db = getFirestore();
// Base64 MD5 of src/test/fixtures/synthetic-policy.png - the bytes these tests actually upload.
const FIXTURE_MD5 = "+u1VOWA2mKyFM0wEptyqZw==";
const OP = () => `3b6f6c3e-2f6a-4c1a-9b7d-${String(++n).padStart(12, "0")}`;
const TENANT = "papers-race-tenant";
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const auth = (u: string, tenantId = TENANT) => ({ uid: u, token: { role: "customer", tenantId, studioId: null } });
const submit = (u: string, data: Record<string, unknown>) => submitMyPaper.run({ data: { studioId: "s", ...data }, auth: auth(u) } as never);
const update = (u: string, data: Record<string, unknown>) => updateMyPaper.run({ data, auth: auth(u) } as never);
const finalize = (u: string, paperId: string) => finalizeMyPaper.run({ data: { paperId }, auth: auth(u) } as never);
async function car(owner: string, over: Record<string, unknown> = {}) {
  const id = uid("veh");
  await db.collection("vehicles").doc(id).set({ id, ownerId: owner, tenantId: TENANT, registrationNumber: "GJ01AB1234", ...over });
  return id;
}
const papersOf = async (owner: string) => (await db.collection("papers").where("customerId", "==", owner).get()).docs.map((d) => d.data());
const paperDoc = async (id: string) => (await db.collection("papers").doc(id).get()).data();

describe("document writes refuse a transferred, archived, or foreign car (emulator)", () => {
  it("submit on someone else's car: permission-denied, no record, no number lock", async () => {
    const me = uid("cust"), other = uid("cust");
    const v = await car(other);
    await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-DENY-1" })).rejects.toMatchObject({ code: "permission-denied" });
    expect(await papersOf(me)).toHaveLength(0);
    expect((await db.collection(PAPER_LOCKS).doc(numberLockId(TENANT, me, "RACE-DENY-1")).get()).exists).toBe(false);
  });

  it("submit on an archived car: failed-precondition, no record, no number lock", async () => {
    const me = uid("cust");
    const v = await car(me, { deletedAt: new Date().toISOString() });
    await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-ARC-1" })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(await papersOf(me)).toHaveLength(0);
    expect((await db.collection(PAPER_LOCKS).doc(numberLockId(TENANT, me, "RACE-ARC-1")).get()).exists).toBe(false);
  });

  it("submit with a foreign tenant claim: permission-denied, no record", async () => {
    const me = uid("cust");
    const v = await car(me);
    await expect(
      submitMyPaper.run({ data: { studioId: "s", vehicleId: v, kind: "INSURANCE", reference: "RACE-TEN-1" }, auth: auth(me, "other-tenant") } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(await papersOf(me)).toHaveLength(0);
  });

  it("edit after the car was transferred: permission-denied, record unchanged", async () => {
    const me = uid("cust"), other = uid("cust");
    const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-TRN-1" });
    const paper = (await papersOf(me))[0]!;
    await db.collection("vehicles").doc(v).update({ ownerId: other });
    await expect(update(me, { paperId: paper.id, reference: "RACE-TRN-2" })).rejects.toMatchObject({ code: "permission-denied" });
    expect((await paperDoc(paper.id))!.reference).toBe("RACE-TRN-1");
  });

  it("edit after the car was archived: failed-precondition, record unchanged", async () => {
    const me = uid("cust");
    const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-ARC-2" });
    const paper = (await papersOf(me))[0]!;
    await db.collection("vehicles").doc(v).update({ deletedAt: new Date().toISOString() });
    await expect(update(me, { paperId: paper.id, reference: "RACE-ARC-3" })).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await paperDoc(paper.id))!.reference).toBe("RACE-ARC-2");
  });

  it("edit after the record changed owner: permission-denied, record unchanged", async () => {
    const me = uid("cust"), other = uid("cust");
    const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-OWN-1" });
    const paper = (await papersOf(me))[0]!;
    await db.collection("papers").doc(paper.id).update({ customerId: other });
    await expect(update(me, { paperId: paper.id, reference: "RACE-OWN-2" })).rejects.toMatchObject({ code: "permission-denied" });
    expect((await paperDoc(paper.id))!.reference).toBe("RACE-OWN-1");
  });

  it("finalize after the car was transferred: refused, nothing promoted or decided", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust"), other = uid("cust");
      const v = await car(me);
      await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-TRN-3", contentType: "image/png", contentMd5: FIXTURE_MD5 });
      const paper = (await papersOf(me))[0]!;
      const img = readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png"));
      await getStorage().bucket().file(paper.evidencePath).save(img, { metadata: { contentType: "image/png" } });
      await db.collection("vehicles").doc(v).update({ ownerId: other });
      await expect(finalize(me, paper.id)).rejects.toMatchObject({ code: "permission-denied" });
      const after = await paperDoc(paper.id);
      expect(after!.status).toBe("PENDING");
      expect(after!.reviewedBy ?? null).toBeNull();
      expect(after!.evidencePath).toBe(paper.evidencePath);
      expect((await getStorage().bucket().file(paper.evidencePath).exists())[0]).toBe(true);
    } finally { sign.mockRestore(); }
  });

  it("finalize on an archived car: the in-transaction guard abstains, record and object untouched", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust");
      const v = await car(me);
      await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "RACE-ARC-4", contentType: "image/png", contentMd5: FIXTURE_MD5 });
      const paper = (await papersOf(me))[0]!;
      const img = readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png"));
      await getStorage().bucket().file(paper.evidencePath).save(img, { metadata: { contentType: "image/png" } });
      const before = await paperDoc(paper.id);
      // Archive lands after submit. finalize's pre-transaction checks do not cover
      // archive, so this exercises the fresh re-read inside the write transaction:
      // the OCR decision must NOT be written.
      await db.collection("vehicles").doc(v).update({ deletedAt: new Date().toISOString() });
      const res = (await finalize(me, paper.id)) as { status: string };
      expect(res.status).toBe("PENDING");
      const after = await paperDoc(paper.id);
      expect(after).toEqual(before); // not one field written
      expect((await getStorage().bucket().file(paper.evidencePath).exists())[0]).toBe(true); // object kept
    } finally { sign.mockRestore(); }
  });
});

describe("submit replay by operation id (emulator)", () => {
  const OP = () => `3b6f6c3e-2f6a-4c1a-9b7d-${String(++n).padStart(12, "0")}`;
  it("a retry after a lost acknowledgement returns the SAME record id with a fresh upload URL; one record, one lock", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust"); const v = await car(me); const op = OP();
      const first = (await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-1", contentType: "image/png", contentMd5: FIXTURE_MD5, submissionId: op })) as { id: string; uploadUrl: string | null };
      const second = (await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-1", contentType: "image/png", contentMd5: FIXTURE_MD5, submissionId: op })) as { id: string; uploadUrl: string | null };
      expect(second.id).toBe(first.id);
      expect(second.uploadUrl).toBe("https://signed.example/put");
      expect(await papersOf(me)).toHaveLength(1);
      const locks = await db.collection(PAPER_LOCKS).get();
      // The op lock doc also carries paperId by design; count only the number lock.
      expect(locks.docs.filter((d) => { const l = d.data() as { paperId: string; kind?: string }; return l.paperId === first.id && l.kind === "number"; })).toHaveLength(1);
    } finally { sign.mockRestore(); }
  });

  it("a concurrent double-tap of the same submission lands exactly one record and both calls get its id", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust"); const v = await car(me); const op = OP();
      const [a, b] = (await Promise.all([
        submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-2", contentType: "image/png", contentMd5: FIXTURE_MD5, submissionId: op }),
        submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-2", contentType: "image/png", contentMd5: FIXTURE_MD5, submissionId: op }),
      ])) as [{ id: string }, { id: string }];
      expect(a.id).toBe(b.id);
      expect(await papersOf(me)).toHaveLength(1);
    } finally { sign.mockRestore(); }
  });

  it("the same operation id with different details conflicts; nothing is overwritten", async () => {
    const me = uid("cust"); const v = await car(me); const op = OP();
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-3", expiresOn: "2027-01-01", submissionId: op });
    await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-3", expiresOn: "2028-06-30", submissionId: op })).rejects.toMatchObject({ code: "aborted" });
    const papers = await papersOf(me);
    expect(papers).toHaveLength(1);
    expect(papers[0]!.expiresOn).toBe("2027-01-01"); // untouched
  });

  it("the same number under a different operation id is a genuine duplicate", async () => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-4", submissionId: OP() });
    await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "replay-4", submissionId: OP() })).rejects.toMatchObject({ code: "already-exists" });
    expect(await papersOf(me)).toHaveLength(1);
  });
});

describe("delete refuses unsafe state and touches bytes only after proof (emulator)", () => {
  it("delete after the car was transferred: refused, record and object intact", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust"), other = uid("cust"); const v = await car(me);
      await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "DEL-1", contentType: "image/png", contentMd5: FIXTURE_MD5 });
      const paper = (await papersOf(me))[0]!;
      const img = readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png"));
      await getStorage().bucket().file(paper.evidencePath).save(img, { metadata: { contentType: "image/png" } });
      await db.collection("vehicles").doc(v).update({ ownerId: other });
      await expect(deleteMyPaper.run({ data: { paperId: paper.id }, auth: auth(me) } as never)).rejects.toMatchObject({ code: "permission-denied" });
      expect((await db.collection("papers").doc(paper.id).get()).exists).toBe(true);
      expect((await getStorage().bucket().file(paper.evidencePath).exists())[0]).toBe(true);
    } finally { sign.mockRestore(); }
  });

  it("delete on an archived car: refused inside the transaction, record intact", async () => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "DEL-2" });
    const paper = (await papersOf(me))[0]!;
    await db.collection("vehicles").doc(v).update({ deletedAt: new Date().toISOString() });
    await expect(deleteMyPaper.run({ data: { paperId: paper.id }, auth: auth(me) } as never)).rejects.toMatchObject({ code: "permission-denied" });
    expect((await db.collection("papers").doc(paper.id).get()).exists).toBe(true);
  });

  it("photo removal after the car was transferred: refused and the bytes survive", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust"), other = uid("cust"); const v = await car(me);
      await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "DEL-3", contentType: "image/png", contentMd5: FIXTURE_MD5 });
      const paper = (await papersOf(me))[0]!;
      const img = readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png"));
      await getStorage().bucket().file(paper.evidencePath).save(img, { metadata: { contentType: "image/png" } });
      await db.collection("vehicles").doc(v).update({ ownerId: other });
      await expect(update(me, { paperId: paper.id, removePhoto: true })).rejects.toMatchObject({ code: "permission-denied" });
      expect((await getStorage().bucket().file(paper.evidencePath).exists())[0]).toBe(true);
      expect((await paperDoc(paper.id))!.evidencePath).toBe(paper.evidencePath);
    } finally { sign.mockRestore(); }
  });

  // Additive deployed-lineage coverage (reviewer-required preservation):
  it("TRULY concurrent same-op submits with DIFFERENT payloads: one creates, the loser conflicts, exactly one record", async () => {
      const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
      try {
        const me = uid("cust"); const v = await car(me); const op = OP();
        const [a, b] = await Promise.allSettled([
          submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-C1", contentMd5: FIXTURE_MD5, contentType: "image/png", submissionId: op }),
          submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-C2", contentMd5: FIXTURE_MD5, contentType: "image/png", submissionId: op }),
        ]);
        const ok = [a, b].filter((r) => r.status === "fulfilled");
        const conflicted = [a, b].filter((r) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.code === "aborted");
        expect(ok).toHaveLength(1); // exactly one attempt created/replayed
        expect(conflicted).toHaveLength(1); // the differing loser fails closed
        expect(await papersOf(me)).toHaveLength(1); // never two records from one op
      } finally { sign.mockRestore(); }
    });
  it("a deleted record replays as a tombstone: the surviving op lock blocks recreation", async () => {
      const me = uid("cust"); const v = await car(me); const op = OP();
      const first = (await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-D1", submissionId: op })) as { id: string };
      await db.collection("papers").doc(first.id).delete();
      await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-D1", submissionId: op })).rejects.toMatchObject({ code: "failed-precondition" });
      expect(await papersOf(me)).toHaveLength(0); // never recreated
      const opLocks = (await db.collection(PAPER_LOCKS).get()).docs.filter((d) => d.id.startsWith("op__") && (d.data() as { paperId: string }).paperId === first.id);
      expect(opLocks).toHaveLength(1); // the tombstone survives
    });
  it("a superseded op replays as a tombstone: failed-precondition, no recreation, history intact", async () => {
      const me = uid("cust"); const v = await car(me); const op = OP();
      const first = (await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-S1", submissionId: op })) as { id: string };
      await db.collection("papers").doc(first.id).update({ supersededAt: new Date().toISOString() });
      await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-S1", submissionId: op })).rejects.toMatchObject({ code: "failed-precondition" });
      const papers = await papersOf(me);
      expect(papers).toHaveLength(1); // the old retry was NOT resurrected
      expect(papers[0]!.supersededAt).toBeTruthy();
    });
  it("checked-evidence replay binds the REAL object generation: no mint over landed bytes, fail closed after out-of-band replacement", async () => {
      const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
      try {
        const me = uid("cust"); const v = await car(me); const op = OP();
        const first = (await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-G1", contentMd5: FIXTURE_MD5, contentType: "image/png", submissionId: op })) as { id: string };
        const paper = (await paperDoc(first.id)) as { evidencePath: string };
        const file = getStorage().bucket().file(paper.evidencePath);
        await file.save(Buffer.from("real-png-bytes"), { metadata: { contentType: "image/png" } });
        const [meta] = await file.getMetadata();
        expect(meta.generation).toBeTruthy(); // the REAL emulator generation, not a mock constant
        // Record the checked generation as finalize would have.
        await db.collection("papers").doc(first.id).update({ status: "VERIFIED", evidenceGeneration: String(meta.generation) });
        const signedBefore = sign.mock.calls.length;
        const replay = (await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-G1", contentMd5: FIXTURE_MD5, contentType: "image/png", submissionId: op })) as { id: string; uploadUrl: string | null; photoState?: string };
        expect(replay.id).toBe(first.id);
        expect(replay.uploadUrl).toBeNull();
        expect(replay.photoState).toBe("none"); // decided record: nothing to upload
        expect(sign.mock.calls.length).toBe(signedBefore); // zero new mints
        // Out-of-band replacement of the checked bytes -> replay must fail closed.
        await file.save(Buffer.from("replaced-bytes"), { metadata: { contentType: "image/png" } });
        const [meta2] = await file.getMetadata();
        expect(String(meta2.generation)).not.toBe(String(meta.generation)); // real generation actually advanced
        await expect(submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPLAY-G1", contentMd5: FIXTURE_MD5, contentType: "image/png", submissionId: op })).rejects.toMatchObject({ code: "aborted" });
      } finally { sign.mockRestore(); }
    });
});
