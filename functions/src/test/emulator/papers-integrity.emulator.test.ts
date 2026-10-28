/**
 * Round 7 document invariants against the real Firestore emulator (no mocks for Firestore):
 * account-wide number uniqueness and one active RC per car under CONCURRENT writes, in-place RC replacement,
 * ownership denial, delete scope and idempotent retry. The photo cases need the Storage emulator
 * (FIREBASE_STORAGE_EMULATOR_HOST); URL signing is stubbed there. Storage-failure retry is covered in unit tests (my-paper-edits.test.ts).
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { submitMyPaper } from "../../functions/papers/submitMyPaper.js";
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";

const db = getFirestore();
const TENANT = "papers-tenant";
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const auth = (u: string, tenantId = TENANT) => ({ uid: u, token: { role: "customer", tenantId, studioId: null } });
const submit = (u: string, data: Record<string, unknown>) => submitMyPaper.run({ data: { studioId: "s", ...data }, auth: auth(u) } as never);
const update = (u: string, data: Record<string, unknown>) => updateMyPaper.run({ data, auth: auth(u) } as never);
const del = (u: string, paperId: string) => deleteMyPaper.run({ data: { paperId }, auth: auth(u) } as never);
async function car(owner: string) { const id = uid("veh"); await db.collection("vehicles").doc(id).set({ id, ownerId: owner, tenantId: TENANT, registrationNumber: "GJ01AB1234" }); return id; }
const papersOf = async (owner: string) => (await db.collection("papers").where("customerId", "==", owner).get()).docs.map((d) => d.data());

describe("document integrity (emulator)", () => {
  beforeAll(() => { /* each test uses its own customer, so no cleanup is needed */ });

  it("concurrent submits of the same number on two cars: exactly one wins", async () => {
    const me = uid("cust"); const v1 = await car(me); const v2 = await car(me);
    const results = await Promise.allSettled([
      submit(me, { vehicleId: v1, kind: "INSURANCE", reference: "POL 777" }),
      submit(me, { vehicleId: v2, kind: "PUC", reference: "pol777" }),
      submit(me, { vehicleId: v1, kind: "OTHER", title: "Card", reference: "Pol 777" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect((r.reason as { code: string }).code).toBe("already-exists");
    expect(await papersOf(me)).toHaveLength(1);
  });

  it("concurrent RC submits on one car: one RC; a later RC is refused until edited in place", async () => {
    const me = uid("cust"); const v = await car(me);
    const r = await Promise.allSettled([
      submit(me, { vehicleId: v, kind: "RC", reference: "GJ01AB1111" }),
      submit(me, { vehicleId: v, kind: "RC", reference: "GJ01AB2222" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rcs = (await papersOf(me)).filter((p) => p.kind === "RC");
    expect(rcs).toHaveLength(1);
    await expect(submit(me, { vehicleId: v, kind: "RC", reference: "GJ01AB3333" })).rejects.toMatchObject({ code: "already-exists" });
    const out: any = await update(me, { paperId: rcs[0]!.id, reference: "gj 01 ab 3333", expiresOn: "2027-05-01" });
    expect(out.id).toBe(rcs[0]!.id);
    const after = (await papersOf(me)).filter((p) => p.kind === "RC");
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ reference: "GJ01AB3333", expiresOn: "2027-05-01", status: "PENDING" });
    // the old RC number is free again
    await submit(me, { vehicleId: await car(me), kind: "INSURANCE", reference: rcs[0]!.reference });
  });

  it("number uniqueness is per customer: another customer can use the same number", async () => {
    const a = uid("cust"); const b = uid("cust");
    await submit(a, { vehicleId: await car(a), kind: "INSURANCE", reference: "SAME-1" });
    await submit(b, { vehicleId: await car(b), kind: "INSURANCE", reference: "same-1" });
    await expect(submit(a, { vehicleId: await car(a), kind: "PUC", reference: "SAME-1" })).rejects.toMatchObject({ code: "already-exists" });
  });

  it("editing never flags itself; editing into another document's number is refused; concurrent edits to one number: one wins", async () => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "A1" });
    await submit(me, { vehicleId: v, kind: "PUC", reference: "B1" });
    await submit(me, { vehicleId: v, kind: "OTHER", title: "X", reference: "C1" });
    const find = async (r: string) => (await papersOf(me)).find((p) => p.reference === r)!;
    const pa = await find("A1"), pb = await find("B1"), pc = await find("C1");
    await update(me, { paperId: pa.id, reference: "a1", expiresOn: "2027-01-01" });
    await expect(update(me, { paperId: pa.id, reference: "B1" })).rejects.toMatchObject({ code: "already-exists" });
    const race = await Promise.allSettled([update(me, { paperId: pb.id, reference: "NEW9" }), update(me, { paperId: pc.id, reference: "new 9" })]);
    expect(race.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await papersOf(me)).filter((p) => String(p.reference).replace(/\s/g, "").toUpperCase() === "NEW9")).toHaveLength(1);
  });

  it("another customer cannot edit or delete my document, and nothing changes", async () => {
    const me = uid("cust"); const other = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "OWN-1" });
    const mine = (await papersOf(me))[0]!;
    await expect(update(other, { paperId: mine.id, reference: "HIJACK" })).rejects.toMatchObject({ code: "permission-denied" });
    await expect(del(other, mine.id)).rejects.toMatchObject({ code: "permission-denied" });
    await expect(update(me, { paperId: mine.id, reference: "OWN-2" }) ).resolves.toBeDefined();
    const wrongTenant = { data: { paperId: mine.id }, auth: auth(me, "other-tenant") };
    await expect(deleteMyPaper.run(wrongTenant as never)).rejects.toBeDefined();
    expect((await papersOf(me))[0]!.reference).toBe("OWN-2");
  });

  it("delete removes only that paper (and frees its number and RC slot); the car and other papers stay; retry is safe", async () => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "RC", reference: "GJ05CD4444" });
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "KEEP-1" });
    const rc = (await papersOf(me)).find((p) => p.kind === "RC")!;
    await del(me, rc.id);
    expect((await papersOf(me)).map((p) => p.reference)).toEqual(["KEEP-1"]);
    expect((await db.collection("vehicles").doc(v).get()).exists).toBe(true);
    await expect(del(me, rc.id)).rejects.toMatchObject({ code: "not-found" });
    await submit(me, { vehicleId: v, kind: "RC", reference: "GJ05CD4444" }); // number and RC slot are free again
    const audits = await db.collection("auditLog").where("entityId", "==", rc.id).get();
    expect(audits.docs.some((d) => d.data().action === "paper.deleted")).toBe(true);
  });

  it.each([
    ["RC", "GJ01AB9999", "GJ01AB8888", undefined],
    ["INSURANCE", "POL-K1", "POL-K2", undefined],
    ["PUC", "PUC-K1", "PUC-K2", undefined],
    ["OTHER", "OTH-K1", "OTH-K2", "Warranty card"],
  ])("per kind %s: edit changes number and expiry, returns a verified paper to review, then delete removes only it", async (kind, ref1, ref2, title) => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind, reference: ref1, ...(title ? { title } : {}) });
    const first = (await papersOf(me))[0]!;
    await db.collection("papers").doc(first.id).update({ status: "VERIFIED" });
    await update(me, { paperId: first.id, reference: ref2, expiresOn: "2028-02-02", ...(title ? { title: "Updated name" } : {}) });
    const after = (await db.collection("papers").doc(first.id).get()).data()!;
    expect(after.reference).toBe(ref2);
    expect(after.expiresOn).toBe("2028-02-02");
    expect(after.status).not.toBe("VERIFIED");
    expect(after.kind).toBe(kind);
    if (title) expect(after.title).toBe("Updated name");
    await del(me, first.id);
    expect((await db.collection("papers").doc(first.id).get()).exists).toBe(false);
    expect((await db.collection("vehicles").doc(v).get()).exists).toBe(true);
  });

  // Needs the Storage emulator (FIREBASE_STORAGE_EMULATOR_HOST). The photo is a real object in the emulator bucket.
  it("delete removes the paper's own Storage photo, and never an object outside its own path", async () => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "PHOTO-1" });
    const paper = (await papersOf(me))[0]!;
    const bucket = getStorage().bucket();
    const own = `${TENANT}/vehicles/${v}/paper-${paper.id}.jpg`;
    const other = `${TENANT}/vehicles/${v}/paper-someone-else.jpg`;
    await bucket.file(own).save(Buffer.from("own-bytes"), { metadata: { contentType: "image/jpeg" } });
    await bucket.file(other).save(Buffer.from("other-bytes"), { metadata: { contentType: "image/jpeg" } });
    await db.collection("papers").doc(paper.id).update({ evidencePath: own });
    expect((await bucket.file(own).exists())[0]).toBe(true);
    await del(me, paper.id);
    expect((await bucket.file(own).exists())[0]).toBe(false);
    expect((await bucket.file(other).exists())[0]).toBe(true);
    expect((await db.collection("papers").doc(paper.id).get()).exists).toBe(false);
    await bucket.file(other).delete({ ignoreNotFound: true });
  });

  it("a paper whose stored photo path points outside its own folder deletes the record but leaves that object", async () => {
    const me = uid("cust"); const v = await car(me);
    await submit(me, { vehicleId: v, kind: "PUC", reference: "PHOTO-2" });
    const paper = (await papersOf(me))[0]!;
    const bucket = getStorage().bucket();
    const foreign = `${TENANT}/vehicles/other-car/paper-foreign.jpg`;
    await bucket.file(foreign).save(Buffer.from("foreign"), { metadata: { contentType: "image/jpeg" } });
    await db.collection("papers").doc(paper.id).update({ evidencePath: foreign });
    await expect(del(me, paper.id)).resolves.toMatchObject({ deleted: true });
    expect((await db.collection("papers").doc(paper.id).get()).exists).toBe(false);
    expect((await bucket.file(foreign).exists())[0]).toBe(true);
    await bucket.file(foreign).delete({ ignoreNotFound: true });
  });

  it("editing only the expiry with the SAME number does not flag itself, in each kind (self-exclusion)", async () => {
    const me = uid("cust"); const v = await car(me);
    const specs: Array<[string, string, string | undefined]> = [["RC", "GJ01AB7777", undefined], ["INSURANCE", "SAME-I1", undefined], ["PUC", "SAME-P1", undefined], ["OTHER", "SAME-O1", "Warranty card"]];
    for (const [kind, reference, title] of specs) await submit(me, { vehicleId: v, kind, reference, ...(title ? { title } : {}) });
    for (const p of await papersOf(me)) {
      await update(me, { paperId: p.id, reference: p.reference, expiresOn: "2029-03-03" });
      expect((await db.collection("papers").doc(p.id).get()).data()!.expiresOn).toBe("2029-03-03");
    }
    expect((await papersOf(me)).map((p) => p.kind).sort()).toEqual(["INSURANCE", "OTHER", "PUC", "RC"]);
  });

  it("deleting a document leaves the car's bookings in place", async () => {
    const me = uid("cust"); const v = await car(me);
    const bookingId = uid("bk");
    await db.collection("bookings").doc(bookingId).set({ id: bookingId, tenantId: TENANT, customerId: me, vehicleId: v, status: "CONFIRMED" });
    await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "BK-DOC-1" });
    const paper = (await papersOf(me))[0]!;
    await del(me, paper.id);
    const b = await db.collection("bookings").doc(bookingId).get();
    expect(b.exists).toBe(true);
    expect(b.data()!.status).toBe("CONFIRMED");
  });

  // Photo replace: the real emulator bucket holds the old object and the real function deletes/keeps objects.
  // Only URL signing is stubbed (the emulator has no signing key); the bytes upload itself is a client step.
  it("replacing the photo with another file type removes the old own object, repoints the record and returns an upload URL", async () => {
    const sign = vi.spyOn(Object.getPrototypeOf(getStorage().bucket().file("x")), "getSignedUrl").mockResolvedValue(["https://signed.example/put"] as never);
    try {
      const me = uid("cust"); const v = await car(me);
      await submit(me, { vehicleId: v, kind: "INSURANCE", reference: "REPL-1" });
      const paper = (await papersOf(me))[0]!;
      const bucket = getStorage().bucket();
      const oldPath = `${TENANT}/vehicles/${v}/paper-${paper.id}.jpg`;
      const sibling = `${TENANT}/vehicles/${v}/paper-sibling.jpg`;
      await bucket.file(oldPath).save(Buffer.from("old"), { metadata: { contentType: "image/jpeg" } });
      await bucket.file(sibling).save(Buffer.from("sib"), { metadata: { contentType: "image/jpeg" } });
      await db.collection("papers").doc(paper.id).update({ evidencePath: oldPath });
      const res = (await update(me, { paperId: paper.id, contentType: "image/png" })) as { uploadUrl: string | null };
      expect(res.uploadUrl).toBe("https://signed.example/put");
      const after = (await db.collection("papers").doc(paper.id).get()).data()!;
      expect(after.evidencePath).toBe(`${TENANT}/vehicles/${v}/paper-${paper.id}.png`);
      expect(after.status).toBe("PENDING");
      expect((await bucket.file(oldPath).exists())[0]).toBe(false);
      expect((await bucket.file(sibling).exists())[0]).toBe(true);
      await bucket.file(sibling).delete({ ignoreNotFound: true });
    } finally { sign.mockRestore(); }
  });
});
