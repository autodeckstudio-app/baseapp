/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), writes: [] as any[], deleted: [] as string[], audit: [] as any[], storageDeleted: [] as string[], storageFail: false, txFail: false, txMutate: null as null | (() => void) }));
const MD5 = "1B2M2Y8AsgTpgAmY7PhCfg=="; // base64 MD5 (of the empty string): valid format, distinct per-purpose overrides in tests
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: any, p: any) => h.audit.push(p) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: (p: string) => ({ delete: async () => { if (h.storageFail) throw new Error("storage down"); h.storageDeleted.push(p); }, getSignedUrl: async () => ["https://signed.example/put"] }) }) }) }));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({ id: path.split("/").pop(), path, get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }) });
  const query = (col: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _o: string, v: unknown) => query(col, [...filters, [f, v]]),
    get: async () => ({ docs: [...h.rows.entries()].filter(([k, r]) => k.startsWith(col + "/") && filters.every(([f, v]) => r[f] === v)).map(([, r]) => ({ data: () => r })) }),
  });
  return { getFirestore: () => ({
    collection: (c: string) => ({ doc: (id: string) => docRef(`${c}/${id}`), where: (f: string, o: string, v: unknown) => query(c, []).where(f, o, v) }),
    runTransaction: async (fn: any) => { if (h.txFail) { throw new Error("firestore down"); } let mutated = false; const mutateOnce = () => { if (!mutated && h.txMutate) { mutated = true; h.txMutate(); } }; return fn({ get: async (r: any) => { mutateOnce(); return r.get(); }, set: (r: any, d: any) => { h.rows.set(r.path, d); }, update: (r: any, d: any) => { h.writes.push({ path: r.path, d }); h.rows.set(r.path, { ...h.rows.get(r.path), ...d }); }, delete: (r: any) => { h.deleted.push(r.path); h.rows.delete(r.path); } }); },
  }) };
});
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { papers: () => "papers", vehicles: () => "vehicles", auditLog: () => "audit" } }));
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";
import { submitMyPaperSchema } from "../../schemas/paper.js";
import { paperNumberKey, assertNumberUnused } from "../../lib/paper-numbers.js";
const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
const paper = (id: string, o: any = {}) => ({ id, tenantId: "t", studioId: "s", vehicleId: "v1", customerId: "me", kind: "INSURANCE", reference: `REF-${id}`, status: "VERIFIED", evidencePath: `t/vehicles/v1/paper-${id}.jpg`, ...o });
beforeEach(() => {
  h.rows.clear(); h.writes.length = 0; h.deleted.length = 0; h.audit.length = 0; h.storageDeleted.length = 0; h.storageFail = false; h.txFail = false; h.txMutate = null;
  h.rows.set("vehicles/v1", { ownerId: "me", tenantId: "t" });
  h.rows.set("vehicles/v2", { ownerId: "other", tenantId: "t" });
  h.rows.set("papers/a", paper("a"));
  h.rows.set("papers/b", paper("b", { vehicleId: "v1" }));
  h.rows.set("papers/x", paper("x", { customerId: "other", vehicleId: "v2" }));
});
describe("number key and cross-document check (point 6)", () => {
  it("ignores case and spaces", () => { expect(paperNumberKey("gj 01 ab 1234")).toBe("GJ01AB1234"); });
  it("refuses a number on any of the customer's documents, not just this car, and ignores other customers", async () => {
    const db = (await import("firebase-admin/firestore")).getFirestore() as any;
    h.rows.set("papers/c", paper("c", { vehicleId: "v9", reference: "pol 123" }));
    await expect(assertNumberUnused(db, { tenantId: "t", customerId: "me", reference: "POL123" })).rejects.toMatchObject({ code: "already-exists" });
    await expect(assertNumberUnused(db, { tenantId: "t", customerId: "me", reference: "POL123", exceptPaperId: "c" })).resolves.toBeUndefined();
    h.rows.set("papers/y", paper("y", { customerId: "other", reference: "ONLY-OTHER" }));
    await expect(assertNumberUnused(db, { tenantId: "t", customerId: "me", reference: "ONLY-OTHER" })).resolves.toBeUndefined();
  });
  it("a replaced (superseded) paper no longer blocks its number", async () => {
    const db = (await import("firebase-admin/firestore")).getFirestore() as any;
    h.rows.set("papers/old", paper("old", { reference: "OLD1", supersededAt: "2026-01-01" }));
    await expect(assertNumberUnused(db, { tenantId: "t", customerId: "me", reference: "OLD1" })).resolves.toBeUndefined();
  });
});
describe("generation identity lifecycle (bound to the exact evidence path)", () => {
  it("a metadata edit keeps the checked generation binding: same path, same bytes, still the checked photo", async () => {
    h.rows.set("papers/a", paper("a", { evidenceGeneration: "1730000000000123", uploadedGeneration: null }));
    await updateMyPaper.run(req("me", { paperId: "a", reference: "REF-a", expiresOn: "2027-01-01" }));
    const rec = h.rows.get("papers/a");
    expect(rec.status).toBe("PENDING"); // back to review as a record...
    expect(rec.evidencePath).toBe("t/vehicles/v1/paper-a.jpg"); // ...but the evidence is untouched...
    expect(rec.evidenceGeneration).toBe("1730000000000123"); // ...so its checked binding stays valid
  });

  it("a staged replacement keeps the old checked binding until promotion (view still checked); removal clears both fields with the path", async () => {
    h.rows.set("papers/a", paper("a", { evidenceGeneration: "1730000000000123", uploadedGeneration: "1730000000000100" }));
    await updateMyPaper.run(req("me", { paperId: "a", reference: "REF-a", contentType: "image/png", contentMd5: MD5 }));
    const staged = h.rows.get("papers/a");
    expect(staged.evidencePath).toBe("t/vehicles/v1/paper-a.jpg"); // old photo still the live evidence
    expect(staged.evidenceGeneration).toBe("1730000000000123"); // its checked binding survives staging
    expect(staged.pendingEvidencePath).toMatch(/^t\/vehicles\/v1\/paper-a\.[a-z0-9]+\.png$/); // new photo staged separately

    h.rows.set("papers/b", paper("b", { evidenceGeneration: "1730000000000123", uploadedGeneration: "1730000000000100" }));
    await updateMyPaper.run(req("me", { paperId: "b", reference: "REF-b", removePhoto: true }));
    const removed = h.rows.get("papers/b");
    expect(removed.evidencePath).toBeNull();
    expect(removed.evidenceGeneration).toBeNull();
    expect(removed.uploadedGeneration).toBeNull();
  });
});

describe("OTHER needs a name (point 8)", () => {
  const base = { studioId: "s", vehicleId: "v1", kind: "OTHER", reference: "W1" };
  it("rejects OTHER without a name and accepts one with a name", () => {
    expect(submitMyPaperSchema.safeParse(base).success).toBe(false);
    expect(submitMyPaperSchema.safeParse({ ...base, title: "Warranty card" }).success).toBe(true);
    expect(submitMyPaperSchema.safeParse({ ...base, kind: "PUC" }).success).toBe(true);
  });
});
describe("updateMyPaper (points 5, 6)", () => {
  it("edits own paper, returns it to review, and writes an audit entry", async () => {
    await updateMyPaper.run(req("me", { paperId: "a", reference: "NEW 55", expiresOn: "2027-01-01" }));
    expect(h.writes[0].d).toMatchObject({ reference: "NEW 55", expiresOn: "2027-01-01", status: "PENDING", verificationMode: "review" });
    expect(h.audit[0]).toMatchObject({ action: "paper.updated", entityId: "a" });
  });
  it("does not flag itself as a duplicate", async () => {
    await expect(updateMyPaper.run(req("me", { paperId: "a", reference: "REF-a" }))).resolves.toBeDefined();
  });
  it("blocks a number used on another of the customer's documents", async () => {
    await expect(updateMyPaper.run(req("me", { paperId: "a", reference: "ref-b" }))).rejects.toMatchObject({ code: "already-exists" });
    expect(h.writes).toHaveLength(0);
  });
  it("refuses another customer's paper and a car you do not own", async () => {
    await expect(updateMyPaper.run(req("me", { paperId: "x", reference: "Z" }))).rejects.toMatchObject({ code: "permission-denied" });
    h.rows.set("papers/q", paper("q", { vehicleId: "v2" }));
    await expect(updateMyPaper.run(req("me", { paperId: "q", reference: "Z" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.writes).toHaveLength(0);
  });
  it("RC edits keep the RC format", async () => {
    h.rows.set("papers/rc", paper("rc", { kind: "RC", reference: "GJ01AB1234" }));
    await expect(updateMyPaper.run(req("me", { paperId: "rc", reference: "BAD" }))).rejects.toMatchObject({ code: "invalid-argument" });
    await updateMyPaper.run(req("me", { paperId: "rc", reference: "gj 05 cd 9999" }));
    expect(h.writes[0].d.reference).toBe("GJ05CD9999");
  });
  it("a photo edit stages the replacement as pendingEvidencePath and preserves the current evidence until finalize (Oct 29 fix)", async () => {
    const r: any = await updateMyPaper.run(req("me", { paperId: "a", contentType: "image/png", contentMd5: MD5 }));
    expect(r.uploadUrl).toBe("https://signed.example/put");
    expect(h.writes[0].d.pendingEvidencePath).toMatch(/^t\/vehicles\/v1\/paper-a\.[0-9a-f]{8}\.png$/);
    expect(h.writes[0].d).not.toHaveProperty("evidencePath");
    expect(h.writes[0].d).not.toHaveProperty("evidenceUrl");
  });
});
describe("deleteMyPaper (point 12)", () => {
  it("deletes only the owner's paper record and its photo, with an audit entry; the car stays", async () => {
    await deleteMyPaper.run(req("me", { paperId: "a" }));
    expect(h.deleted).toEqual(["papers/a"]);
    expect(h.storageDeleted).toEqual(["t/vehicles/v1/paper-a.jpg"]);
    expect(h.rows.has("vehicles/v1")).toBe(true);
    expect(h.audit[0]).toMatchObject({ action: "paper.deleted", entityId: "a" });
  });
  it("a Storage failure on byte cleanup never blocks or half-hides the record delete: the object is an unreferenced leftover", async () => {
    h.storageFail = true;
    await deleteMyPaper.run(req("me", { paperId: "a" })); // record + locks go; the object stays for the sweep
    expect(h.rows.has("papers/a")).toBe(false);
    expect(h.deleted).toEqual(["papers/a"]);
    expect(h.storageDeleted).toHaveLength(0); // bytes not removed, but nothing references them
    h.storageFail = false;
    // A retry finds the record already gone - truthfully not-found, never a double effect.
    await expect(deleteMyPaper.run(req("me", { paperId: "a" }))).rejects.toMatchObject({ code: "not-found" });
    expect(h.rows.has("papers/b")).toBe(true);
  });
  it("replacing the photo never deletes the current evidence in the edit itself; the old object is removed only when finalize promotes the confirmed upload (Oct 29 fix)", async () => {
    await updateMyPaper.run(req("me", { paperId: "a", contentType: "image/png", contentMd5: MD5 }));
    expect(h.storageDeleted).toHaveLength(0); // old object survives an abandoned or failed upload
    expect(h.rows.get("papers/a").evidencePath).toBe("t/vehicles/v1/paper-a.jpg"); // unchanged
    expect(h.rows.get("papers/a").pendingEvidencePath).toMatch(/^t\/vehicles\/v1\/paper-a\.[0-9a-f]{8}\.png$/); // staged
    await updateMyPaper.run(req("me", { paperId: "b", contentType: "image/jpeg", contentMd5: MD5 }));
    expect(h.storageDeleted).toHaveLength(0); // same-type edit also touches nothing
    h.storageFail = true;
    await expect(updateMyPaper.run(req("me", { paperId: "a", contentType: "image/webp", contentMd5: MD5 }))).resolves.toBeDefined(); // a stale-pending sweep failure cannot break the edit
    expect(h.rows.get("papers/a").pendingEvidencePath).toMatch(/^t\/vehicles\/v1\/paper-a\.[0-9a-f]{8}\.webp$/);
  });
  it("never deletes an object outside this paper's own path", async () => {
    h.rows.set("papers/evil", paper("evil", { evidencePath: "t/vehicles/v2/paper-x.jpg" }));
    await deleteMyPaper.run(req("me", { paperId: "evil" }));
    expect(h.storageDeleted).toHaveLength(0);
    expect(h.deleted).toEqual(["papers/evil"]);
  });
  it("refuses another customer's paper and leaves everything in place", async () => {
    await expect(deleteMyPaper.run(req("me", { paperId: "x" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.deleted).toHaveLength(0);
    expect(h.storageDeleted).toHaveLength(0);
  });
  it("refuses a studio or unauthenticated caller", async () => {
    await expect(deleteMyPaper.run({ data: { paperId: "a" }, auth: { uid: "s", token: { role: "studio", tenantId: "t", studioId: "s" } } } as any)).rejects.toBeDefined();
    await expect(deleteMyPaper.run({ data: { paperId: "a" } } as any)).rejects.toBeDefined();
    expect(h.deleted).toHaveLength(0);
  });
});

describe("updateMyPaper saved-photo removal (remove and replace image)", () => {
  it("removes the saved photo: object deleted first, then the record points at no photo", async () => {
    await updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }));
    expect(h.storageDeleted).toEqual(["t/vehicles/v1/paper-a.jpg"]);
    const after = h.rows.get("papers/a");
    expect(after.evidencePath).toBeNull();
    expect(after.evidenceUrl ?? null).toBeNull();
    expect(after.status).toBe("PENDING");
  });
  it("a photo that cannot be removed becomes an unreferenced leftover; the edit still commits", async () => {
    h.storageFail = true;
    await updateMyPaper.run(req("me", { paperId: "a", removePhoto: true, reference: "NEW 9" }));
    expect(h.rows.get("papers/a").evidencePath).toBeNull(); // the record no longer references the photo
    expect(h.rows.get("papers/a").reference).toBe("NEW 9"); // and the rest of the edit landed
    expect(h.storageDeleted).toHaveLength(0); // the object is left for the sweep, never blocking the save
  });
  it("rejects removePhoto combined with a replacement photo", async () => {
    await expect(updateMyPaper.run(req("me", { paperId: "a", removePhoto: true, contentType: "image/png", contentMd5: MD5 }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(h.writes).toHaveLength(0);
    expect(h.storageDeleted).toEqual([]);
  });
  it("removal also cleans up an earlier staged replacement object", async () => {
    h.rows.set("papers/a", paper("a", { pendingEvidencePath: "t/vehicles/v1/paper-a.stg12345.png" }));
    await updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }));
    expect(h.storageDeleted).toContain("t/vehicles/v1/paper-a.jpg");
    expect(h.storageDeleted).toContain("t/vehicles/v1/paper-a.stg12345.png");
    expect(h.rows.get("papers/a").pendingEvidencePath).toBeNull();
  });
});

describe("updateMyPaper removal failure consistency", () => {
  it("if the record write fails, no bytes were touched and the retry completes", async () => {
    h.txFail = true;
    await expect(updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }))).rejects.toBeDefined();
    expect(h.storageDeleted).toEqual([]); // deletion happens only after a committed write
    expect(h.rows.get("papers/a").evidencePath).toBe("t/vehicles/v1/paper-a.jpg");
    h.txFail = false;
    await updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }));
    expect(h.rows.get("papers/a").evidencePath).toBeNull();
    expect(h.storageDeleted).toEqual(["t/vehicles/v1/paper-a.jpg"]);
  });
  it("a raced precondition failure after photo removal keeps its real error (no misleading copy)", async () => {
    h.rows.set("papers/a", paper("a", { supersededAt: "2026-01-01" }));
    await expect(updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.storageDeleted).toEqual([]); // superseded check runs before any deletion
  });
});

describe("updateMyPaper concurrent-change guard", () => {
  it("a finalize landing between pre-read and save aborts retryably; the promoted photo is never deleted and the retry completes", async () => {
    h.rows.set("papers/a", paper("a", { pendingEvidencePath: "t/vehicles/v1/paper-a.stg12345.png" }));
    h.txMutate = () => h.rows.set("papers/a", { ...h.rows.get("papers/a"), evidencePath: "t/vehicles/v1/paper-a.stg12345.png", pendingEvidencePath: null }); // finalize promotes first
    await expect(updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }))).rejects.toMatchObject({
      code: "aborted",
      message: "This document changed while you were saving. Open it and save again.",
    });
    expect(h.writes).toHaveLength(0); // the raced save wrote nothing
    expect(h.storageDeleted).toEqual([]); // nothing deleted: neither the pre-read photo nor the promoted one
    expect(h.rows.get("papers/a").evidencePath).toBe("t/vehicles/v1/paper-a.stg12345.png"); // record still serves the promoted photo
    h.txMutate = null;
    await updateMyPaper.run(req("me", { paperId: "a", removePhoto: true })); // retry against settled state
    expect(h.rows.get("papers/a").evidencePath).toBeNull();
    expect(h.storageDeleted).toContain("t/vehicles/v1/paper-a.stg12345.png");
  });
  it("a replacement edit raced by a finalize never deletes the freshly promoted evidence as stillborn", async () => {
    h.rows.set("papers/a", paper("a", { pendingEvidencePath: "t/vehicles/v1/paper-a.stg12345.png" }));
    h.txMutate = () => h.rows.set("papers/a", { ...h.rows.get("papers/a"), evidencePath: "t/vehicles/v1/paper-a.stg12345.png", pendingEvidencePath: null });
    await expect(updateMyPaper.run(req("me", { paperId: "a", contentType: "image/png", contentMd5: MD5 }))).rejects.toMatchObject({ code: "aborted", message: "This document changed while you were saving. Open it and save again." });
    expect(h.writes).toHaveLength(0);
    expect(h.storageDeleted).not.toContain("t/vehicles/v1/paper-a.stg12345.png"); // Finding A: active evidence is never cleanup-deleted
    expect(h.rows.get("papers/a").evidencePath).toBe("t/vehicles/v1/paper-a.stg12345.png");
  });
  it("a concurrent edit racing a removal aborts instead of clobbering the newer staging", async () => {
    h.rows.set("papers/a", paper("a"));
    h.txMutate = () => h.rows.set("papers/a", { ...h.rows.get("papers/a"), pendingEvidencePath: "t/vehicles/v1/paper-a.stg99999.png" }); // another edit staged first
    await expect(updateMyPaper.run(req("me", { paperId: "a", removePhoto: true }))).rejects.toMatchObject({ code: "aborted" });
    expect(h.writes).toHaveLength(0);
    expect(h.storageDeleted).not.toContain("t/vehicles/v1/paper-a.stg99999.png"); // the other edit's staging is untouched
    expect(h.rows.get("papers/a").pendingEvidencePath).toBe("t/vehicles/v1/paper-a.stg99999.png");
  });
});
