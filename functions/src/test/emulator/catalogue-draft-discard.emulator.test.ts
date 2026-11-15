/**
 * Emulator tests for discardCatalogueDraft - the bounded "Discard draft"
 * capability (user-approved batch item, 9 Nov 14:50-14:51 originals).
 *
 * Scope under test: unpublished drafts only. The callable must never mutate a
 * live service, a published history row, or a stuck publish; a discard is a
 * terminal state transition (audit-preserving), not a hard delete; repeating
 * the same client request is a safe, truthful version abort.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";

import { discardCatalogueDraft, getCatalogueDrafts } from "../../functions/service/catalogueDrafts.js";

const db = getFirestore();
const TENANT_A = "discard-tenant-a";
const TENANT_B = "discard-tenant-b";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null }, rawToken: "test" };
}
function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null }, rawToken: "test" };
}

type DraftState = "draft" | "reviewed" | "publishing" | "published" | "blocked" | "discarded";

async function seedDraft(id: string, tenantId: string, state: DraftState, opts: { version?: number; serviceId?: string | null; name?: string } = {}) {
  const now = new Date().toISOString();
  const draft = {
    id,
    tenantId,
    serviceId: opts.serviceId ?? null,
    expectedServiceUpdatedAt: null,
    version: opts.version ?? 1,
    state,
    payload: { name: opts.name ?? "Discard Test Wash", category: "washing", basePrice: 50000 },
    createdBy: "seed",
    updatedBy: "seed",
    createdAt: now,
    updatedAt: now,
    reviewHash: state === "reviewed" ? "rh_seed" : null,
    reviewedBy: state === "reviewed" ? "seed" : null,
    reviewedByRole: state === "reviewed" ? "admin" : null,
    reviewedAt: state === "reviewed" ? now : null,
    expectedPublicRowHash: null,
    newServiceId: null,
    expectedNewTabHash: null,
    publicDestination: null,
  };
  await db.collection("catalogueDrafts").doc(id).set(draft);
  return draft;
}

async function runDiscard(auth: unknown, draftId: string, expectedVersion: number) {
  return (await discardCatalogueDraft.run({ data: { draftId, expectedVersion }, auth } as never)) as { ok: boolean };
}

async function expectError(p: Promise<unknown>, code: string): Promise<void> {
  try {
    await p;
  } catch (e) {
    const actual = String((e as { code?: string })?.code ?? (e as Error)?.message ?? e);
    expect(actual, `expected error containing ${code}`).toContain(code);
    return;
  }
  throw new Error(`expected error containing ${code}, but the call succeeded`);
}

async function discardAudits(draftId: string) {
  const snap = await db.collection("auditLog").where("entityId", "==", draftId).where("action", "==", "service.catalogue_draft_discarded").get();
  return snap.docs.map((d) => d.data());
}

describe("discardCatalogueDraft - bounded draft discard", () => {
  it("rejects unauthenticated and non-admin callers", async () => {
    const id = uid("draft");
    await seedDraft(id, TENANT_A, "draft");
    await expectError(runDiscard(undefined as never, id, 1), "unauthenticated");
    await expectError(runDiscard(customerAuth(uid("cust")), id, 1), "permission-denied");
    const after = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
    expect(after.state).toBe("draft");
    expect(after.version).toBe(1);
    expect(await discardAudits(id)).toHaveLength(0);
  });

  it("refuses a draft owned by another tenant", async () => {
    const id = uid("draft");
    await seedDraft(id, TENANT_A, "draft");
    await expectError(runDiscard(adminAuth(uid("adm"), TENANT_B), id, 1), "permission-denied");
    const after = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
    expect(after.state).toBe("draft");
    expect(await discardAudits(id)).toHaveLength(0);
  });

  it("aborts on a stale expectedVersion and changes nothing", async () => {
    const id = uid("draft");
    await seedDraft(id, TENANT_A, "draft", { version: 3 });
    await expectError(runDiscard(adminAuth(uid("adm")), id, 2), "aborted");
    const after = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
    expect(after.state).toBe("draft");
    expect(after.version).toBe(3);
    expect(await discardAudits(id)).toHaveLength(0);
  });

  it("refuses publishing and blocked drafts - those need read-back recovery", async () => {
    for (const state of ["publishing", "blocked"] as const) {
      const id = uid("draft");
      const before = await seedDraft(id, TENANT_A, state);
      await expectError(runDiscard(adminAuth(uid("adm")), id, 1), "failed-precondition");
      const after = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
      expect(after).toEqual(before);
      expect(await discardAudits(id)).toHaveLength(0);
    }
  });

  it("never mutates a published history row, and history stays readable", async () => {
    const id = uid("draft");
    const before = await seedDraft(id, TENANT_A, "published");
    await expectError(runDiscard(adminAuth(uid("adm")), id, 1), "failed-precondition");
    const after = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
    expect(after).toEqual(before);
    expect(await discardAudits(id)).toHaveLength(0);
    // The published row still appears in the cursor-paged history branch, intact.
    const history = (await getCatalogueDrafts.run({ data: { history: true }, auth: adminAuth(uid("adm")) } as never)) as { history: { id: string }[] };
    const row = history.history.find((d) => d.id === id);
    expect(row).toBeTruthy();
    expect(row).toMatchObject({ state: "published", version: before.version });
  });

  it("discards a draft exactly once: terminal state, audit, queue removal, retry aborts truthfully", async () => {
    const id = uid("draft");
    const admin = uid("adm");
    const serviceId = uid("svc");
    const now = new Date().toISOString();
    await db.collection("services").doc(serviceId).set({ id: serviceId, tenantId: TENANT_A, name: "Linked Live Service", active: true, updatedAt: now });
    await seedDraft(id, TENANT_A, "reviewed", { version: 2, serviceId });

    const result = await runDiscard(adminAuth(admin), id, 2);
    expect(result.ok).toBe(true);

    const after = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
    expect(after.state).toBe("discarded");
    expect(after.version).toBe(3);
    expect(after.reviewHash).toBeNull();
    expect(after.updatedBy).toBe(admin);

    // Linked live service untouched.
    const service = (await db.collection("services").doc(serviceId).get()).data()!;
    expect(service).toMatchObject({ name: "Linked Live Service", active: true, updatedAt: now });

    // Exactly one audit entry.
    const audits = await discardAudits(id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: "CatalogueDraft", entityId: id });

    // No longer in the actionable review queue read.
    const read = (await getCatalogueDrafts.run({ data: {}, auth: adminAuth(uid("adm2")) } as never)) as { drafts: { id: string }[] };
    expect(read.drafts.some((d) => d.id === id)).toBe(false);

    // Rate limiter engaged under the service.update action.
    const rl = await db.collection("rateLimits").doc(`${TENANT_A}__${admin}__service.update`).get();
    expect(rl.exists).toBe(true);

    // Client retry of the same request: truthful abort, no second transition, no second audit.
    await expectError(runDiscard(adminAuth(admin), id, 2), "aborted");
    const afterRetry = (await db.collection("catalogueDrafts").doc(id).get()).data()!;
    expect(afterRetry.state).toBe("discarded");
    expect(afterRetry.version).toBe(3);
    expect(await discardAudits(id)).toHaveLength(1);
  });
});
