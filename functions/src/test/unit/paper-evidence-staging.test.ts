/* eslint-disable @typescript-eslint/no-explicit-any */
/** Evidence-preservation guardrails for the Oct 29 staging fix (updateMyPaper + finalizeMyPaper). */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  audit: [] as any[],
  storageDeleted: [] as string[],
  signed: [] as string[],
  meta: new Map<string, { size: number; contentType: string }>(),
  signFail: false,
  deleteFail: new Set<string>(),
  beforeTx: null as null | (() => void),
  retryWith: null as null | (() => void),
}));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: any, p: any) => h.audit.push(p) }));
vi.mock("../../lib/paper-ocr.js", () => ({ readPaperImage: async () => ({ text: "GJ 01 AB 1234", confidence: 20 }) }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      name: "bucket.appspot.com",
      file: (p: string) => ({
        bucket: { name: "bucket.appspot.com" },
        delete: async () => { h.storageDeleted.push(p); if (h.deleteFail.has(p)) throw new Error("storage down"); },
        getSignedUrl: async () => { if (h.signFail) throw new Error("signing failed"); h.signed.push(p); return ["https://signed.example/put"]; },
        getMetadata: async () => {
          const m = h.meta.get(p);
          if (!m) throw Object.assign(new Error("No such object"), { code: 404 });
          return [{ size: m.size, contentType: m.contentType, metadata: {} }];
        },
        setMetadata: async () => undefined,
        download: async () => [Buffer.from("fake-image-bytes")],
      }),
    }),
  }),
}));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({ id: path.split("/").pop(), path, get: async () => ({ exists: h.rows.has(path), data: () => h.rows.get(path) }) });
  const query = (col: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _o: string, v: unknown) => query(col, [...filters, [f, v]]),
    get: async () => ({ docs: [...h.rows.entries()].filter(([k, r]) => k.startsWith(col + "/") && filters.every(([f, v]) => r[f] === v)).map(([, r]) => ({ data: () => r })) }),
  });
  return { getFirestore: () => ({
    collection: (c: string) => ({ doc: (id: string) => docRef(`${c}/${id}`), where: (f: string, o: string, v: unknown) => query(c, []).where(f, o, v) }),
    runTransaction: async (fn: any) => {
      // Buffered ops per attempt; only the final attempt's ops commit, like a real Firestore retry.
      const attempt = async () => {
        const ops: Array<["set" | "update" | "delete", string, any?]> = [];
        const tx = {
          get: async (r: any) => ({ exists: h.rows.has(r.path), data: () => h.rows.get(r.path) }),
          set: (r: any, d: any) => { ops.push(["set", r.path, d]); },
          update: (r: any, d: any) => { ops.push(["update", r.path, d]); },
          delete: (r: any) => { ops.push(["delete", r.path]); },
        };
        h.beforeTx?.(); h.beforeTx = null;
        await fn(tx);
        return ops;
      };
      let ops = await attempt();
      if (h.retryWith) { const hook = h.retryWith; h.retryWith = null; hook(); ops = await attempt(); }
      for (const [op, path, d] of ops) {
        if (op === "set") h.rows.set(path, d);
        else if (op === "update") h.rows.set(path, { ...h.rows.get(path), ...d });
        else h.rows.delete(path);
      }
    },
  }) };
});
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { papers: () => "papers", vehicles: () => "vehicles", auditLog: () => "audit" } }));
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";
import { numberLockId, rcLockId, PAPER_LOCKS } from "../../lib/paper-numbers.js";
import { finalizeMyPaper } from "../../functions/papers/submitMyPaper.js";

const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: "t" } } });
const T = "t", V = "v1", P = "p1";
const OLD = `${T}/vehicles/${V}/paper-${P}.webp`;
const NEW = `${T}/vehicles/${V}/paper-${P}.deadbeef.jpg`;

const seedPaper = (over: any = {}) => ({
  id: P, tenantId: T, studioId: "s1", vehicleId: V, customerId: "me", kind: "RC",
  reference: "GJ01AB1234", title: "RC", issuedOn: null, expiresOn: "2027-01-01",
  status: "VERIFIED", verificationMode: "manual", verificationReason: null,
  reviewedBy: "staff-1", reviewedAt: "2026-10-01T00:00:00.000Z", rejectionReason: null,
  evidencePath: OLD, evidenceUrl: "https://old.example/photo?token=old",
  submittedBy: "customer", submittedAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  h.rows.clear(); h.audit.length = 0; h.storageDeleted.length = 0; h.signed.length = 0; h.meta.clear(); h.signFail = false;
  h.rows.set(`papers/${P}`, seedPaper());
  h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "me", registrationNumber: "GJ01AB1234" });
});

describe("paper evidence staging guardrails", () => {
  it("signing failure during photo edit: rejects with zero writes and zero deletes", async () => {
    h.signFail = true;
    await expect(updateMyPaper.run(req("me", { paperId: P, contentType: "image/jpeg" }))).rejects.toBeDefined();
    const after = h.rows.get(`papers/${P}`);
    expect(after.status).toBe("VERIFIED");
    expect(after.evidencePath).toBe(OLD);
    expect(after.pendingEvidencePath).toBeUndefined();
    expect(h.storageDeleted).toEqual([]);
    expect(h.audit).toEqual([]);
  });

  it("photo edit stages pendingEvidencePath; old evidence and old object stay intact", async () => {
    const r: any = await updateMyPaper.run(req("me", { paperId: P, contentType: "image/jpeg" }));
    expect(r.uploadUrl).toBe("https://signed.example/put");
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.jpg$`));
    expect(after.evidencePath).toBe(OLD);
    expect(after.evidenceUrl).toBe("https://old.example/photo?token=old");
    expect(after.status).toBe("PENDING");
    expect(h.storageDeleted).toEqual([]);
  });

  it("edit without photo clears a stale pendingEvidencePath and sweeps only the abandoned pending object", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ pendingEvidencePath: NEW }));
    await updateMyPaper.run(req("me", { paperId: P, expiresOn: "2028-05-05" }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toBeNull();
    expect(after.evidencePath).toBe(OLD);
    expect(after.expiresOn).toBe("2028-05-05");
    expect(h.storageDeleted).toEqual([NEW]); // abandoned staged object swept, current evidence untouched
  });

  it("second photo edit while pending: pending replaced; only the stale pending object is swept", async () => {
    const FIRST = `${T}/vehicles/${V}/paper-${P}.cafe0001.png`;
    h.rows.set(`papers/${P}`, seedPaper({ pendingEvidencePath: FIRST }));
    await updateMyPaper.run(req("me", { paperId: P, contentType: "image/jpeg" }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.jpg$`));
    expect(after.evidencePath).toBe(OLD);
    expect(h.storageDeleted).toEqual([FIRST]);
  });

  it("same-extension edits stage unique paths: never the live object, never each other", async () => {
    await updateMyPaper.run(req("me", { paperId: P, contentType: "image/webp" }));
    const first = h.rows.get(`papers/${P}`).pendingEvidencePath;
    expect(first).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.webp$`));
    expect(first).not.toBe(OLD); // the live evidence object is never the upload target
    expect(h.storageDeleted).toEqual([]);
    await updateMyPaper.run(req("me", { paperId: P, contentType: "image/webp" }));
    const second = h.rows.get(`papers/${P}`).pendingEvidencePath;
    expect(second).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.webp$`));
    expect(second).not.toBe(first); // two same-extension edits can never share a staging object
    expect(h.rows.get(`papers/${P}`).evidencePath).toBe(OLD);
    expect(h.storageDeleted).toEqual([first]); // only the abandoned staging is swept
  });

  it("finalize without pending (submit flow): behavior unchanged, no deletes", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", evidenceUrl: null }));
    h.meta.set(OLD, { size: 100, contentType: "image/webp" });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(OLD);
    expect(String(after.evidenceUrl)).toContain("firebasestorage.googleapis.com");
    expect(h.storageDeleted).toEqual([]);
  });

  it("finalize with pending + object present: promotes, clears pending, deletes old object", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    h.meta.set(NEW, { size: 100, contentType: "image/jpeg" });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(NEW);
    expect(after.pendingEvidencePath).toBeNull();
    expect(String(after.evidenceUrl)).toContain(encodeURIComponent(NEW));
    expect(h.storageDeleted).toEqual([OLD]);
  });

  it("finalize with pending + object missing: old evidence intact, pending kept, no writes", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    const r: any = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(r.status).toBe("PENDING");
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(OLD);
    expect(after.evidenceUrl).toBe("https://old.example/photo?token=old");
    expect(after.pendingEvidencePath).toBe(NEW);
    expect(h.storageDeleted).toEqual([]);
  });
  it("stale finalize (doc changed between its read and its transaction) writes nothing at all", async () => {
    const NEWER = `${T}/vehicles/${V}/paper-${P}.f00d0002.png`;
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    h.meta.set(NEW, { size: 100, contentType: "image/jpeg" });
    // A newer edit lands after this finalize read the doc but before its transaction runs.
    h.beforeTx = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), pendingEvidencePath: NEWER, verificationReason: "Replacement photo is uploading; automatic checks follow." });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toBe(NEWER); // newer staging untouched
    expect(after.evidencePath).toBe(OLD); // nothing promoted
    expect(after.evidenceUrl).toBe("https://old.example/photo?token=old"); // no stale URL written
    expect(after.reviewedAt).toBe("2026-10-01T00:00:00.000Z"); // review state not overwritten
    expect(h.storageDeleted).toEqual([]); // old evidence NOT deleted
  });

  it("transaction retry: only the final attempt's decision commits; a mid-retry edit blocks promotion", async () => {
    const NEWER = `${T}/vehicles/${V}/paper-${P}.f00d0003.png`;
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    h.meta.set(NEW, { size: 100, contentType: "image/jpeg" });
    // Attempt 1 sees the matching staging; before the retried attempt, a newer edit replaces it.
    h.retryWith = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), pendingEvidencePath: NEWER });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toBe(NEWER); // newer staging intact
    expect(after.evidencePath).toBe(OLD); // attempt 1's promotion discarded, attempt 2 correctly abstained
    expect(h.storageDeleted).toEqual([]); // no delete from a discarded attempt
  });

  it("submit-flow finalize abstains when an edit staged a replacement after its read", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", evidenceUrl: null }));
    h.meta.set(OLD, { size: 100, contentType: "image/webp" });
    h.beforeTx = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), pendingEvidencePath: NEW });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toBe(NEW); // the edit's staging survives
    expect(after.evidencePath).toBe(OLD);
    expect(after.evidenceUrl).toBeNull(); // the stale finalize wrote nothing
    expect(h.storageDeleted).toEqual([]);
  });

  it("deleteMyPaper while a replacement is pending removes both objects, the record and its locks", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    const numLock = `${PAPER_LOCKS}/${numberLockId(T, "me", "GJ01AB1234")}`;
    const rcLock = `${PAPER_LOCKS}/${rcLockId(V)}`;
    h.rows.set(numLock, { paperId: P, kind: "number" });
    h.rows.set(rcLock, { paperId: P, kind: "rc" });
    await deleteMyPaper.run(req("me", { paperId: P }));
    expect(h.storageDeleted.sort()).toEqual([NEW, OLD].sort()); // current evidence AND staged object
    expect(h.rows.has(`papers/${P}`)).toBe(false);
    expect(h.rows.has(numLock)).toBe(false);
    expect(h.rows.has(rcLock)).toBe(false);
    expect(h.rows.has(`vehicles/${V}`)).toBe(true); // the car stays
  });

  it("deleteMyPaper: a failed staged-object cleanup cannot abort the delete (record never stranded)", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    h.deleteFail.add(NEW); // staged object refuses deletion
    await deleteMyPaper.run(req("me", { paperId: P })); // resolves anyway
    expect(h.rows.has(`papers/${P}`)).toBe(false); // record removed
    expect(h.storageDeleted).toContain(OLD); // current evidence removed
  });
});
