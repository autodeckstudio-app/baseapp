import { describe, it, expect, vi, beforeEach } from "vitest";

type Listener = { q: { status?: string; limited?: boolean }; ok: (s: unknown) => void; err: (e: Error) => void; stopped: boolean };
const listeners: Listener[] = [];
const authState = { currentUser: { uid: "u1" } as { uid: string } | null };
vi.mock("firebase/firestore", () => ({
  collection: () => ({}), doc: () => ({}), getDoc: vi.fn(), orderBy: () => ({ o: 1 }), limit: () => ({ l: 1 }),
  where: (f: string, _op: string, v: string) => ({ f, v }),
  query: (_c: unknown, ...parts: any[]) => ({ status: parts.find((p) => p.f === "status")?.v, limited: parts.some((p) => p.l) }),
  onSnapshot: (q: any, ok: any, err: any) => { const l: Listener = { q, ok, err, stopped: false }; listeners.push(l); return () => { l.stopped = true; }; },
}));
vi.mock("./firebase", () => ({ db: {}, auth: authState }));
vi.mock("@autodeck/database", () => ({ COLLECTIONS: { jobs: () => "jobs", warranties: () => "w", inspections: () => "i", auditLog: () => "a" } }));

const snap = (...jobs: any[]) => ({ docs: jobs.map((j) => ({ data: () => j })) });
const J = (id: string, status: string, createdAt = "2026-10-28") => ({ id, status, createdAt });
const fresh = async () => { vi.resetModules(); listeners.length = 0; return (await import("./jobs-service")).listenToJobs; };
const feedAll = (recent: any[], byStatus: Record<string, any[]> = {}) => {
  listeners.forEach((l) => { if (l.q.limited) l.ok(snap(...recent)); else l.ok(snap(...(byStatus[l.q.status!] ?? []))); });
};
beforeEach(() => { authState.currentUser = { uid: "u1" }; });

describe("listenToJobs hub", () => {
  it("opens 7 listeners once for several screens, and closes all after the last unsubscribe", async () => {
    const listen = await fresh();
    const a = vi.fn(), b = vi.fn();
    const u1 = listen("t1", a, vi.fn()), u2 = listen("t1", b, vi.fn());
    expect(listeners).toHaveLength(7);
    feedAll([J("x", "DELIVERED")], { IN_PROGRESS: [J("old", "IN_PROGRESS", "2026-01-01")] });
    expect(a.mock.calls.at(-1)![0].map((j: any) => j.id)).toEqual(["x", "old"]);
    u1(); expect(listeners.every((l) => !l.stopped)).toBe(true);
    u2(); expect(listeners.every((l) => l.stopped)).toBe(true);
    u2(); // double unsubscribe is harmless
  });
  it("does not emit until every feed answered", async () => {
    const listen = await fresh(); const a = vi.fn(); listen("t1", a, vi.fn());
    listeners.filter((l) => l.q.limited).forEach((l) => l.ok(snap(J("x", "DELIVERED"))));
    expect(a).not.toHaveBeenCalled();
  });
  it("late subscriber gets a copy; mutating it does not touch others", async () => {
    const listen = await fresh(); const a = vi.fn(), b = vi.fn(); listen("t1", a, vi.fn());
    feedAll([J("x", "DELIVERED")]); listen("t1", b, vi.fn());
    const got = b.mock.calls[0]![0]; got.length = 0;
    expect(a.mock.calls.at(-1)![0]).toHaveLength(1);
    expect(listeners).toHaveLength(7);
  });
  it("one failing status keeps the rest, is cleared, and the note names only that status truthfully", async () => {
    const listen = await fresh(); const a = vi.fn(), n = vi.fn(); listen("t1", a, vi.fn(), n);
    feedAll([J("x", "DELIVERED")], { QUALITY_CHECK: [J("q", "QUALITY_CHECK")], IN_PROGRESS: [J("p", "IN_PROGRESS")] });
    listeners.find((l) => l.q.status === "IN_PROGRESS")!.err(new Error("boom"));
    expect(a.mock.calls.at(-1)![0].map((j: any) => j.id).sort()).toEqual(["q", "x"]);
    const note = n.mock.calls.at(-1)![0] as string;
    expect(note).toContain("IN_PROGRESS"); expect(note).not.toContain("QUALITY_CHECK"); expect(note).toMatch(/older than the newest 300/);
    listeners.filter((l) => l.q.status === "IN_PROGRESS").at(-1)!.ok(snap(J("p", "IN_PROGRESS"))); // recovery
    expect(n.mock.calls.at(-1)![0]).toBeNull();
  });
  it("a failed main feed errors every subscriber once, closes everything, and a new subscriber starts a fresh hub", async () => {
    const listen = await fresh(); const e1 = vi.fn(), e2 = vi.fn(), a = vi.fn();
    listen("t1", vi.fn(), e1); listen("t1", vi.fn(), e2);
    listeners.find((l) => l.q.limited)!.err(new Error("denied"));
    expect(e1).toHaveBeenCalledTimes(1); expect(e2).toHaveBeenCalledTimes(1);
    expect(listeners.every((l) => l.stopped)).toBe(true);
    listen("t1", a, vi.fn());
    expect(listeners).toHaveLength(14);
    listeners.slice(7).forEach((l) => l.ok(snap(...(l.q.limited ? [J("x", "DELIVERED")] : []))));
    expect(a).toHaveBeenCalled();
  });
  it("a different signed-in user or tenant never shares a hub", async () => {
    const listen = await fresh(); listen("t1", vi.fn(), vi.fn());
    authState.currentUser = { uid: "u2" }; listen("t1", vi.fn(), vi.fn());
    expect(listeners).toHaveLength(14);
    listen("t2", vi.fn(), vi.fn()); expect(listeners).toHaveLength(21);
  });
  it("a throwing subscriber does not stop the others", async () => {
    const listen = await fresh(); const b = vi.fn(); const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listen("t1", () => { throw new Error("ui"); }, vi.fn()); listen("t1", b, vi.fn());
    feedAll([J("x", "DELIVERED")]); expect(b).toHaveBeenCalled(); spy.mockRestore();
  });
  it("every consumer page shows the notice", async () => {
    const { readFileSync } = await import("node:fs");
    for (const p of ["dashboard", "jobs", "customers"]) {
      const src = readFileSync(`${__dirname}/../app/(admin)/${p}/page.tsx`, "utf8");
      expect(src).toMatch(/<BoundedJobsNotice note=\{boundedNote\}/); expect(src).toMatch(/setBoundedNote/);
    }
  });
});
