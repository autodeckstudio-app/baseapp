import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { submitMyPaper, finalizeMyPaper } from "../../functions/papers/submitMyPaper.js";
import { updateMyPaper } from "../../functions/papers/myPaperEdits.js";
const db = getFirestore(); const T = "ocr-e2e-tenant";
const img = readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png"));
async function run(label: string, vehiclePlate: string, kind: "INSURANCE" | "PUC", ctype = "image/png", bytes: Buffer = img) {
  const u = `ocr-cust-${label}-${Date.now()}`; const auth = { uid: u, token: { role: "customer", tenantId: T, studioId: null } };
  const vid = `ocr-veh-${label}-${Date.now()}`;
  await db.collection("vehicles").doc(vid).set({ id: vid, ownerId: u, tenantId: T, registrationNumber: vehiclePlate });
  const sub = await submitMyPaper.run({ data: { studioId: "s", vehicleId: vid, kind, reference: "SYN-" + label, contentType: ctype }, auth } as never) as { id: string; uploadUrl: string | null };
  const p = (await db.collection("papers").doc(sub.id).get()).data()!;
  // emulator cannot take the signed-URL PUT (501): land the bytes the way the PUT would (same path, content type, customerId metadata)
  await getStorage().bucket().file(p["evidencePath"]).save(bytes, { metadata: { contentType: ctype, metadata: { customerId: u } } });
  const fin = await finalizeMyPaper.run({ data: { paperId: sub.id }, auth } as never);
  const after = (await db.collection("papers").doc(sub.id).get()).data()!;
  expect(sub.uploadUrl).toBeTruthy();
  expect(fin).toMatchObject({ status: after["status"] });
  return after;
}
// Local E2E of the real callables with a SYNTHETIC text document (src/test/fixtures/synthetic-policy.png, generated, no real data).
// Needs the Storage emulator and a throwaway signing key (TEST_SIGN_CLIENT_EMAIL / TEST_SIGN_PRIVATE_KEY, see emulator-setup.ts);
// skipped otherwise. The signed-URL PUT itself is not exercised (the emulator returns 501): bytes are written at the
// server-recorded evidencePath the way that PUT would land them. Real IAM signing, browser PUT/CORS and the deployed
// runtime are NOT covered here.
describe.skipIf(!process.env["TEST_SIGN_PRIVATE_KEY"])("synthetic doc through submit -> storage -> finalize (emulator)", () => {
  it("match", async () => { const a = await run("match", "MH12AB1234", "INSURANCE"); expect(a["status"]).toBe("VERIFIED"); expect(a["verificationMode"]).toBe("automatic"); expect(a["extractedPlate"]).toBe("MH12AB1234"); expect(a["extractedExpiry"]).toBe("2027-12-31"); }, 90000);
  it("wrong plate", async () => { const a = await run("wrongplate", "MH12CD9999", "INSURANCE"); expect(a["status"]).toBe("PENDING"); expect(a["verificationReason"]).toMatch(/does not match vehicle/); expect(a["reviewedBy"]).toBeNull(); }, 90000);
  it("wrong kind", async () => { const a = await run("wrongkind", "MH12AB1234", "PUC"); expect(a["status"]).toBe("PENDING"); }, 90000);
  // PUC flip: a synthetic PUC certificate (src/test/fixtures/synthetic-puc.png, generated, no real data) filed as PUC verifies automatically; the same image filed as INSURANCE does not.
  const puc = readFileSync(resolve(__dirname, "../fixtures/synthetic-puc.png"));
  it("PUC match flips to VERIFIED", async () => { const a = await run("pucmatch", "MH12AB1234", "PUC", "image/png", puc); expect(a["status"]).toBe("VERIFIED"); expect(a["verificationMode"]).toBe("automatic"); expect(a["extractedPlate"]).toBe("MH12AB1234"); expect(a["extractedExpiry"]).toBe("2027-10-19"); }, 90000);
  it("PUC image filed as INSURANCE stays PENDING", async () => { const a = await run("puckind", "MH12AB1234", "INSURANCE", "image/png", puc); expect(a["status"]).toBe("PENDING"); }, 90000);
  it("non-image bytes fail closed to PENDING review", async () => { const a = await run("blank", "MH12AB1234", "INSURANCE", "image/png", Buffer.from("not an image")); expect(a["status"]).toBe("PENDING"); expect(a["verificationMode"]).toBe("review"); expect(a["reviewedBy"]).toBeNull(); }, 90000);
  it("edit with a new photo resets a VERIFIED paper to review, then finalize re-checks the new bytes", async () => {
    const u = `ocr-cust-edit-${Date.now()}`; const auth = { uid: u, token: { role: "customer", tenantId: T, studioId: null } };
    const vid = `ocr-veh-edit-${Date.now()}`;
    await db.collection("vehicles").doc(vid).set({ id: vid, ownerId: u, tenantId: T, registrationNumber: "MH12AB1234" });
    const sub = await submitMyPaper.run({ data: { studioId: "s", vehicleId: vid, kind: "INSURANCE", reference: "SYN-EDIT", contentType: "image/png" }, auth } as never) as { id: string };
    const land = async (bytes: Buffer) => { const p = (await db.collection("papers").doc(sub.id).get()).data()!; await getStorage().bucket().file(p["evidencePath"]).save(bytes, { metadata: { contentType: "image/png", metadata: { customerId: u } } }); };
    await land(img); await finalizeMyPaper.run({ data: { paperId: sub.id }, auth } as never);
    expect((await db.collection("papers").doc(sub.id).get()).data()!["status"]).toBe("VERIFIED");
    // owner edits the document and replaces the photo: back to review until the new bytes are checked
    const upd = await updateMyPaper.run({ data: { paperId: sub.id, reference: "SYN-EDIT-2", contentType: "image/png" }, auth } as never) as { uploadUrl: string | null };
    expect(upd.uploadUrl).toBeTruthy();
    const mid = (await db.collection("papers").doc(sub.id).get()).data()!;
    expect(mid["status"]).toBe("PENDING"); expect(mid["verificationMode"]).toBe("review"); expect(mid["reviewedBy"]).toBeNull();
    // non-image bytes after the edit fail closed to review
    await land(Buffer.from("not an image")); await finalizeMyPaper.run({ data: { paperId: sub.id }, auth } as never);
    const bad = (await db.collection("papers").doc(sub.id).get()).data()!;
    expect(bad["status"]).toBe("PENDING"); expect(bad["reference"]).toBe("SYN-EDIT-2");
    // matching bytes after another photo replacement verify again
    await updateMyPaper.run({ data: { paperId: sub.id, contentType: "image/png" }, auth } as never);
    await land(img); await finalizeMyPaper.run({ data: { paperId: sub.id }, auth } as never);
    const after = (await db.collection("papers").doc(sub.id).get()).data()!;
    expect(after["status"]).toBe("VERIFIED"); expect(after["verificationMode"]).toBe("automatic"); expect(after["reference"]).toBe("SYN-EDIT-2");
  }, 120000);
});
