import { describe, expect, it } from "vitest";
import { reconcileProtectionReadback, upsertProtection } from "./protection-readback";
import type { Protection } from "@autodeck/core";

const base = { snapId: "p1", targetId: "p1", vehicleId: "v1", customerId: "me", tenantId: "t", generation: 1, currentGeneration: 1 };
const record = (o: Record<string, unknown> = {}) => ({ tenantId: "t", vehicleId: "v1", customerId: "me", kind: "ppf", status: "unverified", source: "customer", provider: "XPEL", revision: 4, updatedAt: "u", createdAt: "c", ...o });

describe("reconcileProtectionReadback", () => {
  it("a stale generation discards the response before any server data is trusted", () => {
    expect(reconcileProtectionReadback({ ...base, exists: true, data: record(), currentGeneration: 2 }).kind).toBe("stale");
    expect(reconcileProtectionReadback({ ...base, exists: false, data: undefined, currentGeneration: 2 }).kind).toBe("stale");
  });
  it("applies a valid record, filling a legacy missing id from the document path", () => {
    const legacy = record(); delete (legacy as Record<string, unknown>).id;
    const r = reconcileProtectionReadback({ ...base, exists: true, data: legacy });
    expect(r).toMatchObject({ kind: "applied", protection: { id: "p1", vehicleId: "v1", provider: "XPEL" } });
    const normal = reconcileProtectionReadback({ ...base, exists: true, data: record({ id: "p1" }) });
    expect(normal).toMatchObject({ kind: "applied", protection: { id: "p1" } });
  });
  it("server-missing is removed, a fact distinct from offline", () => {
    expect(reconcileProtectionReadback({ ...base, exists: false, data: undefined }).kind).toBe("removed");
  });
  it("stored identity contradicting the path fails closed as corrupt", () => {
    expect(reconcileProtectionReadback({ ...base, exists: true, data: record({ id: "other" }) }).kind).toBe("corrupt");
    expect(reconcileProtectionReadback({ ...base, exists: true, data: record({ id: "p1", vehicleId: "v9" }) }).kind).toBe("corrupt");
    expect(reconcileProtectionReadback({ ...base, exists: true, data: record({ id: "p1", customerId: "someone" }) }).kind).toBe("corrupt");
    expect(reconcileProtectionReadback({ ...base, exists: true, data: record({ id: "p1", tenantId: "other" }) }).kind).toBe("corrupt");
  });
  it("a wrong document identity is corrupt even before reading fields", () => {
    expect(reconcileProtectionReadback({ ...base, snapId: "pX", exists: true, data: record({ id: "pX" }) }).kind).toBe("corrupt");
  });
});

describe("upsertProtection", () => {
  const p = (id: string): Protection => ({ id } as Protection);
  it("replaces by the captured target identity and appends when the listener never delivered it", () => {
    const prev = [p("a"), p("p1"), p("b")];
    const replaced = upsertProtection(prev, "p1", { id: "p1", provider: "NEW" } as Protection);
    expect(replaced.map((x) => x.id)).toEqual(["a", "p1", "b"]);
    expect((replaced[1] as Protection & { provider: string }).provider).toBe("NEW");
    const appended = upsertProtection(prev, "p1", { id: "p1", provider: "NEW" } as Protection);
    expect(appended).toHaveLength(3);
    const missing = upsertProtection([p("a")], "p1", p("p1"));
    expect(missing.map((x) => x.id)).toEqual(["a", "p1"]);
  });
});
