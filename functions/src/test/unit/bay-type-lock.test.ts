import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { bayTypeLockRef, cancelledHeldJobIds, readBayTypeLocks, runCapacityTransaction, writeBayTypeLocks } from "../../lib/bay-type-lock.js";

// Minimal fakes: enough to observe the lock-read order and concurrency of readBayTypeLocks.
const db = { collection: (c: string) => ({ doc: (id: string) => ({ path: `${c}/${id}` }) }) } as unknown as Firestore;
function recordingTx() {
  const events: string[] = [];
  let inFlight = 0, maxInFlight = 0;
  const tx = {
    get: async (ref: { path: string }) => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); events.push("get " + ref.path); await new Promise((r) => setTimeout(r, 1)); inFlight--; return {}; },
    set: (ref: { path: string }, data: unknown) => { events.push("set " + ref.path + " " + JSON.stringify(data)); },
  } as unknown as Transaction;
  return { tx, events, maxInFlight: () => maxInFlight };
}

describe("bay-type lock helper", () => {
  it("uses the agreed lock document id", () => {
    expect((bayTypeLockRef(db, "t", "s", "wash") as unknown as { path: string }).path).toBe("bayLocks/t__s__type__wash");
  });

  it("reads each type once, in sorted order, one at a time (consistent lock order, no parallel reads)", async () => {
    const r = recordingTx();
    const refs = await readBayTypeLocks(r.tx, db, "t", "s", ["wash", "protection", "general", "wash"]);
    expect(r.events).toEqual(["get bayLocks/t__s__type__general", "get bayLocks/t__s__type__protection", "get bayLocks/t__s__type__wash"]);
    expect(r.maxInFlight()).toBe(1);
    writeBayTypeLocks(r.tx, refs, "2027-01-04T09:00:00.000Z");
    expect(r.events.slice(3)).toEqual(["general", "protection", "wash"].map((t) => `set bayLocks/t__s__type__${t} {"lastAssignedAt":"2027-01-04T09:00:00.000Z"}`));
  });

  // Supplementary call-site guard (the behaviour above is the primary proof): in every capacity-changing transaction
  // the type lock is read before the per-bay lock and before the occupancy read, and is written with the allocation.
  it("every capacity-changing path takes the type lock before its per-bay lock and occupancy read", () => {
    const paths: Array<[string, RegExp | null, RegExp]> = [
      ["src/functions/booking/createBooking.ts", /__\$\{assignedBayId\}`/, /where\("bayId", "==", bay\.id\)/],
      ["src/lib/reschedule-move.ts", null, /where\("bayId", "==", bay\.id\)/],
      ["src/functions/job/assignBay.ts", /__\$\{data\.bayId\}`\);/, /where\("bayId", "==", data\.bayId\)/],
      ["src/functions/job/createWalkinJob.ts", /__\$\{data\.bayId\}`\);/, /where\("bayId", "==", data\.bayId\)/],
      ["src/functions/job/standbyBooking.ts", /const bayLock = db\.collection/, /const allJobs = await tx\.get/],
      ["src/functions/visit/visitBay.ts", /const locks=\[\.\.\.new Set\(\[bay\.id,/, /const occupancy=await tx\.get/],
      ["src/functions/visit/visitSchedule.ts", /const locks=\[\.\.\.new Set\(\[\.\.\.r\.active/, /where\('bayId','==',p\.bay\.id\)/],
      ["src/functions/studio/upsertBay.ts", null, /physicallyHeldBayIds\(\(q\)/],
      ["src/functions/job/advanceJobStatus.ts", /__\$\{freshJob\.bayId\}`\);/, /const bayJobsSnap = await tx\.get/],
    ];
    for (const [file, perBay, occupancy] of paths) {
      const s = readFileSync(resolve(process.cwd(), file), "utf8");
      const lock = s.search(/readBayTypeLocks\(tx/);
      expect(lock, file).toBeGreaterThan(-1);
      if (perBay) expect(lock, file + " per-bay").toBeLessThan(s.search(perBay));
      expect(lock, file + " occupancy").toBeLessThan(s.search(occupancy));
      expect(s, file).toMatch(/writeBayTypeLocks\(tx/);
    }
  });

  it("two paths locking the same types in different input order acquire them in the same order", async () => {
    const a = recordingTx(), b = recordingTx();
    await readBayTypeLocks(a.tx, db, "t", "s", ["protection", "general"]);
    await readBayTypeLocks(b.tx, db, "t", "s", ["general", "protection"]);
    expect(a.events).toEqual(b.events);
  });
});

describe("runCapacityTransaction", () => {
  const closed = Object.assign(new Error("3 INVALID_ARGUMENT: Transaction is invalid or closed"), { code: 3 });
  const fakeDb = (outcomes: Array<Error | string>) => { let calls = 0; return { calls: () => calls, db: { runTransaction: async () => { const o = outcomes[calls++]; if (o instanceof Error) throw o; return o; } } as unknown as Firestore }; };

  it("retries a transaction closed before commit and returns the fresh attempt's result", async () => {
    const f = fakeDb([closed, "committed"]);
    await expect(runCapacityTransaction(f.db, async () => "x")).resolves.toBe("committed");
    expect(f.calls()).toBe(2);
  });
  it("is bounded, and rethrows every other error unchanged without retrying", async () => {
    const f = fakeDb([closed, closed, closed, "never"]);
    await expect(runCapacityTransaction(f.db, async () => "x")).rejects.toThrow(/invalid or closed/);
    expect(f.calls()).toBe(3);
    const occupied = Object.assign(new Error("Bay is still occupied"), { code: "resource-exhausted" });
    const g = fakeDb([occupied, "never"]);
    await expect(runCapacityTransaction(g.db, async () => "x")).rejects.toBe(occupied);
    expect(g.calls()).toBe(1);
    const otherInvalid = Object.assign(new Error("3 INVALID_ARGUMENT: bad field"), { code: 3 });
    const h = fakeDb([otherInvalid, "never"]);
    await expect(runCapacityTransaction(h.db, async () => "x")).rejects.toBe(otherInvalid);
    expect(h.calls()).toBe(1);
  });
});

it("cancelledHeldJobIds returns only the in-memory-checked cancelled jobs still holding this bay", async () => {
  const rows = [
    { id: "held", status: "CANCELLED", heldAfterCancel: true, studioId: "s", bayId: "b1" },
    { id: "released", status: "CANCELLED", heldAfterCancel: false, studioId: "s", bayId: "b1" },
    { id: "plain-cancel", status: "CANCELLED", studioId: "s", bayId: "b1" },
    { id: "ready", status: "READY_FOR_DELIVERY", heldAfterCancel: true, studioId: "s", bayId: "b1" },
    { id: "other-bay", status: "CANCELLED", heldAfterCancel: true, studioId: "s", bayId: "b2" },
    { id: "other-studio", status: "CANCELLED", heldAfterCancel: true, studioId: "x", bayId: "b1" },
  ];
  // A fake that ignores every where() filter, so only the in-memory re-check can narrow the result.
  const q: Record<string, unknown> = {}; q["where"] = () => q;
  const fakeDb = { collection: () => q } as unknown as Firestore;
  const get = (async () => ({ docs: rows.map((r) => ({ id: r.id, data: () => r })) })) as never;
  expect(await cancelledHeldJobIds(get, fakeDb, "s", "b1")).toEqual(["held"]);
});
