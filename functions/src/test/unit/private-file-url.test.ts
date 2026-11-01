/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  metaError: null as null | { code?: number },
  existsError: null as null | { code?: number },
  existsValue: true,
  generation: "1730000000000123",
  fileCalls: [] as Array<{ path: string; opts?: any }>,
}));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "me" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const docRef = (path: string) => ({ id: path.split("/").pop(), path, get: async () => ({ id: path.split("/").pop(), exists: h.rows.has(path), data: () => h.rows.get(path) }) });
  return { getFirestore: () => ({ collection: (c: string) => ({ doc: (id: string) => docRef(`${c}/${id}`) }) }) };
});
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: (path: string, opts?: any) => {
    h.fileCalls.push({ path, opts });
    return {
      getMetadata: async () => { if (h.metaError) throw h.metaError; return [{ generation: h.generation }]; },
      exists: async () => { if (h.existsError) throw h.existsError; return [h.existsValue]; },
      getSignedUrl: async () => [`https://signed.example/read/${path}${opts?.generation ? `?generation=${opts.generation}` : ""}`],
    };
  } }) }) }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { papers: () => "papers", vehicles: () => "vehicles", customers: () => "customers" } }));
import { getPrivateFileUrl } from "../../functions/files/getPrivateFileUrl.js";

const T = "t", V = "v1", P = "p1";
const PATH = `${T}/vehicles/${V}/paper-${P}.jpg`;
const req = (uid: string, data: any, role = "customer"): any => ({ data, auth: { uid, token: { role, tenantId: T } } });
const seed = (paperOver: any = {}, vehicleOver: any = {}) => {
  h.rows.set(`papers/${P}`, { id: P, tenantId: T, customerId: "me", vehicleId: V, kind: "INSURANCE", status: "VERIFIED", evidencePath: PATH, evidenceGeneration: "1730000000000123", ...paperOver });
  h.rows.set(`vehicles/${V}`, { ownerId: "me", tenantId: T, ...vehicleOver });
};
beforeEach(() => {
  h.rows.clear(); h.fileCalls.length = 0; h.metaError = null; h.existsError = null; h.existsValue = true; h.generation = "1730000000000123";
});

describe("paper branch: fresh vehicle proof, prefix binding, error taxonomy, pinned read", () => {
  it("happy path: the read URL is pinned to the record's checked generation", async () => {
    seed();
    const r: any = await getPrivateFileUrl.run(req("me", { kind: "paper", id: P }));
    expect(r.url).toContain(`generation=1730000000000123`);
    expect(h.fileCalls.some((c) => c.opts?.generation === "1730000000000123")).toBe(true);
  });

  it("a former owner with a stale record can no longer mint a read", async () => {
    seed({}, { ownerId: "other" }); // transferred after the record was written
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("an archived car refuses, even for the current owner", async () => {
    seed({}, { deletedAt: "2026-10-01T00:00:00Z" });
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("a missing car refuses, even for the current owner", async () => {
    seed(); h.rows.delete(`vehicles/${V}`);
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("a stored path outside the record's own prefix refuses", async () => {
    seed({ evidencePath: `${T}/vehicles/${V}/paper-other9.jpg` });
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("a non-404 metadata failure is unavailable, never not-found", async () => {
    seed(); h.metaError = { code: 500 };
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "unavailable" });
    h.metaError = { code: 403 };
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "unavailable" });
  });

  it("a 404 metadata failure is not-found", async () => {
    seed(); h.metaError = { code: 404 };
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "not-found" });
  });

  it("a live generation that no longer matches the checked generation refuses", async () => {
    seed(); h.generation = "1730000000000999";
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("without a checked generation the read falls back to an existence check on the exact path", async () => {
    seed({ evidenceGeneration: null }); h.existsValue = true;
    const r: any = await getPrivateFileUrl.run(req("me", { kind: "paper", id: P }));
    expect(r.url).toBe(`https://signed.example/read/${PATH}`);
    h.existsValue = false;
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "not-found" });
    h.existsValue = true; h.existsError = { code: 500 };
    await expect(getPrivateFileUrl.run(req("me", { kind: "paper", id: P }))).rejects.toMatchObject({ code: "unavailable" });
  });
});
