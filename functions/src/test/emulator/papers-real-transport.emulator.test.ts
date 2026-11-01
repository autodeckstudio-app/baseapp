/**
 * REAL transport proof (no mocks) against the local firebase emulator stack (v15.34.2).
 *
 * What this file proves on real runtimes: the callable mints a genuinely SIGNED upload URL
 * (signature + content-md5 + create-only precondition in the signed headers), real bytes land
 * in real storage through the emulator's implemented upload API, the stored object carries a
 * real md5Hash, finalize binds the digest (and FAILS on a digest mismatch), the observed
 * generation is recorded, and the generation-pinned read returns the exact bytes.
 *
 * Hard emulator limit (verified in firebase-tools 15.34.2 source, not assumed): the storage
 * emulator's gcloud API router ends in a catch-all that answers 501 to anything it has no
 * route for - signed-URL PUT is one of those (lib/emulator/storage/apis/gcloud.js). So the
 * signed-PUT door itself CANNOT be exercised locally; attempts are run and their actual
 * statuses recorded as probes, and the byte-landing step uses the resumable/multipart upload
 * API the emulator DOES implement (the same protocol the Admin SDK uses). Signed-PUT
 * acceptance is provable only against real GCS, which is out of bounds for this proof.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createHash } from "node:crypto";
import { submitMyPaper, finalizeMyPaper } from "../../functions/papers/submitMyPaper.js";
import { getPrivateFileUrl } from "../../functions/files/getPrivateFileUrl.js";

const db = getFirestore();
const TENANT = "transport-tenant";
const auth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0xff, 0xd9]); // fake-jpeg bytes
const WRONG = new Uint8Array([9, 9, 9]);
const MD5 = createHash("md5").update(BYTES).digest("base64");

// The SDK already points signed URLs at the emulator host when FIREBASE_STORAGE_EMULATOR_HOST
// is set; extract bucket + object path from whatever host the URL carries.
function objectRef(signedUrl: string) {
  const u = new URL(signedUrl);
  const segs = u.pathname.replace(/^\//, "").split("/");
  return { bucket: segs[0], path: decodeURIComponent(segs.slice(1).join("/")) };
}
function expectGenuinelySigned(signedUrl: string) {
  const q = new URL(signedUrl).searchParams;
  expect(q.get("X-Goog-Algorithm")).toBe("GOOG4-RSA-SHA256");
  expect(q.get("X-Goog-Signature")).toBeTruthy();
  expect(q.get("X-Goog-SignedHeaders")).toContain("content-md5");
  expect(q.get("X-Goog-SignedHeaders")).toContain("x-goog-if-generation-match");
}
async function saveBytes(signedUrl: string, bytes: Uint8Array) {
  const { path } = objectRef(signedUrl);
  await getStorage().bucket().file(path).save(Buffer.from(bytes), { contentType: "image/jpeg" });
  return path;
}

describe("papers real transport (emulator, no mocks)", () => {
  it("signed mint -> real bytes in real storage -> finalize binds real md5Hash -> pinned read returns the exact bytes", async () => {
    const me = `cust-${Date.now()}`;
    const vid = `veh-${Date.now()}`;
    await db.collection("vehicles").doc(vid).set({ id: vid, ownerId: me, tenantId: TENANT, registrationNumber: "GJ01AB1234" });

    console.log("STEP: minting"); const mint: any = await submitMyPaper.run({ data: { studioId: "s", vehicleId: vid, kind: "INSURANCE", reference: `POL-${Date.now()}`, contentType: "image/jpeg", contentMd5: MD5 }, auth: auth(me) } as never); console.log("STEP: minted", String(mint.uploadUrl).slice(0,80));
    expectGenuinelySigned(mint.uploadUrl);
    expect(mint.requiredHeaders).toMatchObject({ "Content-Type": "image/jpeg", "x-goog-if-generation-match": "0", "Content-MD5": MD5 });

    // Probe: what does the emulator answer to the signed PUT itself? (Recorded, not assumed -
    // 501 by implementation in this version; see file header.)
    const probe = await fetch(mint.uploadUrl, { method: "PUT", headers: mint.requiredHeaders, body: BYTES });
    console.log("PROBE signed-PUT status:", probe.status);

    // Real bytes over real HTTP through the emulator's implemented upload API.
    console.log("STEP: uploading via implemented API"); const path = await saveBytes(mint.uploadUrl, BYTES); console.log("STEP: uploaded", path);
    const [meta] = await getStorage().bucket().file(path).getMetadata();
    console.log("STEP: stored md5Hash", meta.md5Hash, "generation", meta.generation);
    expect(meta.md5Hash).toBe(MD5);
    expect(meta.generation).toBeTruthy();

    // Finalize (real runtimes; OCR of junk bytes may fail -> manual review, fine): the decision
    // binds the observed generation and the digest compare passes against the real md5Hash.
    console.log("STEP: finalizing"); const fin: any = await finalizeMyPaper.run({ data: { paperId: mint.id }, auth: auth(me) } as never); console.log("STEP: finalized", fin.status);
    expect(["PENDING", "VERIFIED", "REJECTED"]).toContain(fin.status);
    const after = (await db.collection("papers").doc(mint.id).get()).data()!;
    expect(after.uploadedGeneration ?? after.evidenceGeneration).toBe(String(meta.generation));
    expect(after.expectedContentMd5).toBe(MD5);

    // The reader mints a generation-pinned signed READ URL; a real GET returns the exact bytes.
    const read: any = await getPrivateFileUrl.run({ data: { kind: "paper", id: mint.id }, auth: auth(me) } as never);
    expect(read.url).toContain("generation=");
    const got = await fetch(read.url);
    expect(got.status).toBe(200);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(BYTES);
  }, 60_000);

  it("digest mismatch is refused by finalize against REAL stored metadata (the binding that holds everywhere)", async () => {
    const me = `cust2-${Date.now()}`;
    const vid = `veh2-${Date.now()}`;
    await db.collection("vehicles").doc(vid).set({ id: vid, ownerId: me, tenantId: TENANT, registrationNumber: "GJ01AB1234" });
    const mint: any = await submitMyPaper.run({ data: { studioId: "s", vehicleId: vid, kind: "PUC", reference: `PUC-${Date.now()}`, contentType: "image/jpeg", contentMd5: MD5 }, auth: auth(me) } as never);
    expectGenuinelySigned(mint.uploadUrl);

    // Store DIFFERENT bytes than the declared digest; finalize must refuse (failed-precondition).
    await saveBytes(mint.uploadUrl, WRONG);
    console.log("STEP: finalizing against wrong bytes");
    await expect(finalizeMyPaper.run({ data: { paperId: mint.id }, auth: auth(me) } as never))
      .rejects.toMatchObject({ code: "failed-precondition" });
    console.log("STEP: wrong-bytes finalize refused as required");

    // Overwrite with the CORRECT bytes (new generation); finalize now binds and proceeds.
    await saveBytes(mint.uploadUrl, BYTES);
    const fin: any = await finalizeMyPaper.run({ data: { paperId: mint.id }, auth: auth(me) } as never);
    expect(["PENDING", "VERIFIED", "REJECTED"]).toContain(fin.status);

    // Signed-PUT probes on a FRESH object's own mint (no compound state): recorded, not assumed.
    const mint2: any = await submitMyPaper.run({ data: { studioId: "s", vehicleId: vid, kind: "PUC", reference: `PUC2-${Date.now()}`, contentType: "image/jpeg", contentMd5: MD5 }, auth: auth(me) } as never);
    const first2 = await fetch(mint2.uploadUrl, { method: "PUT", headers: mint2.requiredHeaders, body: BYTES });
    const again = await fetch(mint2.uploadUrl, { method: "PUT", headers: mint2.requiredHeaders, body: BYTES });
    console.log("PROBE create-only fresh-object statuses first/second:", first2.status, again.status);
  }, 60_000);

  it("no-photo flow on real runtimes: submit without bytes sits PENDING, never an upload binding", async () => {
    const me = `cust3-${Date.now()}`;
    const vid = `veh3-${Date.now()}`;
    await db.collection("vehicles").doc(vid).set({ id: vid, ownerId: me, tenantId: TENANT, registrationNumber: "GJ01AB1234" });
    const mint: any = await submitMyPaper.run({ data: { studioId: "s", vehicleId: vid, kind: "OTHER", title: "Card", reference: `OTH-${Date.now()}` }, auth: auth(me) } as never);
    expect(mint.uploadUrl).toBeNull();
    // The real client does NOT call finalize for a no-photo submit (no bytes ever land):
    // the record sits PENDING for manual review. Assert that truth directly from the
    // submit read-back instead of driving a finalize the client never makes.
    const after = (await db.collection("papers").doc(mint.id).get()).data()!;
    expect(after.status).toBe("PENDING");
    expect(after.evidencePath).toBeNull();
    expect(after.uploadedGeneration ?? null).toBeNull();
    expect(after.evidenceGeneration ?? null).toBeNull();
    expect(after.expectedContentMd5 ?? null).toBeNull();
    // The reader refuses cleanly: no file stored for this record.
    await expect(getPrivateFileUrl.run({ data: { kind: "paper", id: mint.id }, auth: auth(me) } as never)).rejects.toMatchObject({ code: "not-found" });
  }, 60_000);
});
