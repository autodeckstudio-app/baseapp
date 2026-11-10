/**
 * Controlled aborted-transaction coverage for the REAL cancelBooking callable.
 *
 * Why this file exists: the emulator retry/hardening tests exercise the
 * failure branch only deterministically-sequential, never an actual aborted
 * transaction. This harness injects a synthetic Firestore ABORTED (code 10)
 * error from INSIDE the live emulator transaction, targeted at the cancel
 * transaction's own read of the target booking document, and proves:
 *   1. the callable surfaces the failure truthfully (rejects, no false success)
 *   2. the aborted attempt commits no business state: booking status,
 *      membership binding and wash counters, jobs and audit logs are
 *      unchanged against the real emulator state afterwards. This is a
 *      selected business-state check, not byte equality: the pre-transaction
 *      rate-limit slot consumption on the failed call is a real side effect
 *      and is explicitly out of scope here
 *   3. an unarmed retry then succeeds exactly once (idempotent contract)
 *   4. a further retry is a truthful no-op (alreadyCancelled)
 *
 * Honesty note: the abort is injected by test scaffolding, not observed from
 * production. It exercises the real emulator transaction machinery, the real
 * callable and the real state checks; it is labelled synthetic in the
 * assertions so nobody reads it as a captured production error.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { COLLECTIONS } from "@autodeck/database";
import type * as AdminFirestore from "firebase-admin/firestore";

// Hoisted injection state shared with the getFirestore mock below.
const h = vi.hoisted(() => ({
  targetPath: "" as string, // bookings/<id> the abort is aimed at
  abortsRemaining: 0,       // abort budget: >5 exhausts the SDK retry loop
  abortAttempts: 0,         // how many times the injection actually fired
}));

vi.mock("firebase-admin/firestore", async (importOriginal) => {
  const mod = await importOriginal<typeof AdminFirestore>();
  let db: FirebaseFirestore.Firestore | null = null;
  return {
    ...mod,
    getFirestore: () => {
      if (db) return db;
      const real = mod.getFirestore();
      const origRunTransaction = real.runTransaction.bind(real);
      // Wrap runTransaction so the transaction callback sees a tx whose get()
      // throws a synthetic ABORTED the first times it touches the target doc.
      (real as { runTransaction: unknown }).runTransaction = async <T,>(
        fn: (tx: FirebaseFirestore.Transaction) => Promise<T>,
      ): Promise<T> =>
        origRunTransaction(async (tx) => {
          const wrapped = new Proxy(tx, {
            get(t, prop) {
              if (prop === "get") {
                const origGet = t.get.bind(t);
                return ((ref: FirebaseFirestore.DocumentReference) => {
                  if (
                    h.abortsRemaining > 0 &&
                    h.targetPath &&
                    typeof ref?.path === "string" &&
                    ref.path === h.targetPath
                  ) {
                    h.abortsRemaining -= 1;
                    h.abortAttempts += 1;
                    const err = new Error(
                      "10 ABORTED: synthetic contention injected by cancel-abort-injection.emulator.test.ts",
                    ) as Error & { code: number };
                    err.code = 10;
                    throw err;
                  }
                  return origGet(ref as never);
                }) as typeof t.get;
              }
              const v = (t as unknown as Record<PropertyKey, unknown>)[prop];
              return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
            },
          });
          return fn(wrapped);
        });
      db = real;
      return real;
    },
  };
});

import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

const membership = async (id: string) =>
  (await db.collection(COLLECTIONS.memberships()).doc(id).get()).data() as Record<string, unknown>;
const bookingDoc = async (id: string) =>
  (await db.collection(COLLECTIONS.bookings()).doc(id).get()).data() as Record<string, unknown>;
const jobDoc = async (id: string) =>
  (await db.collection(COLLECTIONS.jobs()).doc(id).get()).data() as Record<string, unknown>;
const audits = async (entityId: string) =>
  (await db.collection(COLLECTIONS.auditLog()).where("entityId", "==", entityId).get()).docs.map((d) => d.data());

const customerAuthC1 = { uid: "c1", token: { role: "customer", tenantId: "t1", studioId: null }, rawToken: "test" };

async function seedCoveredState() {
  const mid = uid("m"), bid = uid("bk"), jobId = uid("job"), serviceId = uid("svc");
  const now = new Date().toISOString();
  await db.collection(COLLECTIONS.memberships()).doc(mid).set({
    id: mid, tenantId: "t1", customerId: "c1", status: "active",
    startDate: "2026-10-01", endDate: "2026-11-30",
    washesTotal: 5, washesUsed: 4, pickupsTotal: 2, pickupsUsed: 0,
  });
  await db.collection("services").doc(serviceId).set({ id: serviceId, tenantId: "t1", category: "wash", membershipWashEligible: true });
  await db.collection(COLLECTIONS.bookings()).doc(bid).set({
    id: bid, tenantId: "t1", studioId: null, customerId: "c1", serviceId, status: "CONFIRMED",
    scheduledAt: new Date(Date.now() + 72 * 3600000).toISOString(), totalAmount: 0, cancelCategories: ["wash"],
    membershipId: mid, membershipWashUsed: true, createdAt: now, updatedAt: now,
  });
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
    id: jobId, tenantId: "t1", studioId: null, bookingId: bid, customerId: "c1",
    status: "PENDING_VEHICLE", statusHistory: [], createdAt: now, updatedAt: now,
  });
  return { mid, bid, jobId };
}

beforeEach(async () => {
  h.targetPath = "";
  h.abortsRemaining = 0;
  h.abortAttempts = 0;
  await db.collection(COLLECTIONS.customers()).doc("c1").set({ id: "c1", authUid: "c1", tenantId: "t1", deletedAt: null });
  for (const col of [COLLECTIONS.bookings(), COLLECTIONS.jobs(), COLLECTIONS.memberships(), COLLECTIONS.auditLog(), COLLECTIONS.rateLimits()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("cancelBooking under a controlled aborted transaction (synthetic injection, honest label)", () => {
  it("an aborted attempt surfaces the abort and commits no business state; an unarmed retry succeeds exactly once", async () => {
    const { cancelBooking } = await import("../../functions/booking/cancelBooking.js");
    const { mid, bid, jobId } = await seedCoveredState();

    // Arm: abort every read of this booking inside a transaction until the
    // SDK retry loop is exhausted (more than its max attempts).
    h.targetPath = `${COLLECTIONS.bookings()}/${bid}`;
    h.abortsRemaining = 6;

    // Exact caller-error mapping for this direct-run harness: runCancel has no
    // catch around the cancel transaction, so the raw injected abort propagates
    // with its code and message intact - anything else here means the failure
    // was NOT the injected abort and the test must say so. (Through the
    // Functions HTTP runtime a non-HttpsError surfaces to clients as internal;
    // that mapping is framework behavior outside this harness.)
    const failure = await cancelBooking
      .run({ data: { bookingId: bid, reason: "changed plans" }, auth: customerAuthC1 } as never)
      .then(
        () => { throw new Error("cancel unexpectedly SUCCEEDED under an injected abort"); },
        (e: unknown) => e,
      );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as { code?: unknown }).code).toBe(10); // the injected ABORTED, not some other failure
    expect(String((failure as Error).message)).toContain("10 ABORTED");

    // The injection must actually have fired - a green test without it would
    // prove nothing about the failure branch.
    expect(h.abortAttempts).toBeGreaterThan(0);

    // Independent real-state check: the aborted attempt committed no business
    // state (booking, membership, job, audit). Not byte equality - the failed
    // call still consumed its pre-transaction rate-limit slot by design.
    const b = await bookingDoc(bid);
    expect(b["status"]).toBe("CONFIRMED");
    expect(b["membershipId"]).toBe(mid);
    expect(b["membershipWashUsed"]).toBe(true);
    expect((await membership(mid))["washesUsed"]).toBe(4); // no wash restored
    expect((await jobDoc(jobId))["status"]).toBe("PENDING_VEHICLE"); // job untouched
    expect((await audits(mid)).filter((x) => x["action"] === "membership.wash_restored").length).toBe(0);
    expect((await audits(bid)).filter((x) => x["action"] === "booking.cancelled").length).toBe(0);

    // Disarm and retry: exactly-once success on the same real state.
    h.abortsRemaining = 0;
    const res = (await cancelBooking.run({ data: { bookingId: bid, reason: "changed plans" }, auth: customerAuthC1 } as never)) as Record<string, unknown>;
    expect(res["success"]).toBe(true);
    expect((await bookingDoc(bid))["status"]).toBe("CANCELLED");
    expect((await membership(mid))["washesUsed"]).toBe(3); // exactly one restore, no double-count
    expect((await audits(mid)).filter((x) => x["action"] === "membership.wash_restored").length).toBe(1);

    // A further retry is a truthful no-op.
    const again = (await cancelBooking.run({ data: { bookingId: bid, reason: "changed plans" }, auth: customerAuthC1 } as never)) as Record<string, unknown>;
    expect(again["success"]).toBe(true);
    expect(again["alreadyCancelled"]).toBe(true);
    // Full post-retry invariants after the repeated cancel: still exactly one
    // restore and one cancel audit, job terminal, membership binding intact.
    expect((await membership(mid))["washesUsed"]).toBe(3); // still exactly one restore
    expect((await audits(mid)).filter((x) => x["action"] === "membership.wash_restored").length).toBe(1);
    expect((await audits(bid)).filter((x) => x["action"] === "booking.cancelled").length).toBe(1);
    expect((await jobDoc(jobId))["status"]).toBe("CANCELLED");
    const bf = await bookingDoc(bid);
    expect(bf["membershipId"]).toBe(mid);
    expect(bf["membershipWashUsed"]).toBe(true);
  }, 30000);
});
