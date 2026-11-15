/* eslint-disable @typescript-eslint/no-explicit-any */
/** ONE shared sequence across all three functions: old checked photo -> edit stages a
 * replacement -> new bytes uploaded -> finalize PENDING promotes -> the reader before and
 * after. No separately seeded slices: every step runs against the state the previous step
 * committed. The reader must pin the OLD checked generation before promotion, and pin the
 * NEW observed uploaded generation after - with the view NEVER presented as checked. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  audit: [] as any[],
  storageDeleted: [] as string[],
  meta: new Map<string, { size: number; contentType: string; md5Hash?: string }>(),
  generations: new Map<string, string>(),
  ocr: { text: "GJ 01 AB 1234", confidence: 20 } as { text: string; confidence: number },
  docSeq: 0,
}));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: any, p: any) => h.audit.push(p) }));
vi.mock("../../lib/paper-ocr.js", () => ({ readPaperImage: async () => h.ocr }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      name: "bucket.appspot.com",
      // The seam mirrors production: the generation rides on the FILE HANDLE, and a pinned
      // handle whose version is not live behaves like real GCS without versioning: 404.
      file: (p: string, opts?: { generation?: string | number }) => {
        const pinned = (opts?.generation !== null && opts?.generation !== undefined) ? String(opts.generation) : null;
        const live = () => h.generations.get(p) ?? null;
        const stale = () => pinned !== null && pinned !== live();
        return {
          bucket: { name: "bucket.appspot.com" },
          delete: async () => { h.storageDeleted.push(p); h.meta.delete(p); h.generations.delete(p); },
          getSignedUrl: async () => [`https://signed.example/${p}${pinned ? `?generation=${pinned}` : ""}`],
          getMetadata: async () => {
            const m = h.meta.get(p);
            if (!m || stale()) throw Object.assign(new Error("No such object"), { code: 404 });
            return [{ size: m.size, contentType: m.contentType, md5Hash: m.md5Hash, generation: live(), metadata: {} }];
          },
          exists: async () => [h.meta.has(p) && !stale()],
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
  const docRef = (path: string) => ({ id: path.split("/").pop(), path, get: async () => ({ id: path.split("/").pop(), exists: h.rows.has(path), data: () => h.rows.get(path) }) });
  const query = (col: string, filters: Array<[string, unknown]>, cap = Infinity): any => ({
    where: (f: string, op: string, v: unknown) => { if (op !== "==") throw Error("Unsupported query operator"); return query(col, [...filters, [f, v]], cap); },
    limit: (n: number) => query(col, filters, n),
    get: async () => ({ docs: [...h.rows.entries()].filter(([k, r]) => k.startsWith(col + "/") && k.split("/").length === 2 && filters.every(([f, v]) => r[f] === v)).slice(0, cap).map(([k, r]) => ({ id: k.split("/").pop(), data: () => r })) }),
  });
  return { getFirestore: () => ({
    collection: (c: string) => ({ doc: (id?: string) => docRef(`${c}/${id ?? `auto-${++h.docSeq}`}`), where: (f: string, o: string, v: unknown) => query(c, []).where(f, o, v) }),
    runTransaction: async (fn: any) => {
      const ops: Array<["set" | "update" | "delete", string, any?]> = [];
      await fn({
        get: async (r: any) => ({ id: r.id, exists: h.rows.has(r.path), data: () => h.rows.get(r.path) }),
        set: (r: any, d: any) => { ops.push(["set", r.path, d]); },
        update: (r: any, d: any) => { ops.push(["update", r.path, d]); },
        delete: (r: any) => { ops.push(["delete", r.path]); },
      });
      for (const [op, path, d] of ops) {
        if (op === "set") h.rows.set(path, d);
        else if (op === "update") h.rows.set(path, { ...h.rows.get(path), ...d });
        else h.rows.delete(path);
      }
    },
  }) };
});
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { papers: () => "papers", vehicles: () => "vehicles", auditLog: () => "audit", customers: () => "customers" } }));
import { updateMyPaper } from "../../functions/papers/myPaperEdits.js";
import { finalizeMyPaper } from "../../functions/papers/submitMyPaper.js";
import { getPrivateFileUrl } from "../../functions/files/getPrivateFileUrl.js";

const T = "t", V = "v1", P = "p1", ME = "me";
const OLD = `${T}/vehicles/${V}/paper-${P}.webp`;
const G_OLD = "1730000000000001";
const G_NEW = "1730000000000777";
const req = (uid: string, data: any): any => ({ data, auth: { uid, token: { role: "customer", tenantId: T } } });

beforeEach(() => {
  h.rows.clear(); h.audit.length = 0; h.storageDeleted.length = 0; h.meta.clear(); h.generations.clear();
  h.rows.set(`customers/${ME}`, { id: ME, authUid: ME, tenantId: T });
  h.rows.set(`vehicles/${V}`, { ownerId: ME, tenantId: T });
  // A real checked record: VERIFIED, evidence pinned to the observed generation of OLD.
  h.rows.set(`papers/${P}`, {
    id: P, tenantId: T, studioId: "s", vehicleId: V, customerId: ME, kind: "INSURANCE", reference: "POL-1",
    status: "VERIFIED", verificationMode: "auto", submittedBy: "customer", evidencePath: OLD, evidenceUrl: null,
    evidenceGeneration: G_OLD, uploadedGeneration: null, pendingEvidencePath: null,
  });
  h.meta.set(OLD, { size: 100, contentType: "image/webp" });
  h.generations.set(OLD, G_OLD);
});

describe("one shared sequence: checked -> staged -> promoted pending -> reader, end to end", () => {
  it("old pinned before, new exact version readable after, never checked", async () => {
    // 1. Before anything changes: the reader pins the CHECKED generation of the old path.
    const before: any = await getPrivateFileUrl.run(req(ME, { kind: "paper", id: P }));
    expect(before.url).toBe(`https://signed.example/${OLD}?generation=${G_OLD}`);

    // 2. The owner stages a replacement. The old photo stays the live, checked evidence.
    await updateMyPaper.run(req(ME, { paperId: P, reference: "POL-1", contentType: "image/jpeg", contentMd5: "A7mUN2D4JyU5jCp33Tm5Lw==" }));
    const staged = h.rows.get(`papers/${P}`);
    expect(staged.evidencePath).toBe(OLD);
    expect(staged.evidenceGeneration).toBe(G_OLD); // binding intact while the path lives
    const NEW = staged.pendingEvidencePath as string;
    expect(NEW).toMatch(new RegExp(`^${T}/vehicles/${V}/paper-${P}\\.[0-9a-f]{8}\\.jpg$`));

    // 3. During staging the reader STILL opens the old checked version, never a staged path.
    const during: any = await getPrivateFileUrl.run(req(ME, { kind: "paper", id: P }));
    expect(during.url).toBe(`https://signed.example/${OLD}?generation=${G_OLD}`);

    // 4. The new bytes land (observed generation G_NEW), then finalize decides PENDING.
    h.meta.set(NEW, { size: 120, contentType: "image/jpeg", md5Hash: "A7mUN2D4JyU5jCp33Tm5Lw==" });
    h.generations.set(NEW, G_NEW);
    const res: any = await finalizeMyPaper.run(req(ME, { paperId: P }));
    expect(res.status).toBe("PENDING");
    const after = h.rows.get(`papers/${P}`);
    expect(after.status).toBe("PENDING"); // NOT checked
    expect(after.evidencePath).toBe(NEW);
    expect(after.evidenceGeneration).toBeNull(); // the old checked identity died with its path
    expect(after.uploadedGeneration).toBe(G_NEW); // the new path pinned as uploaded-only
    expect(after.pendingEvidencePath).toBeNull();

    // 5. After promotion the reader pins the NEW exact uploaded version - still not checked.
    const readAfter: any = await getPrivateFileUrl.run(req(ME, { kind: "paper", id: P }));
    expect(readAfter.url).toBe(`https://signed.example/${NEW}?generation=${G_NEW}`);

    // 6. If the promoted object were ever replaced, the reader refuses with NOT-checked wording.
    h.generations.set(NEW, "1730000000000999");
    await expect(getPrivateFileUrl.run(req(ME, { kind: "paper", id: P }))).rejects.toMatchObject({
      code: "failed-precondition",
      message: "The uploaded photo is not the one this record received. It has not been checked; ask the customer to upload the document again.",
    });
  });
});
