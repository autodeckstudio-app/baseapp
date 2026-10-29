/**
 * Emulator integration: approveListingPhoto callable + publicListingPhoto handler against real
 * Firestore/Storage emulators. Covers positive byte serving, generation replacement revocation,
 * hash-pin refusal, tenant/role checks, and every 404 branch. Needs emulators on the env hosts
 * (defaults localhost:8080/9099/9199; this run used isolated 8180/8299/8399).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { approveListingPhoto } from "../../functions/carsale/carsale.js";
import { publicListingPhoto } from "../../functions/carsale/listing-photo.js";
import { PUBLIC_LISTING_PHOTOS } from "../../lib/public-listing.js";

const db = getFirestore();
const bucket = () => getStorage().bucket();
const PHOTO = Buffer.from(`reviewed-photo-bytes-${Date.now()}`);
const PHOTO_SHA = createHash("sha256").update(PHOTO).digest("hex");
const PATH = "automodz/listings/test-photo-emu.jpg";
const adminAuth = { uid: "admin-emu", token: { role: "admin", tenantId: "automodz", studioId: null }, rawToken: "t" };
let n = 0;

async function seedListing(over: Record<string, unknown> = {}) {
  n += 1;
  const id = `emu-listing-${Date.now()}-${n}`;
  await db.collection("carListings").doc(id).set({
    id, tenantId: "automodz", studioId: "studio-ahmedabad", status: "live", expiresAt: null, photoPaths: [PATH], createdAt: "2026-10-30", updatedAt: "2026-10-30", ...over,
  });
  await bucket().file(PATH).save(PHOTO, { contentType: "image/jpeg", resumable: false });
  return id;
}
const run = (data: Record<string, unknown>, auth: unknown = adminAuth) => approveListingPhoto.run({ data, auth, rawRequest: {} } as never);
async function get(listingId: string) {
  const req = { method: "GET", query: { listingId }, headers: {}, ip: "10.0.0.1" } as never;
  let status = 200; const headers: Record<string, string> = {}; let body: Buffer | string | undefined;
  const res = {
    status(c: number) { status = c; return res; },
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; return res; },
    send(b: unknown) { body = b as string; return res; },
    end(b?: unknown) { body = b as Buffer; return res; },
    headersSent: false, destroy() { return res; },
  } as never;
  await (publicListingPhoto as unknown as (a: unknown, b: unknown) => Promise<void>)(req, res);
  return { status, headers, body };
}

describe("approveListingPhoto + publicListingPhoto (emulator)", () => {
  it("approves: pins exact bytes/generation, writes review + audit", async () => {
    const id = await seedListing();
    const r = (await run({ listingId: id, photoPath: PATH, expectedSha256: PHOTO_SHA })) as { contentSha256: string };
    expect(r.contentSha256).toBe(PHOTO_SHA);
    const review = (await db.collection(PUBLIC_LISTING_PHOTOS).doc(id).get()).data() as { sourcePath: string; sourceGeneration: string; reviewedBy: string };
    expect(review.sourcePath).toBe(PATH);
    expect(review.reviewedBy).toBe("admin-emu");
    const [meta] = await bucket().file(PATH).getMetadata();
    expect(review.sourceGeneration).toBe(String(meta.generation));
    const audits = await db.collection("auditLog").where("entityId", "==", id).where("action", "==", "carListing.photoApproved").get();
    expect(audits.size).toBe(1);
  });

  it("hash pin: mismatched expectedSha256 refuses and writes nothing", async () => {
    const id = await seedListing();
    await expect(run({ listingId: id, photoPath: PATH, expectedSha256: "0".repeat(64) })).rejects.toThrow(/changed since review/);
    expect((await db.collection(PUBLIC_LISTING_PHOTOS).doc(id).get()).exists).toBe(false);
  });

  it("role/tenant/path checks refuse", async () => {
    const id = await seedListing();
    const customer = { uid: "c1", token: { role: "customer", tenantId: "automodz", studioId: null }, rawToken: "t" };
    await expect(run({ listingId: id, photoPath: PATH }, customer)).rejects.toThrow();
    const otherTenant = { uid: "a2", token: { role: "admin", tenantId: "other", studioId: null }, rawToken: "t" };
    await expect(run({ listingId: id, photoPath: PATH }, otherTenant)).rejects.toThrow();
    await expect(run({ listingId: id, photoPath: "automodz/listings/not-on-listing.jpg" })).rejects.toThrow(/not on this listing/);
    await expect(run({ listingId: id, photoPath: "other-tenant/listings/x.jpg" })).rejects.toThrow(/does not belong/);
  });

  it("handler serves the exact approved bytes with no-store", async () => {
    const id = await seedListing();
    await run({ listingId: id, photoPath: PATH });
    const r = await get(id);
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(createHash("sha256").update(r.body as Buffer).digest("hex")).toBe(PHOTO_SHA);
  });

  it("404s: no review, bad id, sold, expired, path removed, cross-tenant", async () => {
    const unreviewed = await seedListing();
    expect((await get(unreviewed)).status).toBe(404);
    expect((await get("bad id!!")).status).toBe(404);
    expect((await get(await seedListing({ status: "sold" }))).status).toBe(404);
    const exp = await seedListing({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await run({ listingId: exp, photoPath: PATH });
    expect((await get(exp)).status).toBe(404);
    const removed = await seedListing();
    await run({ listingId: removed, photoPath: PATH });
    await db.collection("carListings").doc(removed).update({ photoPaths: [] });
    expect((await get(removed)).status).toBe(404);
    const foreign = await seedListing({ tenantId: "other" });
    await db.collection(PUBLIC_LISTING_PHOTOS).doc(foreign).set({ tenantId: "other", sourcePath: PATH, sourceGeneration: "1", contentSha256: PHOTO_SHA, contentType: "image/jpeg", byteSize: 1, reviewedBy: "x", reviewedAt: "y" });
    expect((await get(foreign)).status).toBe(404);
  });

  it("generation replacement revokes: re-uploaded object 404s the old review", async () => {
    const id = await seedListing();
    await run({ listingId: id, photoPath: PATH });
    expect((await get(id)).status).toBe(200);
    await bucket().file(PATH).save(Buffer.from("replaced-bytes"), { contentType: "image/jpeg", resumable: false });
    expect((await get(id)).status).toBe(404);
  });
});
