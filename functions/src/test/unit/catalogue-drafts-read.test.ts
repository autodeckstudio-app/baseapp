/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, it, expect, vi } from "vitest";

// Records the query shape and serves seeded draft docs per state.
const h = vi.hoisted(() => ({
  docs: [] as any[],
  wheres: [] as any[],
  publishedCount: 0,
}));

vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "owner" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => {
      const q: any = {
        _states: null as string[] | null,
        _limit: 1000,
        _after: null as string | null,
        where: (field: string, op: string, value: any) => {
          h.wheres.push([field, op, value]);
          if (field === "state" && op === "in") q._states = value;
          if (field === "state" && op === "==") q._states = [value];
          return q;
        },
        orderBy: () => q,
        startAfter: (u: string, id?: string) => { q._after = [u, id]; return q; },
        limit: (n: number) => { q._limit = n; return q; },
        count: () => ({ get: async () => ({ data: () => ({ count: h.publishedCount }) }) }),
        get: async () => {
          let docs = q._states ? h.docs.filter((d) => q._states.includes(d.state)) : h.docs;
          docs = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
          if (q._after) { const [u, id] = q._after; docs = docs.filter((d) => d.updatedAt < u || (d.updatedAt === u && id !== undefined && d.id < id)); }
          docs = docs.slice(0, q._limit);
          return { size: docs.length, docs: docs.map((d) => ({ data: () => d })) };
        },
      };
      return q;
    },
  }),
}));

import { getCatalogueDrafts } from "../../functions/service/catalogueDrafts.js";

const req = (role = "admin"): any => ({ data: {}, auth: { uid: "a", token: { role, tenantId: "t", studioId: null }, rawToken: "x" } });
const draft = (id: string, state: string, updatedAt = "2026-11-01T00:00:00.000Z") => ({ id, tenantId: "t", state, updatedAt, payload: { name: id }, version: 1 });

beforeEach(() => { h.docs = []; h.wheres = []; h.publishedCount = 0; });

describe("getCatalogueDrafts read split", () => {
  it("returns actionable drafts plus the preserved published-history count, without throwing over accumulated history", async () => {
    h.docs = [
      ...Array.from({ length: 118 }, (_, i) => draft(`pub-${i}`, "published")),
      draft("a1", "draft", "2026-11-06T00:00:00.000Z"),
      draft("a2", "draft", "2026-11-07T00:00:00.000Z"),
      draft("a3", "reviewed"),
      draft("a4", "blocked"),
    ];
    h.publishedCount = 118;
    const res: any = await getCatalogueDrafts.run(req());
    expect(res.drafts.map((d: any) => d.id).sort()).toEqual(["a1", "a2", "a3", "a4"]);
    expect(res.publishedCount).toBe(118);
    expect(h.wheres).toContainEqual(["state", "in", ["draft", "reviewed", "publishing", "blocked"]]);
    // newest actionable first
    expect(res.drafts[0].id).toBe("a2");
  });

  it("keeps the protective cap for actionable drafts", async () => {
    h.docs = Array.from({ length: 101 }, (_, i) => draft(`d-${i}`, "draft"));
    await expect(getCatalogueDrafts.run(req())).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("serves bounded cursor-paged published history without touching the actionable read", async () => {
    h.docs = Array.from({ length: 30 }, (_, i) => draft(`p-${String(i).padStart(2, "0")}`, "published", `2026-10-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`));
    h.docs.push(draft("a1", "draft", "2026-11-07T00:00:00.000Z"));
    h.publishedCount = 30;
    const page1: any = await getCatalogueDrafts.run({ data: { history: true }, auth: { uid: "a", token: { role: "admin", tenantId: "t", studioId: null }, rawToken: "x" } });
    expect(page1.drafts).toEqual([]);
    expect(page1.history).toHaveLength(25);
    expect(page1.nextHistoryCursor).toBeTruthy();
    expect(page1.publishedCount).toBe(30);
    const page2: any = await getCatalogueDrafts.run({ data: { history: true, historyCursor: page1.nextHistoryCursor }, auth: { uid: "a", token: { role: "admin", tenantId: "t", studioId: null }, rawToken: "x" } });
    expect(page2.history.length).toBe(5);
    expect(page2.nextHistoryCursor).toBeNull();
    const overlap = page1.history.map((d: any) => d.id).filter((id: string) => page2.history.some((d: any) => d.id === id));
    expect(overlap).toEqual([]);
  });

  it("cursor is deterministic across a boundary tie (all rows share one updatedAt)", async () => {
    h.docs = Array.from({ length: 30 }, (_, i) => draft(`tie-${String(i).padStart(2, "0")}`, "published", "2026-11-07T16:23:59.913Z"));
    h.publishedCount = 30;
    const auth = { uid: "a", token: { role: "admin", tenantId: "t", studioId: null }, rawToken: "x" };
    const p1: any = await getCatalogueDrafts.run({ data: { history: true }, auth });
    expect(p1.history).toHaveLength(25);
    expect(p1.nextHistoryCursor).toContain("#");
    const p2: any = await getCatalogueDrafts.run({ data: { history: true, historyCursor: p1.nextHistoryCursor }, auth });
    expect(p2.history).toHaveLength(5);
    expect(p2.nextHistoryCursor).toBeNull();
    const ids1 = p1.history.map((d: any) => d.id);
    const ids2 = p2.history.map((d: any) => d.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
    expect([...ids1, ...ids2].sort()).toEqual(h.docs.map((d) => d.id).sort());
  });

  it("rejects unknown input keys (strict schema)", async () => {
    await expect(getCatalogueDrafts.run({ data: { history: true, bogus: 1 }, auth: { uid: "a", token: { role: "admin", tenantId: "t", studioId: null }, rawToken: "x" } })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("still rejects non-admin callers", async () => {
    await expect(getCatalogueDrafts.run(req("accountant"))).rejects.toMatchObject({ code: "permission-denied" });
  });
});
