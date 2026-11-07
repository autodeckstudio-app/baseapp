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
        where: (field: string, op: string, value: any) => {
          h.wheres.push([field, op, value]);
          if (field === "state" && op === "in") q._states = value;
          if (field === "state" && op === "==") q._states = [value];
          return q;
        },
        limit: () => q,
        count: () => ({ get: async () => ({ data: () => ({ count: h.publishedCount }) }) }),
        get: async () => {
          const docs = q._states ? h.docs.filter((d) => q._states.includes(d.state)) : h.docs;
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

  it("still rejects non-admin callers", async () => {
    await expect(getCatalogueDrafts.run(req("accountant"))).rejects.toMatchObject({ code: "permission-denied" });
  });
});
