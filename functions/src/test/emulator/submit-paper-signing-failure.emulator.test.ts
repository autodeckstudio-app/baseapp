/**
 * Regression guard (round 7): if minting the upload URL fails, submitMyPaper must have written NOTHING.
 * Before the fix the paper and its number lock were committed first, so the customer saw an error while
 * an orphan PENDING paper held the number and blocked the retry. Real Firestore emulator; the storage
 * signer is a SIMULATED failure, so the actual signed-URL upload path stays unverified here.
 */
import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ signFails: true }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ getSignedUrl: async () => { if (h.signFails) throw new Error("simulated signing failure"); return ["https://signed.example/put"]; } }) }) }),
}));

import { getFirestore } from "firebase-admin/firestore";
import { submitMyPaper } from "../../functions/papers/submitMyPaper.js";

const db = getFirestore();
const TENANT = "sign-fail-tenant";
const uid = `cust-${Date.now()}`;
const auth = { uid, token: { role: "customer", tenantId: TENANT, studioId: null } };
const submit = (data: Record<string, unknown>) => submitMyPaper.run({ data: { studioId: "s", ...data }, auth } as never);
const papers = async () => (await db.collection("papers").where("customerId", "==", uid).get()).docs;

describe("submitMyPaper when upload-URL signing fails (emulator)", () => {
  it("writes no paper and holds no number; a retry with the same number succeeds", async () => {
    await db.collection("vehicles").doc(`veh-sign-${uid}`).set({ id: `veh-sign-${uid}`, ownerId: uid, tenantId: TENANT, registrationNumber: "GJ01AB1234" });
    h.signFails = true;
    await expect(submit({ vehicleId: `veh-sign-${uid}`, kind: "INSURANCE", reference: "POL 4242", contentType: "image/png" })).rejects.toThrow();
    expect(await papers()).toHaveLength(0);

    h.signFails = false;
    const ok = await submit({ vehicleId: `veh-sign-${uid}`, kind: "INSURANCE", reference: "POL 4242", contentType: "image/png" }) as { id: string; uploadUrl: string | null };
    expect(ok.uploadUrl).toBe("https://signed.example/put");
    expect(await papers()).toHaveLength(1);
  });

  it("a failed RC submit does not claim the car's RC slot", async () => {
    await db.collection("vehicles").doc(`veh-sign-rc-${uid}`).set({ id: `veh-sign-rc-${uid}`, ownerId: uid, tenantId: TENANT, registrationNumber: "GJ01AB1234" });
    h.signFails = true;
    await expect(submit({ vehicleId: `veh-sign-rc-${uid}`, kind: "RC", reference: "GJ01AB1234", contentType: "image/png" })).rejects.toThrow();
    h.signFails = false;
    await expect(submit({ vehicleId: `veh-sign-rc-${uid}`, kind: "RC", reference: "GJ01AB1234" })).resolves.toMatchObject({ id: expect.any(String) });
  });
});
