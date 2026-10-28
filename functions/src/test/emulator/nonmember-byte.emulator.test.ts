import { describe, it, expect, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBooking as current } from "../../functions/booking/createBooking.js";
const db = getFirestore();
describe("real nonmember booking baseline vs covered diff", () => {
  it("writes byte-identical full job with snapshot field absent, fixed ids/time", async () => {
    for (const row of JSON.parse(
      readFileSync(resolve(__dirname, "../fixtures/nonmember-byte-inputs.json"), "utf8"),
    ))
      await db.collection(row.collection).doc(row.id).set(row.data);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T09:00:00Z"));
    const proto = Object.getPrototypeOf(db.collection("jobs")),
      orig = proto.doc;
    const spy = vi.spyOn(proto, "doc").mockImplementation(function (
      this: { path: string },
      ...args: unknown[]
    ) {
      if (args.length === 0 && ["jobs", "bookings"].includes(this.path))
        return orig.call(this, "fx-nonmember-byte");
      return orig.apply(this, args);
    });
    const request = {
      data: {
        serviceId: "svc-rule-fixture",
        vehicleId: "3fGoNM3LQQyZnbLUxt19",
        vehicleCategory: "hatchback",
        studioId: "studio-ahmedabad",
        scheduledDate: "2026-10-31",
        scheduledTime: "15:00",
        payMode: "studio",
        idempotencyKey: "fx-nonmember-byte",
      },
      auth: {
        uid: "L7QxPdcsJ60NwLUyfHj3Zc2mH1oB",
        token: { role: "customer", tenantId: "automodz", studioId: null },
      },
    };
    async function clear() {
      await db.collection("bookings").doc("fx-nonmember-byte").delete();
      await db.collection("jobs").doc("fx-nonmember-byte").delete();
      await db.collection("bookingIntents").doc("fx-nonmember-byte").delete();
    }
    try {
      const b = JSON.parse(
        readFileSync(resolve(__dirname, "../fixtures/nonmember-baseline-job.json"), "utf8"),
      );
      await clear();
      await current.run(request as never);
      const a = (await db.collection("jobs").doc("fx-nonmember-byte").get()).data()!;
      expect("membershipWashUsed" in a).toBe(false);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      // Evidence output only (after the assertions above); the harness creates its own directory.
      mkdirSync("/downloads/evidence", { recursive: true });
      writeFileSync("/downloads/evidence/nonmember-baseline-job.json", JSON.stringify(b, null, 2));
      writeFileSync("/downloads/evidence/nonmember-current-job.json", JSON.stringify(a, null, 2));
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  });
});
