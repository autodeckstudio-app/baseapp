/* eslint-disable @typescript-eslint/no-explicit-any */
/** Evidence-preservation guardrails for the Oct 29 staging fix (updateMyPaper + finalizeMyPaper). */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  audit: [] as any[],
  storageDeleted: [] as string[],
  signed: [] as string[],
  meta: new Map<string, { size: number; contentType: string; md5Hash?: string }>(),
  signFail: false,
  deleteFail: new Set<string>(),
  beforeTx: null as null | (() => void),
  retryWith: null as null | (() => void),
  // PENDING decision by default; tests that need a VERIFIED decision override this.
  ocr: { text: "GJ 01 AB 1234", confidence: 20 } as { text: string; confidence: number },
  docSeq: 0,
}));
const MD5 = "1B2M2Y8AsgTpgAmY7PhCfg=="; // base64 MD5 (of the empty string): valid format, distinct per-purpose overrides in tests
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: any, p: any) => h.audit.push(p) }));
vi.mock("../../lib/paper-ocr.js", () => ({ readPaperImage: async () => h.ocr }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      name: "bucket.appspot.com",
      // The seam mirrors the production pin: the generation rides on the FILE HANDLE
      // (bucket.file(name, { generation })), not on download() options. A pinned handle
      // whose version is no longer live behaves like real GCS without versioning: 404.
      file: (p: string, opts?: { generation?: string | number }) => {
        const pinned = (opts?.generation !== null && opts?.generation !== undefined) ? String(opts.generation) : null;
        const live = () => ((h as any).generationOverride?.[p]) ?? "1730000000000123";
        const stale = () => pinned !== null && pinned !== live();
        return {
          bucket: { name: "bucket.appspot.com" },
          delete: async () => { h.storageDeleted.push(p); if (h.deleteFail.has(p)) throw new Error("storage down"); },
          getSignedUrl: async () => { if (h.signFail) throw new Error("signing failed"); h.signed.push(p); return ["https://signed.example/put"]; },
          getMetadata: async () => {
            const m = h.meta.get(p);
            if (!m || stale()) throw Object.assign(new Error("No such object"), { code: 404 });
            const g = (h as any).noGeneration ? undefined : live();
            // Simulate a swap landing between the metadata read and the download.
            if ((h as any).flipAfterMetadata?.[p]) { (h as any).generationOverride = { ...(h as any).generationOverride, [p]: (h as any).flipAfterMetadata[p] }; }
            return [{ size: m.size, contentType: m.contentType, generation: g, md5Hash: m.md5Hash, metadata: {} }];
          },
          setMetadata: async () => undefined,
          download: async () => {
            if (!h.meta.get(p) || stale()) throw Object.assign(new Error("No such object generation"), { code: 404 });
            return [Buffer.from("fake-image-bytes")];
          },
        };
      },
    }),
  }),
}));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({ id: path.split("/").pop(), path, get: async () => { if (path.startsWith("customers/") && !h.rows.has(path)) { const id = path.split("/").pop(); return { exists: true, data: () => ({ authUid: id, tenantId: "t", deletedAt: null }) }; } return { exists: h.rows.has(path), data: () => h.rows.get(path) }; } });
  const query = (col: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _o: string, v: unknown) => query(col, [...filters, [f, v]]),
    get: async () => ({ docs: [...h.rows.entries()].filter(([k, r]) => k.startsWith(col + "/") && filters.every(([f, v]) => r[f] === v)).map(([, r]) => ({ data: () => r })) }),
  });
  return { getFirestore: () => ({
    collection: (c: string) => ({ doc: (id?: string) => docRef(`${c}/${id ?? `auto-${++h.docSeq}`}`), where: (f: string, o: string, v: unknown) => query(c, []).where(f, o, v) }),
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
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { papers: () => "papers", vehicles: () => "vehicles", customers: () => "customers", auditLog: () => "audit" } }));
import { updateMyPaper, deleteMyPaper } from "../../functions/papers/myPaperEdits.js";
import { numberLockId, rcLockId, PAPER_LOCKS } from "../../lib/paper-numbers.js";
import { finalizeMyPaper, submitMyPaper } from "../../functions/papers/submitMyPaper.js";

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
  h.beforeTx = null; h.retryWith = null; (h as any).generationOverride = undefined; (h as any).noGeneration = false; (h as any).flipAfterMetadata = undefined;
  h.ocr = { text: "GJ 01 AB 1234", confidence: 20 }; h.docSeq = 0;
  h.rows.set(`papers/${P}`, seedPaper());
  h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "me", registrationNumber: "GJ01AB1234" });
});

describe("paper evidence staging guardrails", () => {
  it("signing failure during photo edit: rejects with zero writes and zero deletes", async () => {
    h.signFail = true;
    await expect(updateMyPaper.run(req("me", { paperId: P, contentType: "image/jpeg", contentMd5: MD5 }))).rejects.toBeDefined();
    const after = h.rows.get(`papers/${P}`);
    expect(after.status).toBe("VERIFIED");
    expect(after.evidencePath).toBe(OLD);
    expect(after.pendingEvidencePath).toBeUndefined();
    expect(h.storageDeleted).toEqual([]);
    expect(h.audit).toEqual([]);
  });

  it("photo edit stages pendingEvidencePath; old evidence and old object stay intact", async () => {
    const r: any = await updateMyPaper.run(req("me", { paperId: P, contentType: "image/jpeg", contentMd5: MD5 }));
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
    await updateMyPaper.run(req("me", { paperId: P, contentType: "image/jpeg", contentMd5: MD5 }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.pendingEvidencePath).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.jpg$`));
    expect(after.evidencePath).toBe(OLD);
    expect(h.storageDeleted).toEqual([FIRST]);
  });

  it("same-extension edits stage unique paths: never the live object, never each other", async () => {
    await updateMyPaper.run(req("me", { paperId: P, contentType: "image/webp", contentMd5: MD5 }));
    const first = h.rows.get(`papers/${P}`).pendingEvidencePath;
    expect(first).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.webp$`));
    expect(first).not.toBe(OLD); // the live evidence object is never the upload target
    expect(h.storageDeleted).toEqual([]);
    await updateMyPaper.run(req("me", { paperId: P, contentType: "image/webp", contentMd5: MD5 }));
    const second = h.rows.get(`papers/${P}`).pendingEvidencePath;
    expect(second).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.webp$`));
    expect(second).not.toBe(first); // two same-extension edits can never share a staging object
    expect(h.rows.get(`papers/${P}`).evidencePath).toBe(OLD);
    expect(h.storageDeleted).toEqual([first]); // only the abandoned staging is swept
  });

  it("finalize without pending (submit flow): behavior unchanged, no deletes", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", evidenceUrl: null }));
    h.meta.set(OLD, { md5Hash: MD5, size: 100, contentType: "image/webp" });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(OLD);
    expect(after.evidenceUrl).toBeNull(); // P4: no standing token URL is ever written
    expect(h.storageDeleted).toEqual([]);
  });

  it("finalize with pending + object present: promotes, clears pending, deletes old object", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", pendingEvidencePath: NEW }));
    h.meta.set(NEW, { md5Hash: MD5, size: 100, contentType: "image/jpeg" });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(NEW);
    expect(after.pendingEvidencePath).toBeNull();
    expect(after.evidenceUrl).toBeNull(); // P4: readers use getPrivateFileUrl instead of a standing token

    expect(h.storageDeleted).toEqual([OLD]);
  });

  it("lifecycle: old checked photo staged then PENDING-promoted -> new path pinned as uploaded-only, view NOT checked", async () => {
    // The old photo was CHECKED (its generation pinned); the staged replacement must not inherit that.
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", evidenceGeneration: "1730000000000001", uploadedGeneration: "1730000000000002", pendingEvidencePath: NEW }));
    h.meta.set(NEW, { md5Hash: MD5, size: 100, contentType: "image/jpeg" });
    await finalizeMyPaper.run(req("me", { paperId: P })); // default OCR -> PENDING
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(NEW); // promoted
    expect(after.evidenceGeneration).toBeNull(); // the OLD path's checked identity died with its path
    expect(after.uploadedGeneration).toBe("1730000000000123"); // the NEW path's observed generation, uploaded-only
    expect(after.pendingEvidencePath).toBeNull();
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
    h.meta.set(NEW, { md5Hash: MD5, size: 100, contentType: "image/jpeg" });
    // A newer edit lands after this finalize read the doc but before its transaction runs.
    h.beforeTx = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), pendingEvidencePath: NEWER, verificationReason: "Replacement photo pending; it replaces the current photo after the upload and checks finish. If it stays pending, edit and save again." });
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
    h.meta.set(NEW, { md5Hash: MD5, size: 100, contentType: "image/jpeg" });
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
    h.meta.set(OLD, { md5Hash: MD5, size: 100, contentType: "image/webp" });
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

describe("fresh ownership/identity re-checks inside the write transaction", () => {
  it("submit creates nothing when the vehicle was transferred between the pre-read and the transaction", async () => {
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "other", registrationNumber: "GJ01AB1234" });
    await expect(submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-1" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect([...h.rows.keys()].filter((k) => k.startsWith("papers/"))).toHaveLength(1); // only the seeded paper
  });
  it("submit creates nothing when the vehicle was archived between the pre-read and the transaction", async () => {
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { ...h.rows.get(`vehicles/${V}`), deletedAt: "2026-10-31T00:00:00.000Z" });
    await expect(submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-2" }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect([...h.rows.keys()].filter((k) => k.startsWith("papers/"))).toHaveLength(1);
  });
  it("update rejects when the vehicle was transferred between the pre-read and the transaction", async () => {
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "other", registrationNumber: "GJ01AB1234" });
    await expect(updateMyPaper.run(req("me", { paperId: P, reference: "GJ02CD5678" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.rows.get(`papers/${P}`).reference).toBe("GJ01AB1234");
    expect(h.audit).toEqual([]);
  });
  it("update rejects when the vehicle was archived between the pre-read and the transaction", async () => {
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { ...h.rows.get(`vehicles/${V}`), deletedAt: "2026-10-31T00:00:00.000Z" });
    await expect(updateMyPaper.run(req("me", { paperId: P, reference: "GJ02CD5678" }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.rows.get(`papers/${P}`).reference).toBe("GJ01AB1234");
  });
  it("update rejects when the paper record itself changed owner between the pre-read and the transaction", async () => {
    h.beforeTx = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), customerId: "other" });
    await expect(updateMyPaper.run(req("me", { paperId: P, reference: "GJ02CD5678" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.rows.get(`papers/${P}`).reference).toBe("GJ01AB1234");
  });
  it("finalize abstains when the vehicle was transferred after the pre-OCR ownership check, and discloses nothing to the former owner", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review" }));
    h.meta.set(OLD, { md5Hash: MD5, size: 100, contentType: "image/webp" });
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "other", registrationNumber: "GJ01AB1234" });
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "failed-precondition" });
    const after = h.rows.get(`papers/${P}`);
    expect(after.status).toBe("PENDING"); // the OCR decision was NOT written
    expect(h.audit).toEqual([]);
  });
  it("finalize abstains when the vehicle was archived after the pre-OCR ownership check", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review" }));
    h.meta.set(OLD, { md5Hash: MD5, size: 100, contentType: "image/webp" });
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { ...h.rows.get(`vehicles/${V}`), deletedAt: "2026-10-31T00:00:00.000Z" });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(h.rows.get(`papers/${P}`).status).toBe("PENDING");
    expect(h.audit).toEqual([]);
  });
});

describe("truthful finalize outcomes and delete-after-proof ordering", () => {
  // Text that decides VERIFIED for an INSURANCE document on the seeded vehicle (GJ01AB1234).
  const verifiedOcr = { text: "ACME INSURANCE policy. Vehicle GJ01AB1234. Valid until 31/12/2099.", confidence: 95 };
  const seedPendingInsurance = () => {
    h.rows.set(`papers/${P}`, seedPaper({ kind: "INSURANCE", reference: "POL-1", status: "PENDING", verificationMode: "review", reviewedBy: null, reviewedAt: null }));
    h.meta.set(OLD, { md5Hash: MD5, size: 100, contentType: "image/webp" });
  };

  it("a VERIFIED decision that is NOT committed (transfer mid-checks) is never returned: the former owner gets a generic failure, never the new owner's state", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "other", registrationNumber: "GJ01AB1234" });
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This document's checks could not be completed. Open the document to see its current state.",
    });
    const after = h.rows.get(`papers/${P}`);
    expect(after.status).toBe("PENDING"); // nothing was committed
    expect(after.reviewedBy).toBeNull();
    expect(h.storageDeleted).toEqual([]);
    expect(h.audit).toEqual([]);
  });

  it("a VERIFIED decision records the observed object generation as CHECKED evidence identity", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    const res = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(res.status).toBe("VERIFIED");
    expect(h.rows.get(`papers/${P}`).evidenceGeneration).toBe("1730000000000123");
    expect(h.rows.get(`papers/${P}`).uploadedGeneration).toBeNull(); // the other field is always cleared
  });

  it("a PENDING decision records the version as uploaded-only, never as checked", async () => {
    seedPendingInsurance(); // default OCR -> PENDING
    const res = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(res.status).toBe("PENDING");
    expect(h.rows.get(`papers/${P}`).uploadedGeneration).toBe("1730000000000123");
    expect(h.rows.get(`papers/${P}`).evidenceGeneration).toBeNull(); // the other field is always cleared
  });

  it("metadata without a generation fails closed: no unpinned check, no decision write", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    (h as any).noGeneration = true;
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.rows.get(`papers/${P}`).status).toBe("PENDING");
    expect(h.rows.get(`papers/${P}`).evidenceGeneration).toBeUndefined();
  });

  it("a stale pinned download (bytes swapped between metadata and download) fails closed, never a silent manual-review pass", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    // The swap lands AFTER the metadata read but BEFORE the download.
    (h as any).flipAfterMetadata = { [OLD]: "1730000000000999" };
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({
      code: "failed-precondition",
      message: "The uploaded photo's checked version is no longer available. Upload the photo again so its checks run against one current original.",
    });
    expect(h.rows.get(`papers/${P}`).status).toBe("PENDING"); // unchanged, no erased expiry
    expect(h.rows.get(`papers/${P}`).evidenceGeneration).toBeUndefined();
  });

  it("a replay whose stored bytes no longer match the recorded checked generation fails closed, never reports uploaded", async () => {
    const OP2 = "7a1b2c3d-4444-4222-8111-abcdefabcdef";
    const submit2 = () => submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-GEN-1", submissionId: OP2, contentType: "image/webp", contentMd5: MD5 }));
    const first = await submit2();
    const path = `t/vehicles/v1/paper-${first.id}.webp`;
    h.meta.set(path, { md5Hash: MD5, size: 100, contentType: "image/webp" });
    h.ocr = verifiedOcr;
    await finalizeMyPaper.run(req("me", { paperId: first.id })); // records evidenceGeneration 1730000000000123
    expect(h.rows.get(`papers/${first.id}`).evidenceGeneration).toBe("1730000000000123");
    (h as any).generationOverride = { [path]: "1730000000000999" }; // out-of-band overwrite AFTER the check
    const signedBefore = h.signed.length;
    await expect(submit2()).rejects.toMatchObject({ code: "aborted" });
    expect(h.signed.length).toBe(signedBefore); // no mint against replaced evidence
  });

  it("a VERIFIED decision abstained for a same-owner mid-check edit returns the truthful current state", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    // Same owner, but a replacement photo was staged (pendingEvidencePath) between the pre-read and the tx.
    h.beforeTx = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), pendingEvidencePath: `${T}/vehicles/${V}/paper-${P}.cafe01.jpg` });
    const res = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(res.status).toBe("PENDING"); // actual committed state, not the precomputed VERIFIED
    expect(res.reason).toMatch(/changed while/i);
    expect(h.rows.get(`papers/${P}`).status).toBe("PENDING");
    expect(h.audit).toEqual([]);
  });

  it("a VERIFIED decision that is NOT committed (archive mid-checks) is never returned", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { ...h.rows.get(`vehicles/${V}`), deletedAt: "2026-10-31T00:00:00.000Z" });
    const res = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(res.status).toBe("PENDING");
    expect(h.rows.get(`papers/${P}`).status).toBe("PENDING");
    expect(h.storageDeleted).toEqual([]);
  });

  it("a VERIFIED decision that IS committed still returns VERIFIED (regression guard)", async () => {
    seedPendingInsurance();
    h.ocr = verifiedOcr;
    const res = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(res.status).toBe("VERIFIED");
    expect(h.rows.get(`papers/${P}`).status).toBe("VERIFIED");
  });

  it("photo removal: the object survives a mid-save transfer and the edit is refused", async () => {
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "other", registrationNumber: "GJ01AB1234" });
    await expect(updateMyPaper.run(req("me", { paperId: P, removePhoto: true }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.storageDeleted).toEqual([]); // no bytes touched before owner/state proof
    expect(h.rows.get(`papers/${P}`).evidencePath).toBe(OLD);
  });

  it("photo removal: a committed removal deletes exactly the path the record released", async () => {
    await updateMyPaper.run(req("me", { paperId: P, removePhoto: true }));
    expect(h.rows.get(`papers/${P}`).evidencePath).toBeNull();
    expect(h.storageDeleted).toEqual([OLD]);
  });

  it("delete: a mid-delete transfer refuses, record and bytes and locks all survive", async () => {
    h.beforeTx = () => h.rows.set(`vehicles/${V}`, { tenantId: T, studioId: "s1", ownerId: "other", registrationNumber: "GJ01AB1234" });
    await expect(deleteMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.rows.has(`papers/${P}`)).toBe(true);
    expect(h.storageDeleted).toEqual([]);
  });

  it("delete: a concurrent photo change aborts with nothing deleted", async () => {
    const PROMOTED = `${T}/vehicles/${V}/paper-${P}.f00d0009.png`;
    h.beforeTx = () => h.rows.set(`papers/${P}`, { ...h.rows.get(`papers/${P}`), evidencePath: PROMOTED });
    await expect(deleteMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "aborted" });
    expect(h.rows.has(`papers/${P}`)).toBe(true);
    expect(h.storageDeleted).toEqual([]); // the freshly promoted bytes were never touched
  });

  it("delete: happy path deletes the record and exactly its own objects after commit", async () => {
    await deleteMyPaper.run(req("me", { paperId: P }));
    expect(h.rows.has(`papers/${P}`)).toBe(false);
    expect(h.storageDeleted).toEqual([OLD]);
  });
});

describe("submit replay: operation identity bound to the immutable snapshot", () => {
  const OP = "3b6f6c3e-2f6a-4c1a-9b7d-2d1f0a5c8e11";
  const submit = (over: any = {}) => submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-REPLAY-1", submissionId: OP, ...over }));
  const opKey = (op: string) => `paperLocks/op__t__me__${op}`;
  const paperRows = () => [...h.rows.keys()].filter((k) => k.startsWith("papers/") && k !== `papers/${P}`);

  it("creation writes the immutable submission snapshot and the operation lock", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5 });
    const rec = h.rows.get(`papers/${first.id}`);
    expect(rec.submission).toEqual({
      submissionId: OP, studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-REPLAY-1",
      title: null, issuedOn: null, expiresOn: null, contentType: "image/png", expectedContentMd5: MD5,
    });
    expect(h.rows.get(opKey(OP))).toEqual({ paperId: first.id, tenantId: "t", customerId: "me", vehicleId: "v1" });
  });

  it("a retry of the same submission returns the SAME record id with a fresh upload URL, never a second record", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5 });
    const second = await submit({ contentType: "image/png", contentMd5: MD5 });
    expect(second.id).toBe(first.id);
    expect(second.uploadUrl).toBe("https://signed.example/put");
    expect(second.photoState).toBe("awaiting_upload");
    expect(paperRows()).toHaveLength(1);
  });

  it("the same op id with different details conflicts instead of silently overwriting", async () => {
    await submit({ expiresOn: "2027-01-01" });
    await expect(submit({ expiresOn: "2028-06-30" })).rejects.toMatchObject({ code: "aborted" });
  });

  it("the same number under a different op id is a genuine duplicate", async () => {
    await submit();
    await expect(submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "pol-replay-1", submissionId: "9c2f8e4d-1111-4222-8333-abcdefabcdef" }))).rejects.toMatchObject({ code: "already-exists" });
  });

  it("a no-photo retry replays without an upload URL", async () => {
    const first = await submit();
    const second = await submit();
    expect(second.id).toBe(first.id);
    expect(second.uploadUrl).toBeNull();
    expect(second.photoState).toBe("none");
  });

  it("the same op id with a different photo type conflicts", async () => {
    await submit({ contentType: "image/png", contentMd5: MD5 });
    await expect(submit({ contentType: "image/jpeg", contentMd5: MD5 })).rejects.toMatchObject({ code: "aborted" });
  });

  it("concurrent first attempts of the same op id with different numbers: the op lock lets only one create and the loser conflicts, never a second record", async () => {
    const first = await submit({ reference: "POL-RACE-9", contentType: "image/png", contentMd5: MD5 });
    // Loser arrives after the winner committed, carrying a DIFFERENT number under the same op id.
    await expect(submit({ reference: "POL-RACE-10", contentType: "image/png", contentMd5: MD5 })).rejects.toMatchObject({ code: "aborted" });
    expect(paperRows()).toHaveLength(1); // exactly one record exists - the winner's
    expect(h.rows.get(`papers/${first.id}`).reference).toBe("POL-RACE-9");
  });

  it("concurrent first attempts of the same op id with the same number: the loser replays the winner's record", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5 });
    // Double-tap with identical payload: number claim collides in-tx, catch replays to the SAME record.
    const second = await submit({ contentType: "image/png", contentMd5: MD5 });
    expect(second.id).toBe(first.id);
    expect(paperRows()).toHaveLength(1);
  });

  it("replay against a record whose bytes already landed mints NO overwrite URL and reports uploaded", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5 });
    h.meta.set(`t/vehicles/v1/paper-${first.id}.png`, { md5Hash: MD5, size: 10, contentType: "image/png" });
    const signedBefore = h.signed.length;
    const second = await submit({ contentType: "image/png", contentMd5: MD5 });
    expect(second.id).toBe(first.id);
    expect(second.uploadUrl).toBeNull();
    expect(second.photoState).toBe("uploaded");
    expect(h.signed.length).toBe(signedBefore); // never an overwrite URL over landed evidence
  });

  it("replay against a decided (VERIFIED) record mints nothing and reports none", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5 });
    h.rows.set(`papers/${first.id}`, { ...h.rows.get(`papers/${first.id}`), status: "VERIFIED" });
    const signedBefore = h.signed.length;
    const second = await submit({ contentType: "image/png", contentMd5: MD5 });
    expect(second.id).toBe(first.id);
    expect(second.uploadUrl).toBeNull();
    expect(second.photoState).toBe("none");
    expect(h.signed.length).toBe(signedBefore);
  });

  it("an OCR-rewritten expiry does not break replay: comparison is against the immutable snapshot", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5, expiresOn: "2027-01-01" });
    // finalize wrote the OCR-derived expiry onto the mutable field
    h.rows.set(`papers/${first.id}`, { ...h.rows.get(`papers/${first.id}`), expiresOn: "2027-03-15", status: "VERIFIED" });
    const second = await submit({ contentType: "image/png", contentMd5: MD5, expiresOn: "2027-01-01" });
    expect(second.id).toBe(first.id); // the ORIGINAL submission still matches its snapshot
  });

  it("a superseded op id replays as a tombstone: failed-precondition, never a new record, history untouched", async () => {
    const first = await submit();
    h.rows.set(`papers/${first.id}`, { ...h.rows.get(`papers/${first.id}`), supersededAt: "2026-10-30T00:00:00.000Z" });
    await expect(submit()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(paperRows()).toHaveLength(1); // the old retry is NOT resurrected as a new record
    expect(h.rows.get(`papers/${first.id}`).supersededAt).toBe("2026-10-30T00:00:00.000Z"); // history untouched
  });

  it("a deleted record replays as a tombstone: the surviving op lock blocks recreation", async () => {
    const first = await submit();
    h.rows.delete(`papers/${first.id}`); // owner later deleted the document; the op lock survives
    await expect(submit()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(paperRows()).toHaveLength(0); // never recreated
  });

  it("replay re-gates ownership: a caller who no longer owns the car gets failed-precondition, no mint", async () => {
    await submit({ contentType: "image/png", contentMd5: MD5 });
    h.rows.set(`vehicles/${V}`, { ...h.rows.get(`vehicles/${V}`), ownerId: "new-owner" });
    const signedBefore = h.signed.length;
    await expect(submit({ contentType: "image/png", contentMd5: MD5 })).rejects.toMatchObject({ code: "permission-denied" });
    expect(h.signed.length).toBe(signedBefore);
  });

  it("a replay whose op lock carries a foreign identity fails closed, never returns or mints", async () => {
    const first = await submit({ contentType: "image/png", contentMd5: MD5 });
    h.rows.set(opKey(OP), { paperId: first.id, tenantId: "t", customerId: "someone-else", vehicleId: V });
    const signedBefore = h.signed.length;
    await expect(submit({ contentType: "image/png", contentMd5: MD5 })).rejects.toMatchObject({ code: "aborted" });
    expect(h.signed.length).toBe(signedBefore);
  });

  it("an archived car replays as failed-precondition with no mint", async () => {
    await submit({ contentType: "image/png", contentMd5: MD5 });
    h.rows.set(`vehicles/${V}`, { ...h.rows.get(`vehicles/${V}`), deletedAt: "2026-10-31T00:00:00.000Z" });
    const signedBefore = h.signed.length;
    await expect(submit({ contentType: "image/png", contentMd5: MD5 })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.signed.length).toBe(signedBefore);
  });
});

describe("content digest binding (mint-signed MD5 + finalize compare)", () => {
  it("a submit whose contentType lacks contentMd5 is refused at the schema", async () => {
    await expect(submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-NODIGEST", contentType: "image/webp" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(h.rows.size).toBe(2); // vehicle + seeded paper only: nothing created
  });

  it("finalize fails closed when the object's actual MD5 is not the approved digest - no commit, no delete", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", submission: { submissionId: "3b6f6c3e-2f6a-4c1a-9b7d-2d1f0a5c8e11", studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-1", title: null, issuedOn: null, expiresOn: null, contentType: "image/webp", expectedContentMd5: MD5 } }));
    h.meta.set(OLD, { size: 100, contentType: "image/webp", md5Hash: "differentdigestvalue00==" });
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "failed-precondition" });
    const after = h.rows.get(`papers/${P}`);
    expect(after.status).toBe("PENDING");
    expect(after.uploadedGeneration ?? null).toBeNull();
    expect(h.storageDeleted).toEqual([]);
  });

  it("a missing object MD5 with a recorded expectation fails closed too", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ status: "PENDING", verificationMode: "review", submission: { submissionId: "3b6f6c3e-2f6a-4c1a-9b7d-2d1f0a5c8e11", studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-1", title: null, issuedOn: null, expiresOn: null, contentType: "image/webp", expectedContentMd5: MD5 } }));
    h.meta.set(OLD, { size: 100, contentType: "image/webp" }); // no md5Hash on the object
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("a staged replacement's finalize compares against the edit's pending digest", async () => {
    await updateMyPaper.run(req("me", { paperId: P, reference: "GJ01AB1234", contentType: "image/jpeg", contentMd5: MD5 }));
    const staged = h.rows.get(`papers/${P}`);
    expect(staged.pendingContentMd5).toBe(MD5); // the digest rides with the staged path
    h.meta.set(staged.pendingEvidencePath, { size: 100, contentType: "image/jpeg", md5Hash: "wrongdigestvalue000000==" });
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.rows.get(`papers/${P}`).evidencePath).toBe(OLD); // nothing promoted
    h.meta.set(staged.pendingEvidencePath, { size: 100, contentType: "image/jpeg", md5Hash: MD5 });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBe(staged.pendingEvidencePath);
    expect(after.pendingContentMd5).toBeNull(); // cleared with the staging
  });
});

describe("digest blockers: replay compare, record-level expectation, create-only staging mint", () => {
  const OP2 = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
  const submitReq = (over: any = {}) => req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-DG-1", contentType: "image/webp", contentMd5: MD5, submissionId: OP2, ...over });

  it("a same-op retry carrying DIFFERENT bytes (same MIME, different digest) conflicts before any return or mint", async () => {
    const first: any = await submitMyPaper.run(submitReq());
    expect(first.uploadUrl).toBeTruthy();
    // absent bytes: retry with a different digest -> conflict, no mint
    await expect(submitMyPaper.run(submitReq({ contentMd5: "Uonfc331cyb83SJZevsfrA==" }))).rejects.toMatchObject({ code: "aborted" });
    // uploaded bytes: same conflict, and no overwrite URL is ever minted
    const path = h.rows.get(`papers/${first.id}`).evidencePath;
    h.meta.set(path, { size: 10, contentType: "image/webp", md5Hash: MD5 });
    await expect(submitMyPaper.run(submitReq({ contentMd5: "Uonfc331cyb83SJZevsfrA==" }))).rejects.toMatchObject({ code: "aborted" });
    // checked record: same conflict
    h.ocr = { text: "ACME INSURANCE policy. Vehicle GJ01AB1234. Valid until 31/12/2099.", confidence: 95 };
    await finalizeMyPaper.run(req("me", { paperId: first.id }));
    expect(h.rows.get(`papers/${first.id}`).status).toBe("VERIFIED");
    await expect(submitMyPaper.run(submitReq({ contentMd5: "Uonfc331cyb83SJZevsfrA==" }))).rejects.toMatchObject({ code: "aborted" });
    expect([...h.rows.keys()].filter((k) => k.startsWith("papers/"))).toHaveLength(2); // seeded + first only
  });

  it("a matching-digest replay re-mints with the digest signed in, and the record carries the expectation", async () => {
    const first: any = await submitMyPaper.run(submitReq());
    expect(first.requiredHeaders["Content-MD5"]).toBe(MD5);
    expect(first.requiredHeaders["x-goog-if-generation-match"]).toBe("0");
    expect(h.rows.get(`papers/${first.id}`).expectedContentMd5).toBe(MD5); // record-level, snapshot-independent
    const replay: any = await submitMyPaper.run(submitReq());
    expect(replay.replayed).toBe(true);
    expect(replay.requiredHeaders["Content-MD5"]).toBe(MD5); // replay mint keeps the SAME binding
  });

  it("a submit WITHOUT an op id still binds the digest on the record and finalize enforces it", async () => {
    const noOp: any = await submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-NOOP-1", contentType: "image/webp", contentMd5: MD5 }));
    const rec = h.rows.get(`papers/${noOp.id}`);
    expect(rec.submission).toBeNull(); // no snapshot exists without an op id
    expect(rec.expectedContentMd5).toBe(MD5); // the expectation is persisted independently
    h.meta.set(rec.evidencePath, { size: 10, contentType: "image/webp", md5Hash: "wrongdigestvalue000000==" });
    await expect(finalizeMyPaper.run(req("me", { paperId: noOp.id }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect(h.rows.get(`papers/${noOp.id}`).status).toBe("PENDING"); // nothing committed
  });

  it("the staging mint is create-only and promotion swaps the staged digest in as the evidence expectation", async () => {
    const edit: any = await updateMyPaper.run(req("me", { paperId: P, reference: "GJ01AB1234", contentType: "image/jpeg", contentMd5: MD5 }));
    expect(edit.requiredHeaders["x-goog-if-generation-match"]).toBe("0"); // never overwrites, even post-promotion
    expect(edit.requiredHeaders["Content-MD5"]).toBe(MD5);
    const staged = h.rows.get(`papers/${P}`);
    h.meta.set(staged.pendingEvidencePath, { size: 100, contentType: "image/jpeg", md5Hash: MD5 });
    await finalizeMyPaper.run(req("me", { paperId: P }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.expectedContentMd5).toBe(MD5); // the staged digest is now the evidence's expectation
    expect(after.pendingContentMd5).toBeNull();
  });

  it("removing the photo clears the evidence expectation with the path", async () => {
    h.rows.set(`papers/${P}`, seedPaper({ expectedContentMd5: MD5 }));
    await updateMyPaper.run(req("me", { paperId: P, reference: "GJ01AB1234", removePhoto: true }));
    const after = h.rows.get(`papers/${P}`);
    expect(after.evidencePath).toBeNull();
    expect(after.expectedContentMd5).toBeNull();
  });
});

describe("delta: the CURRENT path's expectation beats the original snapshot after promotion", () => {
  it("op-created A -> replacement B promoted PENDING -> a no-pending finalize of B checks B's hash, never A's", async () => {
    const MD5_A = MD5, MD5_B = "B8mUN2D4JyU5jCp33Tm5Lw==";
    // A: created through a real op (immutable snapshot holds A's digest forever).
    const first: any = await submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-DELTA-1", contentType: "image/webp", contentMd5: MD5_A, submissionId: "0f8fad5b-9d3c-4c4e-9f2a-2a3b4c5d6e70" }));
    const aPath = h.rows.get(`papers/${first.id}`).evidencePath;
    h.meta.set(aPath, { size: 10, contentType: "image/webp", md5Hash: MD5_A });
    await finalizeMyPaper.run(req("me", { paperId: first.id })); // default OCR -> PENDING, A uploaded-only
    // B: staged replacement with its own digest, promoted PENDING.
    await updateMyPaper.run(req("me", { paperId: first.id, reference: "POL-DELTA-1", contentType: "image/jpeg", contentMd5: MD5_B }));
    const bPath = h.rows.get(`papers/${first.id}`).pendingEvidencePath;
    h.meta.set(bPath, { size: 10, contentType: "image/jpeg", md5Hash: MD5_B });
    await finalizeMyPaper.run(req("me", { paperId: first.id }));
    const promoted = h.rows.get(`papers/${first.id}`);
    expect(promoted.evidencePath).toBe(bPath);
    expect(promoted.expectedContentMd5).toBe(MD5_B); // current path's expectation
    expect(promoted.submission.expectedContentMd5).toBe(MD5_A); // the snapshot is immutable history
    expect(promoted.status).toBe("PENDING");
    // Retry finalize of B (no pending): must compare against B's hash and pass, not fail against A's.
    await finalizeMyPaper.run(req("me", { paperId: first.id }));
    expect(h.rows.get(`papers/${first.id}`).status).toBe("PENDING"); // no fail-closed against the stale snapshot hash
    // A replay of the ORIGINAL op (A's MIME, A's digest) is stale after B replaced it: refused
    // by the existing stored-differently guard - critically it NEVER mints an overwrite over B.
    await expect(submitMyPaper.run(req("me", { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-DELTA-1", contentType: "image/webp", contentMd5: MD5_A, submissionId: "0f8fad5b-9d3c-4c4e-9f2a-2a3b4c5d6e70" }))).rejects.toMatchObject({ code: "aborted" });
    expect(h.rows.get(`papers/${first.id}`).evidencePath).toBe(bPath); // untouched
  });
});

describe("reviewer qualifications: explicit-null expectation, same-MIME original-op replay", () => {
  it("an explicit null expectation means NO compare; only an ABSENT field falls back to the snapshot", async () => {
    // Explicit null on the record: no expectation for this path, even though the immutable
    // snapshot still carries the original upload's digest.
    h.rows.set(`papers/${P}`, seedPaper({
      status: "PENDING", verificationMode: "review", expectedContentMd5: null,
      submission: { submissionId: "3b6f6c3e-2f6a-4c1a-9b7d-2d1f0a5c8e11", studioId: "s1", vehicleId: V, kind: "RC", reference: "GJ01AB1234", title: null, issuedOn: null, expiresOn: null, contentType: "image/webp", expectedContentMd5: "zzzzzzzzzzzzzzzzzzzzzz==" },
    }));
    h.meta.set(OLD, { size: 100, contentType: "image/webp", md5Hash: MD5 }); // != the snapshot's old hash
    const res: any = await finalizeMyPaper.run(req("me", { paperId: P }));
    expect(res.status).toBe("PENDING"); // no compare ran: explicit null is authoritative
    // Absent field: the snapshot fallback applies and a mismatch fails closed.
    const rec2 = seedPaper({ status: "PENDING", verificationMode: "review",
      submission: { submissionId: "3b6f6c3e-2f6a-4c1a-9b7d-2d1f0a5c8e11", studioId: "s1", vehicleId: V, kind: "RC", reference: "GJ01AB1234", title: null, issuedOn: null, expiresOn: null, contentType: "image/webp", expectedContentMd5: "zzzzzzzzzzzzzzzzzzzzzz==" } });
    delete rec2.expectedContentMd5; // pre-field record shape
    h.rows.set(`papers/${P}`, rec2);
    await expect(finalizeMyPaper.run(req("me", { paperId: P }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("same-MIME original-op replay after a staged replacement: bytes present -> uploaded (finalizes B); bytes missing -> NO re-mint over B's path", async () => {
    const MD5_A = MD5, MD5_B = "B8mUN2D4JyU5jCp33Tm5Lw==";
    const opData = { studioId: "s1", vehicleId: V, kind: "INSURANCE", reference: "POL-SAME-1", contentType: "image/webp", contentMd5: MD5_A, submissionId: "1c02b3c8-6a3f-4d2a-9a1b-5e6f7a8b9c0d" };
    const first: any = await submitMyPaper.run(req("me", opData));
    // B: a same-MIME staged replacement (suffixed path), bytes land, promoted PENDING.
    await updateMyPaper.run(req("me", { paperId: first.id, reference: "POL-SAME-1", contentType: "image/webp", contentMd5: MD5_B }));
    const bPath = h.rows.get(`papers/${first.id}`).pendingEvidencePath as string;
    expect(bPath).not.toBe(`${V && ""}${`t/vehicles/${V}/paper-${first.id}.webp`}`); // suffixed, not the op path
    h.meta.set(bPath, { size: 10, contentType: "image/webp", md5Hash: MD5_B });
    await finalizeMyPaper.run(req("me", { paperId: first.id }));
    expect(h.rows.get(`papers/${first.id}`).evidencePath).toBe(bPath);
    // Original op replay, B's bytes present: "uploaded" - the client finalizes B's CURRENT path.
    const replay1: any = await submitMyPaper.run(req("me", opData));
    expect(replay1).toMatchObject({ replayed: true, photoState: "uploaded", uploadUrl: null });
    await finalizeMyPaper.run(req("me", { paperId: first.id })); // finalizes B against B's digest: passes
    expect(h.rows.get(`papers/${first.id}`).evidencePath).toBe(bPath);
    // B's object now goes missing: the original op must NOT mint over B's path.
    h.meta.delete(bPath);
    const replay2: any = await submitMyPaper.run(req("me", opData));
    expect(replay2).toMatchObject({ replayed: true, photoState: "none", uploadUrl: null });
    expect(h.rows.get(`papers/${first.id}`).evidencePath).toBe(bPath); // record untouched, nothing restored
  });
});
