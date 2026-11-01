import { describe, expect, it } from "vitest";
import { ProtectionSaveFlow, type ProtectionSaveEffect, type ServerSnap } from "./protection-save-flow";
import { upsertProtection } from "./protection-readback";
import type { Protection } from "@autodeck/core";

const target = { id: "p1", tenantId: "t", vehicleId: "v1", customerId: "me", kind: "ppf", status: "unverified", source: "customer", provider: "XPEL", revision: 3, updatedAt: "u3", createdAt: "c" } as unknown as Protection;
const base = { mode: "edit" as const, target, vehicleId: "v1", uid: "me", tenantId: "t" };
const deferred = <T>() => { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const httpError = (code: string) => Object.assign(new Error(code), { code });
const serverData = (rev: number) => ({ id: "p1", tenantId: "t", vehicleId: "v1", customerId: "me", kind: "ppf", status: "unverified", source: "customer", provider: "SERVER", revision: rev, updatedAt: `u${rev}`, createdAt: "c" });
const unusedFetch = () => Promise.reject<ServerSnap>(new Error("unused"));

function harness(fetch: () => Promise<ServerSnap> = unusedFetch) {
  const effects: ProtectionSaveEffect[] = [];
  const flow = new ProtectionSaveFlow((e) => effects.push(e));
  const run = (over: Record<string, unknown> = {}) => flow.run({ ...base, fetch, save: async () => {}, contextCurrent: () => true, ...over });
  return { effects, flow, run };
}

describe("ProtectionSaveFlow orchestration", () => {
  it("success publishes closeEditor then releases busy, in order", async () => {
    const h = harness();
    await h.run();
    expect(h.effects).toEqual([{ type: "busy", value: true }, { type: "closeEditor" }, { type: "busy", value: false }]);
  });

  it("invalidate before a late success: nothing publishes except the initial busy", async () => {
    const d = deferred<void>();
    const h = harness();
    const p = h.run({ save: () => d.promise });
    h.flow.invalidate(); // editor cancelled while in flight
    d.resolve();
    await p;
    expect(h.effects).toEqual([{ type: "busy", value: true }]);
  });

  it("dispose on unmount: a late error publishes nothing", async () => {
    const d = deferred<void>();
    const h = harness(async () => ({ exists: true, data: serverData(4), snapId: "p1" }));
    const p = h.run({ save: () => d.promise });
    h.flow.dispose();
    d.reject(httpError("functions/failed-precondition"));
    await p;
    expect(h.effects).toEqual([{ type: "busy", value: true }]);
  });

  it("a disposed run never emits busy and never touches the network (StrictMode probe safety)", async () => {
    const h = harness();
    h.flow.dispose();
    let saved = false;
    await h.run({ save: async () => { saved = true; } });
    expect(saved).toBe(false);
    expect(h.effects).toEqual([]);
  });

  it("revive after dispose restores the SAME flow (StrictMode remount cycle)", async () => {
    const h = harness();
    h.flow.dispose(); // probe cleanup
    h.flow.revive(); // real setup
    await h.run();
    expect(h.effects).toEqual([{ type: "busy", value: true }, { type: "closeEditor" }, { type: "busy", value: false }]);
  });

  it("an older attempt's finally never unlocks a newer in-flight save", async () => {
    const d1 = deferred<void>();
    const d2 = deferred<void>();
    const h = harness();
    const p1 = h.run({ save: () => d1.promise });
    const p2 = h.run({ save: () => d2.promise });
    d1.reject(httpError("functions/unavailable"));
    await p1;
    expect(h.effects).toEqual([{ type: "busy", value: true }, { type: "busy", value: true }]);
    d2.resolve();
    await p2;
    expect(h.effects.at(-1)).toEqual({ type: "busy", value: false });
  });

  it("create-mode error after invalidation publishes nothing", async () => {
    const d = deferred<void>();
    const h = harness();
    const p = h.run({ mode: "create", target: null, save: () => d.promise });
    h.flow.invalidate();
    d.reject(httpError("functions/unavailable"));
    await p;
    expect(h.effects).toEqual([{ type: "busy", value: true }]);
  });

  it("conflict + confirmed server read-back: upsert, close editor, truthful copy", async () => {
    const h = harness(async () => ({ exists: true, data: serverData(4), snapId: "p1" }));
    await h.run({ save: async () => { throw httpError("functions/failed-precondition"); } });
    expect(h.effects).toEqual([
      { type: "busy", value: true },
      { type: "upsert", targetId: "p1", protection: expect.objectContaining({ id: "p1", provider: "SERVER", revision: 4 }) },
      { type: "closeEditor" },
      { type: "error", message: expect.stringContaining("latest saved version is now shown") },
      { type: "busy", value: false },
    ]);
  });

  it("server-missing removes the target from the saved list but keeps the draft open", async () => {
    const h = harness(async () => ({ exists: false, data: undefined, snapId: "p1" }));
    await h.run({ save: async () => { throw httpError("functions/failed-precondition"); } });
    expect(h.effects).toContainEqual({ type: "remove", targetId: "p1" });
    expect(h.effects.some((e) => e.type === "closeEditor")).toBe(false);
    expect(h.effects).toContainEqual({ type: "error", message: expect.stringContaining("no longer saved") });
  });

  it("offline read-back keeps the draft and never claims the display is current", async () => {
    const h = harness(async () => { throw new Error("network down"); });
    await h.run({ save: async () => { throw httpError("functions/unavailable"); } });
    expect(h.effects.some((e) => e.type === "closeEditor" || e.type === "upsert" || e.type === "remove")).toBe(false);
    expect(h.effects).toContainEqual({ type: "error", message: expect.stringContaining("could not be loaded right now") });
    expect(h.effects.at(-1)).toEqual({ type: "busy", value: false });
  });

  it("invalidate during the read-back await discards the read-back", async () => {
    const d = deferred<ServerSnap>();
    const h = harness(() => d.promise);
    const p = h.run({ save: async () => { throw httpError("functions/failed-precondition"); } });
    await Promise.resolve();
    h.flow.invalidate();
    d.resolve({ exists: true, data: serverData(4), snapId: "p1" });
    await p;
    expect(h.effects).toEqual([{ type: "busy", value: true }]);
  });
});

describe("monotonic upsertProtection", () => {
  const p = (id: string, rev?: number, updatedAt = "u"): Protection => ({ id, revision: rev, updatedAt } as unknown as Protection);
  it("an older read-back never overwrites a newer listener-delivered copy", () => {
    const prev = [p("p1", 5)];
    expect(upsertProtection(prev, "p1", p("p1", 4))).toBe(prev);
    expect(upsertProtection(prev, "p1", p("p1", 5))[0]).toMatchObject({ revision: 5 });
    expect(upsertProtection(prev, "p1", p("p1", 6))[0]).toMatchObject({ revision: 6 });
  });
  it("legacy unversioned copies compare by updatedAt", () => {
    const prev = [p("p1", undefined, "2026-01-02T00:00:00.000Z")];
    expect(upsertProtection(prev, "p1", p("p1", undefined, "2026-01-01T00:00:00.000Z"))).toBe(prev);
    expect(upsertProtection(prev, "p1", p("p1", undefined, "2026-01-03T00:00:00.000Z"))[0]).toMatchObject({ updatedAt: "2026-01-03T00:00:00.000Z" });
  });
  it("a versioned copy ALWAYS beats a legacy one, whatever the timestamps say", () => {
    const legacyNew = p("p1", undefined, "2027-06-01T00:00:00.000Z");
    const versionedOld = p("p1", 1, "2026-01-01T00:00:00.000Z");
    // legacy in the list, versioned arrives: replace
    expect(upsertProtection([legacyNew], "p1", versionedOld)[0]).toMatchObject({ revision: 1 });
    // versioned in the list, legacy arrives: keep the versioned copy
    expect(upsertProtection([versionedOld], "p1", legacyNew)).toEqual([versionedOld]);
  });
});
