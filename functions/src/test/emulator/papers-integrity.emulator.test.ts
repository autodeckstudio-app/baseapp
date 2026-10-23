/**
 * Round 7 document invariants against the real Firestore emulator (no mocks for Firestore):
 * account-wide number uniqueness and one active RC per car under CONCURRENT writes, in-place RC replacement,
 * ownership denial, delete scope and idempotent retry. Storage is not started in this setup, so photo
 * deletion and Storage-failure retry are covered in unit tests (my-paper-edits.test.ts).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
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
});
