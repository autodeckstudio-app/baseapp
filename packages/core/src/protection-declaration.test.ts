import { describe, it, expect } from "vitest";
import { buildProtectionWork, selectTarget, targetableRecords, newInstallDraft, newReplaceDraft, newRemoveDraft, type DeclarationDraft } from "./protection-declaration";
import type { Protection } from "./types/index.js";

const prot = (id: string, o: Partial<Protection> = {}): Protection => ({ id, tenantId: "t", vehicleId: "v", customerId: "c", kind: "ppf", provider: "Garware", policyNumber: null, startDate: null, expiryDate: null, documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null, notes: null, revision: 2, coverage: "full_body", createdAt: "x", updatedAt: "x", ...o });

describe("buildProtectionWork", () => {
  it("no choice made: null - an absent choice is never a silent none", () => {
    expect(buildProtectionWork({ choice: null }, [])).toBeNull();
  });
  it("explicit none: the empty array", () => {
    expect(buildProtectionWork({ choice: "none" }, [prot("p1")])).toEqual([]);
  });
  it("work with zero events is incomplete", () => {
    expect(buildProtectionWork({ choice: "work", events: [] }, [])).toBeNull();
  });
  it("install: kind and coverage start UNCHOSEN and must be affirmed - the app never pre-affirms scope", () => {
    const bare = newInstallDraft();
    expect(bare.kind).toBeNull();
    expect(bare.coverage).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [bare] }, [])).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [{ ...bare, kind: "ppf" }] }, [])).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [{ ...bare, coverage: "full_front" }] }, [])).toBeNull();
  });
  it("install: affirmed kind + coverage, trims brand, empty means null", () => {
    const ev = { ...newInstallDraft(), kind: "ppf" as const, coverage: "full_body" as const, brand: " LLumar ", warrantyYears: "5" };
    expect(buildProtectionWork({ choice: "work", events: [ev] }, [])).toEqual([
      { action: "install", kind: "ppf", coverage: "full_body", brand: "LLumar", warrantyYears: 5 },
    ]);
    const bare = { ...newInstallDraft(), kind: "ceramic" as const, coverage: "high_impact" as const };
    expect(buildProtectionWork({ choice: "work", events: [bare] }, [])).toEqual([
      { action: "install", kind: "ceramic", coverage: "high_impact", brand: null, warrantyYears: null },
    ]);
  });
  it("install: non-integer or out-of-range years block the declaration", () => {
    const ok = { ...newInstallDraft(), kind: "ppf" as const, coverage: "full_body" as const };
    expect(buildProtectionWork({ choice: "work", events: [{ ...ok, warrantyYears: "abc" }] }, [])).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [{ ...ok, warrantyYears: "2.5" }] }, [])).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [{ ...ok, warrantyYears: "31" }] }, [])).toBeNull();
  });
  it("remove: expectedRevision is FROZEN at selection (legacy unversioned = 0), not read at build time", () => {
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newRemoveDraft(), prot("p1"))] }, [prot("p1")])).toEqual([
      { action: "remove", targetProtectionId: "p1", expectedRevision: 2 },
    ]);
    const legacy = prot("p2"); delete (legacy as { revision?: number }).revision;
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newRemoveDraft(), legacy)] }, [legacy])).toEqual([
      { action: "remove", targetProtectionId: "p2", expectedRevision: 0 },
    ]);
  });
  it("a stale selection is refused, never auto-advanced: the record changed after the staff member picked it", () => {
    const picked = selectTarget(newRemoveDraft(), prot("p1")); // frozen at revision 2
    const changed = prot("p1", { revision: 3 }); // listener pushed a newer revision since
    expect(buildProtectionWork({ choice: "work", events: [picked] }, [changed])).toBeNull();
    const pickedR = selectTarget(newReplaceDraft(), prot("p1", { coverage: "full_body" }));
    expect(buildProtectionWork({ choice: "work", events: [pickedR] }, [changed])).toBeNull();
    // Re-selecting the newer record is the only way forward.
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newRemoveDraft(), changed)] }, [changed])).not.toBeNull();
  });
  it("replace is like-for-like: kind and coverage come FROM the target, never from a form", () => {
    const t = prot("p1", { kind: "ceramic", coverage: "high_impact", provider: "Kovalent", warrantyYears: 3 });
    expect(buildProtectionWork({ choice: "work", events: [{ ...selectTarget(newReplaceDraft(), t), brand: "Xpel", warrantyYears: "7" }] }, [t])).toEqual([
      { action: "replace", targetProtectionId: "p1", expectedRevision: 2, kind: "ceramic", coverage: "high_impact", brand: "Xpel", warrantyYears: 7 },
    ]);
  });
  it("replace brand/warranty describe the NEW work: explicit entry or null - NEVER inherited from the old record", () => {
    const t = prot("p1", { provider: "Kovalent", warrantyYears: 3 });
    // Staff member leaves brand/warranty blank: the payload carries null, not "Kovalent"/3.
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newReplaceDraft(), t)] }, [t])).toEqual([
      { action: "replace", targetProtectionId: "p1", expectedRevision: 2, kind: "ppf", coverage: "full_body", brand: null, warrantyYears: null },
    ]);
  });
  it("replace against an unknown-scope (no coverage) or non-cosmetic target is not buildable", () => {
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newReplaceDraft(), prot("p1", { coverage: null }))] }, [prot("p1", { coverage: null })])).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newReplaceDraft(), prot("p1", { kind: "insurance" }))] }, [prot("p1", { kind: "insurance" })])).toBeNull();
  });
  it("targets must be current records on this car: history records and unknown ids are not targetable", () => {
    expect(targetableRecords([prot("p1"), prot("h1", { lifecycle: "removed" })]).map((p) => p.id)).toEqual(["p1"]);
    expect(buildProtectionWork({ choice: "work", events: [selectTarget(newRemoveDraft(), prot("h1"))] }, [prot("h1", { lifecycle: "removed" })])).toBeNull();
    expect(buildProtectionWork({ choice: "work", events: [{ ...newRemoveDraft(), targetProtectionId: null, expectedRevision: null }] }, [prot("p1")])).toBeNull();
  });
  it("two events naming the same record are never built", () => {
    const p = prot("p1");
    const d: DeclarationDraft = { choice: "work", events: [selectTarget(newRemoveDraft(), p), selectTarget(newReplaceDraft(), p)] };
    expect(buildProtectionWork(d, [p])).toBeNull();
  });
  it("nothing is derived from a booked service: the builder takes no service input at all", () => {
    expect(buildProtectionWork.length).toBe(2); // draft + protections only
  });
});
