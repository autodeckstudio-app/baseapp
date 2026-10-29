/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rows: new Map<string, any>(), writes: [] as any[], deleted: [] as string[], audit: [] as any[], storageDeleted: [] as string[], storageFail: false }));
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
    runTransaction: async (fn: any) => fn({ get: async (r: any) => r.get(), set: (r: any, d: any) => { h.rows.set(r.path, d); }, update: (r: any, d: any) => { h.writes.push({ path: r.path, d }); h.rows.set(r.path, { ...h.rows.get(r.path), ...d }); }, delete: (r: any) => { h.deleted.push(r.path); h.rows.delete(r.path); } }),
  }) };
});
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { papers: () => "papers", vehicles: () => "vehicles", auditLog: () => "audit" } }));
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";
import { submitMyPaperSchema } from "../../schemas/paper.js";
import { paperNumberKey, assertNumberUnused } from "../../lib/paper-numbers.js";
const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
const paper = (id: string, o: any = {}) => ({ id, tenantId: "t", studioId: "s", vehicleId: "v1", customerId: "me", kind: "INSURANCE", reference: `REF-${id}`, status: "VERIFIED", evidencePath: `t/vehicles/v1/paper-${id}.jpg`, ...o });
beforeEach(() => {
  h.rows.clear(); h.writes.length = 0; h.deleted.length = 0; h.audit.length = 0; h.storageDeleted.length = 0; h.storageFail = false;
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
    const r: any = await updateMyPaper.run(req("me", { paperId: "a", contentType: "image/png" }));
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
  it("a Storage failure aborts before any record is removed, and a retry then succeeds (nothing orphaned, no other photo touched)", async () => {
    h.storageFail = true;
    await expect(deleteMyPaper.run(req("me", { paperId: "a" }))).rejects.toMatchObject({ code: "unavailable" });
    expect(h.rows.has("papers/a")).toBe(true);
    expect(h.deleted).toHaveLength(0);
    h.storageFail = false;
    await deleteMyPaper.run(req("me", { paperId: "a" }));
    expect(h.deleted).toEqual(["papers/a"]);
    expect(h.storageDeleted).toEqual(["t/vehicles/v1/paper-a.jpg"]);
    expect(h.rows.has("papers/b")).toBe(true);
  });
  it("replacing the photo never deletes the current evidence in the edit itself; the old object is removed only when finalize promotes the confirmed upload (Oct 29 fix)", async () => {
    await updateMyPaper.run(req("me", { paperId: "a", contentType: "image/png" }));
    expect(h.storageDeleted).toHaveLength(0); // old object survives an abandoned or failed upload
    expect(h.rows.get("papers/a").evidencePath).toBe("t/vehicles/v1/paper-a.jpg"); // unchanged
    expect(h.rows.get("papers/a").pendingEvidencePath).toMatch(/^t\/vehicles\/v1\/paper-a\.[0-9a-f]{8}\.png$/); // staged
    await updateMyPaper.run(req("me", { paperId: "b", contentType: "image/jpeg" }));
    expect(h.storageDeleted).toHaveLength(0); // same-type edit also touches nothing
    h.storageFail = true;
    await expect(updateMyPaper.run(req("me", { paperId: "a", contentType: "image/webp" }))).resolves.toBeDefined(); // a stale-pending sweep failure cannot break the edit
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
