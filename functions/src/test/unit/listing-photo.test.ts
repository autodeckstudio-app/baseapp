import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canServePublicPhoto } from "../../lib/public-listing.js";
import { approveListingPhotoSchema } from "../../schemas/carsale.js";

type L = Parameters<typeof canServePublicPhoto>[0];
const live: L = { status: "live", expiresAt: null, tenantId: "automodz", photoPaths: ["automodz/listings/a.jpg"] };
const withStatus = (status: string): L => ({ ...live, status: status as L["status"] });
const review = { tenantId: "automodz", sourcePath: "automodz/listings/a.jpg" };
const now = Date.now();

describe("canServePublicPhoto gates every request", () => {
  it("serves only a live/reserved, unexpired listing whose current photos include the reviewed path", () => {
    expect(canServePublicPhoto(live, review, now)).toBe(true);
    expect(canServePublicPhoto(withStatus("reserved"), review, now)).toBe(true);
  });
  it("fails closed: no review, not live, expired, tenant mismatch, or photo no longer on the listing", () => {
    expect(canServePublicPhoto(live, null, now)).toBe(false);
    for (const status of ["pending", "rejected", "sold", "draft"]) expect(canServePublicPhoto(withStatus(status), review, now), status).toBe(false);
    expect(canServePublicPhoto({ ...live, expiresAt: new Date(now - 1000).toISOString() }, review, now)).toBe(false);
    expect(canServePublicPhoto(live, { ...review, tenantId: "other" }, now)).toBe(false);
    expect(canServePublicPhoto({ ...live, photoPaths: ["automodz/listings/b.jpg"] }, review, now)).toBe(false);
  });
});

describe("approveListingPhotoSchema", () => {
  it("takes exactly listingId + photoPath", () => {
    expect(approveListingPhotoSchema.parse({ listingId: "abc12345", photoPath: "automodz/listings/a.jpg" })).toEqual({ listingId: "abc12345", photoPath: "automodz/listings/a.jpg" });
    expect(approveListingPhotoSchema.safeParse({ listingId: "abc12345" }).success).toBe(false);
    expect(approveListingPhotoSchema.safeParse({ listingId: "abc12345", photoPath: "p", extra: 1 }).success).toBe(false);
  });
});

describe("revocable handler and feed wiring (source)", () => {
  const fn = readFileSync(`${__dirname}/../../functions/carsale/listing-photo.ts`, "utf8");
  const feed = readFileSync(`${__dirname}/../../functions/carsale/carsale.ts`, "utf8");
  const idx = readFileSync(`${__dirname}/../../index.ts`, "utf8");
  it("handler re-checks the exact object generation per request and never caches", () => {
    expect(fn).toContain('res.setHeader("Cache-Control", "no-store")');
    expect(fn).toContain("String(meta.generation) !== review.sourceGeneration");
    expect(fn).toContain("bucket.file(review.sourcePath, { generation: review.sourceGeneration }).download()");
    expect(fn).toContain('res.status(404)');
    expect(fn).toContain("canServePublicPhoto(listing, review, Date.now())");
    expect(fn).not.toContain("makePublic");
    expect(fn).not.toContain("getSignedUrl");
  });
  it("approval pins generation + content sha of the reviewed bytes, tenant-checked, audited, hash-pinnable", () => {
    expect(feed).toContain('createHash("sha256")');
    expect(feed).toContain("assertTenant(user, listing.tenantId)");
    expect(feed).toContain('"carListing.photoApproved"');
    expect(feed).toContain('assertRole(user, "admin", "superadmin")');
    expect(feed).toContain("review.contentSha256 !== d.expectedSha256.toLowerCase()");
  });
  it("feed adds photoUrl only via the gate and keeps the raw-photo ban", () => {
    expect(feed).toContain("photoUrl: canServePublicPhoto(l, reviewBy.get(l.id)");
    expect(feed).toContain("?listingId=${l.id}");
    const view = readFileSync(`${__dirname}/../../lib/public-listing.ts`, "utf8");
    expect(view).toContain("out.photoUrls = [];");
  });
  it("both functions are exported", () => {
    expect(idx).toContain("approveListingPhoto");
    expect(idx).toContain("publicListingPhoto");
  });
});
