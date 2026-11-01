import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { planProtectionEvents, installId, type ProtectionWorkEvent } from "../../lib/protection-effects.js";
import { advanceJobStatusSchema } from "../../schemas/job.js";
import type { Protection } from "@autodeck/core";

const job = { id: "j1", tenantId: "t", customerId: "c1", vehicleId: "v1" };
const prot = (id: string, o: Partial<Protection> = {}): Protection => ({ id, tenantId: "t", vehicleId: "v1", customerId: "c1", kind: "ppf", provider: "Garware", policyNumber: null, startDate: null, expiryDate: null, documentUrl: null, status: "unverified", source: "customer", verifiedBy: null, verifiedAt: null, notes: null, createdAt: "x", updatedAt: "x", ...o });
const install = (o: Partial<Extract<ProtectionWorkEvent, { action: "install" }>> = {}): ProtectionWorkEvent => ({ action: "install", kind: "ppf", coverage: "full_body", brand: "LLumar", warrantyYears: 5, ...o });
const remove = (targetProtectionId: string, expectedRevision = 0): ProtectionWorkEvent => ({ action: "remove", targetProtectionId, expectedRevision });
const replace = (targetProtectionId: string, expectedRevision = 0, o: Partial<Extract<ProtectionWorkEvent, { action: "install" }>> = {}): ProtectionWorkEvent => ({ ...(install(o) as Extract<ProtectionWorkEvent, { action: "install" }>), action: "replace", targetProtectionId, expectedRevision });
/** The record a committed install event for this job would have written. */
const committedInstall = (index: number, o: Partial<Protection> = {}): Protection =>
  prot(installId("j1", index), { kind: "ppf", coverage: "full_body", provider: "LLumar", warrantyYears: 5, source: "autodeck", status: "verified", lifecycle: "current", installedByJobId: "j1", revision: 1, ...o });
const NOW = "2026-10-31T06:00:00.000Z";
const base = { job, actorUid: "s", now: NOW };

describe("declared-events-only principle", () => {
  it("no catalog mapping exists in the planner or the delivery path", () => {
    const lib = readFileSync("src/lib/protection-effects.ts", "utf8");
    expect(lib).not.toMatch(/\bService\b(?!Job)/);
    expect(lib).not.toContain(".category");
    expect(lib).not.toContain("serviceId");
    const fn = readFileSync("src/functions/job/advanceJobStatus.ts", "utf8");
    expect(fn).not.toContain("SERVICE_PROTECTION_EFFECTS");
    expect(fn).toContain("data.protectionWork");
  });
  it("a delivery declared as NONE plans nothing, whatever was booked", () => {
    expect(planProtectionEvents({ ...base, events: [], existing: [prot("old1")] }).outcomes).toHaveLength(0);
  });
  it("install supersedes NOTHING by itself: no declared replace, no supersede outcome", () => {
    const { outcomes } = planProtectionEvents({ ...base, events: [install()], existing: [prot("old1")] });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ action: "install" });
    expect(JSON.stringify(outcomes)).not.toContain("supersedeId");
  });
});

describe("planProtectionEvents", () => {
  it("install writes a verified current record, revision 1, identity job-<jobId>-ev<index>", () => {
    const { outcomes } = planProtectionEvents({ ...base, events: [install()], existing: [], actorUid: "staff1" });
    expect(outcomes[0]).toMatchObject({ action: "install", eventIndex: 0 });
    const rec = (outcomes[0] as Extract<typeof outcomes[0], { action: "install" }>).record;
    expect(rec).toMatchObject({
      id: installId("j1", 0), kind: "ppf", source: "autodeck", status: "verified", verifiedBy: "staff1",
      coverage: "full_body", lifecycle: "current", installedByJobId: "j1", startDate: "2026-10-31",
      warrantyYears: 5, provider: "LLumar", expiryDate: null, revision: 1,
    });
  });

  it("remove marks exactly the named current record with a revision bump; a legacy unversioned record bumps from 0", () => {
    const { outcomes } = planProtectionEvents({ ...base, events: [remove("old1")], existing: [prot("old1")] });
    expect(outcomes[0]).toMatchObject({ action: "remove", removeId: "old1", removeNextRevision: 1 });
  });

  it("replace supersedes exactly the named current record with a revision bump, and installs the new record", () => {
    const { outcomes } = planProtectionEvents({
      ...base, events: [replace("old1", 3, { brand: "LLumar", warrantyYears: 7 })],
      existing: [prot("old1", { revision: 3, coverage: "full_body" }), prot("other1")],
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ action: "replace", supersedeId: "old1", supersedeNextRevision: 4 });
  });

  it("fail closed: unknown target, history target, duplicate target across events", () => {
    expect(() => planProtectionEvents({ ...base, events: [remove("nope")], existing: [] })).toThrow(/not a protection record/);
    expect(() => planProtectionEvents({ ...base, events: [remove("h1")], existing: [prot("h1", { lifecycle: "removed" })] })).toThrow(/already history/);
    expect(() => planProtectionEvents({ ...base, events: [remove("old1"), replace("old1")], existing: [prot("old1")] })).toThrow(/same protection record/);
    // A delivery declaration can never retire a legal/financial record:
    // insurance, FastTag, PUC, RC and warranty have their own lifecycle.
    expect(() => planProtectionEvents({ ...base, events: [remove("i1")], existing: [prot("i1", { kind: "insurance" })] })).toThrow(/not cosmetic protection/);
    expect(() => planProtectionEvents({ ...base, events: [remove("f1")], existing: [prot("f1", { kind: "fasttag" })] })).toThrow(/not cosmetic protection/);
    expect(() => planProtectionEvents({ ...base, events: [replace("r1", 0)], existing: [prot("r1", { kind: "rc", coverage: "full_body" })] })).toThrow(/not cosmetic protection/);
  });

  it("stale staff reads never write: a target whose revision moved on fails closed", () => {
    expect(() => planProtectionEvents({ ...base, events: [remove("old1", 1)], existing: [prot("old1", { revision: 2 })] })).toThrow(/has changed since it was reviewed/);
    expect(() => planProtectionEvents({ ...base, events: [replace("old1", 0)], existing: [prot("old1", { revision: 1, coverage: "full_body" })] })).toThrow(/has changed since it was reviewed/);
    // ...while the matching revision plans fine (legacy unversioned = 0).
    expect(planProtectionEvents({ ...base, events: [remove("old1", 2)], existing: [prot("old1", { revision: 2 })] }).outcomes).toHaveLength(1);
  });

  it("a replacement that changes kind or coverage scope fails closed - never a silent coverage loss", () => {
    // PPF full-body superseded by a ceramic high-impact record would silently
    // destroy the PPF coverage; that change must be declared as an explicit
    // removal plus install.
    expect(() => planProtectionEvents({ ...base, events: [replace("old1", 0, { kind: "ceramic", coverage: "high_impact" })], existing: [prot("old1", { coverage: "full_body" })] })).toThrow(/changes the kind or coverage/);
    expect(() => planProtectionEvents({ ...base, events: [replace("old1", 0, { coverage: "high_impact" })], existing: [prot("old1", { coverage: "full_body" })] })).toThrow(/changes the kind or coverage/);
    // Same kind, same scope is a genuine like-for-like replacement.
    expect(planProtectionEvents({ ...base, events: [replace("old1", 0)], existing: [prot("old1", { coverage: "full_body" })] }).outcomes).toHaveLength(1);
    // A legacy record with NO coverage field has UNKNOWN scope: unknown is
    // never inferred as whole-car, so even a full-body declaration cannot
    // like-for-like replace it - explicit removal + install, or a scope
    // repair first.
    expect(() => planProtectionEvents({ ...base, events: [replace("old1", 0, { coverage: "full_body" })], existing: [prot("old1", { coverage: null })] })).toThrow(/scope is unknown/);
    expect(() => planProtectionEvents({ ...base, events: [replace("old1", 0, { coverage: "full_front" })], existing: [prot("old1", { coverage: null })] })).toThrow(/scope is unknown/);
    // ...while an explicit removal of that same unknown-scope record is fine.
    expect(planProtectionEvents({ ...base, events: [remove("old1", 0)], existing: [prot("old1", { coverage: null })] }).outcomes).toHaveLength(1);
  });

  it("targets are resolved by tenant + vehicle, not customer: a former owner's record on this car is targetable, and its owner/source are preserved", () => {
    const former = prot("old1", { customerId: "former-owner", source: "autodeck" });
    const { outcomes } = planProtectionEvents({ ...base, events: [remove("old1")], existing: [former] });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ action: "remove", removeId: "old1" });
    // The removal outcome touches ONLY lifecycle + revision: the planner
    // never rewrites the history record's owner or source.
    expect(JSON.stringify(outcomes[0])).not.toContain("customerId");
  });

  it("no-dup: a removal already applied by THIS job is not applied again, even though the record is now history (an already-applied outcome must not throw)", () => {
    const removed = prot("old1", { lifecycle: "removed", removedByJobId: "j1", revision: 1 });
    const { outcomes } = planProtectionEvents({ ...base, events: [remove("old1", 0)], existing: [removed] });
    expect(outcomes).toHaveLength(0);
    // A record removed by ANOTHER job is not this job's replay: fail closed.
    const byOther = prot("old2", { lifecycle: "removed", removedByJobId: "other-job", revision: 1 });
    expect(() => planProtectionEvents({ ...base, events: [remove("old2", 0)], existing: [byOther] })).toThrow(/already history/);
  });

  it("no-dup: an already-committed install is left untouched; a changed payload at the same index is a conflict, not a silent skip", () => {
    expect(planProtectionEvents({ ...base, events: [install()], existing: [committedInstall(0)] }).outcomes).toHaveLength(0);
    expect(() => planProtectionEvents({ ...base, events: [install({ brand: "Garware" })], existing: [committedInstall(0)] })).toThrow(/replay conflict/);
    expect(() => planProtectionEvents({ ...base, events: [install({ coverage: "high_impact" })], existing: [committedInstall(0)] })).toThrow(/replay conflict/);
    // Reordering two installs changes per-index identity: same conflict, no silent re-apply.
    expect(() => planProtectionEvents({
      ...base,
      events: [install({ kind: "ceramic", brand: "Kovalent" }), install()],
      existing: [committedInstall(0), committedInstall(1, { kind: "ceramic", provider: "Kovalent" })],
    })).toThrow(/replay conflict/);
  });

  it("no-dup: an already-committed replace is left untouched; a replace whose target was NOT retired by this job is a conflict", () => {
    const superseded = prot("old1", { lifecycle: "superseded", supersededByJobId: "j1", revision: 1, coverage: "full_body" });
    expect(planProtectionEvents({ ...base, events: [replace("old1", 0)], existing: [committedInstall(0), superseded] }).outcomes).toHaveLength(0);
    const untouchedTarget = prot("old1", { coverage: "full_body" });
    expect(() => planProtectionEvents({ ...base, events: [replace("old1", 0)], existing: [committedInstall(0), untouchedTarget] })).toThrow(/replay conflict/);
  });

  it("multiple explicit events across kinds and actions all plan - no count assumptions", () => {
    const { outcomes } = planProtectionEvents({
      ...base,
      events: [install(), install({ kind: "ceramic", brand: "Kovalent" }), remove("old1")],
      existing: [prot("old1")],
    });
    expect(outcomes.map((o) => o.action)).toEqual(["install", "install", "remove"]);
  });
});

describe("advanceJobStatusSchema protectionWork events", () => {
  const b = { jobId: "j1" };
  it("accepts install/replace/remove events and the explicit-none empty array", () => {
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [] }).success).toBe(true);
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [install()] }).success).toBe(true);
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "replace", targetProtectionId: "p1", expectedRevision: 0, kind: "ceramic", coverage: "full_front" }] }).success).toBe(true);
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "remove", targetProtectionId: "p1", expectedRevision: 2 }] }).success).toBe(true);
  });
  it("rejects per-action shape violations (strict)", () => {
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "install", kind: "ppf" }] }).success).toBe(false); // missing coverage
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "replace", kind: "ppf", coverage: "full_body" }] }).success).toBe(false); // no target
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "remove", targetProtectionId: "p1" }] }).success).toBe(false); // no expectedRevision
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "remove", targetProtectionId: "p1", expectedRevision: -1 }] }).success).toBe(false);
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "remove", targetProtectionId: "p1", expectedRevision: 0, kind: "ppf" }] }).success).toBe(false); // remove carries no spec
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "install", kind: "wax", coverage: "full_body" }] }).success).toBe(false);
    expect(advanceJobStatusSchema.safeParse({ ...b, protectionWork: [{ action: "install", kind: "ppf", coverage: "full_body", serviceId: "svc-ppf-llumar-gloss" }] }).success).toBe(false); // no catalog ids
  });
});

describe("advanceJobStatus wiring", () => {
  it("declaration gating, fresh revalidation, and in-transaction event writes are all present", () => {
    const s = readFileSync("src/functions/job/advanceJobStatus.ts", "utf8");
    expect(s).toContain('data.protectionWork !== undefined && nextStatus !== "DELIVERED"'); // reject off-delivery
    expect(s).toContain("REQUIRES an explicit performed-work declaration"); // deployed-live lineage adopted: declaration REQUIRED at the server - absent is refused, never a silent none
    const tx = s.slice(s.indexOf("db.runTransaction"));
    const deliver = tx.slice(tx.indexOf('if (nextStatus === "DELIVERED")'));
    expect(deliver.indexOf("assertTenant(user, freshJob.tenantId)")).toBeLessThan(deliver.indexOf("planProtectionEvents({")); // fresh job revalidation first
    expect(deliver.indexOf("vehSnap")).toBeLessThan(deliver.indexOf("planProtectionEvents({")); // vehicle truth first
    expect(deliver.indexOf("planProtectionEvents({")).toBeLessThan(deliver.indexOf("tx.update(db.collection")); // reads before writes
    expect(deliver).toContain("protection.installed");
    expect(deliver).toContain("protection.superseded");
    expect(deliver).toContain("protection.removed");
    expect(deliver).toContain("protectionWork: data.protectionWork ?? []"); // live contract: the gating above guarantees the field is present here
  });
  it("the job document id is authoritative: stored-id mismatch fails closed, ids/provenance/audit use the doc id", () => {
    const s = readFileSync("src/functions/job/advanceJobStatus.ts", "utf8");
    expect(s).toContain("freshJob.id !== freshJobSnap.id");
    const tx = s.slice(s.indexOf("db.runTransaction"));
    expect(tx).not.toMatch(/removedByJobId: freshJob\.id/);
    expect(tx).not.toMatch(/supersededByJobId: freshJob\.id/);
    expect(tx).not.toMatch(/byJobId: freshJob\.id/);
    expect(tx).not.toMatch(/jobId: freshJob\.id/);
    expect(s).toContain("const jobId = freshJobSnap.id");
  });
  it("terminal DELIVERED rejects a resubmitted delivery honestly - no fake success receipt", () => {
    const s = readFileSync("src/functions/job/advanceJobStatus.ts", "utf8");
    expect(s).toMatch(/freshJob\.status === "DELIVERED"[\s\S]{0,400}already delivered[\s\S]{0,200}Refresh the job instead of resubmitting/);
  });
  it("no false warranty/coverage claims: no comment presents the catalog warranty as the source of protection coverage dates", () => {
    const lib = readFileSync("src/lib/protection-effects.ts", "utf8");
    expect(lib).not.toMatch(/single source/i);
    expect(lib).not.toMatch(/[Ww]arranty issued for this same job/);
  });
});
