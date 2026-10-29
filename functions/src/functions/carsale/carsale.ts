// Cars for sale: studio stock plus customer submissions behind admin approval.
// Everything goes through callables so private seller data never reaches a buyer.
import { canServePublicPhoto, PUBLIC_LISTING_PHOTOS, publicListingView, type PublicListingPhotoReview } from "../../lib/public-listing.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createHash, randomUUID } from "node:crypto";
import { FIRST_STUDIO_ID, FIRST_TENANT_ID, type CarLead, type CarListing, type CarListingView } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import {
  adminSaveListingSchema,
  expressInterestSchema,
  issueListingPhotoUploadUrlSchema,
  listCarLeadsSchema,
  listCarListingsSchema,
  markMyListingSoldSchema,
  removeMyListingPhotoSchema,
  replaceMyListingPhotoSchema,
  noContactInText,
  approveListingPhotoSchema,
  reviewListingSchema,
  setLeadStatusSchema,
  submitMyListingSchema,
} from "../../schemas/carsale.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const SIXTY_DAYS = 60 * 24 * 3600 * 1000;
const col = () => getFirestore().collection(COLLECTIONS.carListings());

function checkPhotos(paths: string[], tenantId: string): void {
  for (const p of paths) {
    if (!p.startsWith(`${tenantId}/listings/`) || p.includes("..")) throw new HttpsError("invalid-argument", "A photo does not belong to this studio.");
  }
}
function checkText(description: string | null | undefined): void {
  if (!noContactInText(description)) throw new HttpsError("invalid-argument", "Please leave phone numbers and links out of the description.");
}

// Admin or customer: short-lived signed PUT URL for one listing photo.
export const issueListingPhotoUploadUrl = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "admin", "superadmin");
  const data = validate(issueListingPhotoUploadUrlSchema, request.data);
  await enforceRateLimit(subjectFrom(user), user.claims.role === "customer" ? "paper.submit" : "gallery.create");
  const path = `${user.claims.tenantId}/listings/${randomUUID()}.${EXT[data.contentType]}`;
  const [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 10 * 60 * 1000, contentType: data.contentType });
  return { uploadUrl, path, requiredHeaders: { "Content-Type": data.contentType } };
});

// Admin: create or edit a listing (studio stock, or fix up a customer's), set draft/live/reserved/sold.
export const adminSaveListing = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const d = validate(adminSaveListingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");
  checkPhotos(d.photoPaths, user.claims.tenantId);
  checkText(d.description);
  const now = new Date().toISOString();
  const ref = d.listingId ? col().doc(d.listingId) : col().doc();
  const snap = d.listingId ? await ref.get() : null;
  if (d.listingId && !snap?.exists) throw new HttpsError("not-found", "Listing not found.");
  const cur = snap?.exists ? (snap.data() as CarListing) : null;
  if (cur) assertTenant(user, cur.tenantId);
  const goingLive = d.status === "live" && cur?.status !== "live";
  const listing: CarListing = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: cur?.studioId ?? FIRST_STUDIO_ID,
    source: cur?.source ?? "studio",
    sellerId: cur?.sellerId ?? null,
    status: d.status,
    make: d.make, model: d.model, variant: d.variant ?? null, year: d.year, kmDriven: d.kmDriven, fuel: d.fuel, gearbox: d.gearbox,
    bodyType: d.bodyType ?? cur?.bodyType ?? null,
    owners: d.owners, colour: d.colour, area: d.area, askingPrice: d.askingPrice, description: d.description ?? null,
    insuranceValidTill: d.insuranceValidTill ?? null, photoPaths: d.photoPaths,
    sellerName: d.sellerName ?? cur?.sellerName ?? null,
    sellerPhone: d.sellerPhone ?? cur?.sellerPhone ?? null,
    registrationNumber: d.registrationNumber ?? cur?.registrationNumber ?? null,
    reservePrice: d.reservePrice ?? cur?.reservePrice ?? null,
    adminNotes: d.adminNotes ?? cur?.adminNotes ?? null,
    rejectionReason: null,
    createdAt: cur?.createdAt ?? now,
    updatedAt: now,
    approvedAt: goingLive ? now : cur?.approvedAt ?? null,
    expiresAt: goingLive ? new Date(Date.now() + SIXTY_DAYS).toISOString() : cur?.expiresAt ?? null,
  };
  await getFirestore().runTransaction(async (tx) => {
    tx.set(ref, listing);
    writeAuditLog(tx, { action: "carListing.saved", entityType: "carListing", entityId: ref.id, user, studioId: listing.studioId, after: { status: listing.status } });
  });
  return { id: ref.id };
});

// Customer: submit (or edit) their own car. Always lands PENDING; the owner comes from the login, not the client.
export const submitMyListing = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const d = validate(submitMyListingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");
  checkPhotos(d.photoPaths, user.claims.tenantId);
  checkText(d.description);
  const now = new Date().toISOString();
  const ref = d.listingId ? col().doc(d.listingId) : col().doc();
  const snap = d.listingId ? await ref.get() : null;
  const cur = snap?.exists ? (snap.data() as CarListing) : null;
  if (d.listingId && !cur) throw new HttpsError("not-found", "Listing not found.");
  if (cur && (cur.sellerId !== user.uid || cur.tenantId !== user.claims.tenantId)) throw new HttpsError("permission-denied", "This is not your listing.");
  const listing: CarListing = {
    id: ref.id, tenantId: user.claims.tenantId, studioId: cur?.studioId ?? FIRST_STUDIO_ID, source: "customer", sellerId: user.uid, status: "pending",
    make: d.make, model: d.model, variant: d.variant ?? null, year: d.year, kmDriven: d.kmDriven, fuel: d.fuel, gearbox: d.gearbox, bodyType: d.bodyType ?? null, owners: d.owners,
    colour: d.colour, area: d.area, askingPrice: d.askingPrice, description: d.description ?? null, insuranceValidTill: d.insuranceValidTill ?? null, photoPaths: d.photoPaths,
    sellerName: d.sellerName, sellerPhone: d.sellerPhone, registrationNumber: d.registrationNumber ?? null,
    reservePrice: cur?.reservePrice ?? null, adminNotes: cur?.adminNotes ?? null, rejectionReason: null,
    createdAt: cur?.createdAt ?? now, updatedAt: now, approvedAt: null, expiresAt: null,
  };
  await getFirestore().runTransaction(async (tx) => {
    tx.set(ref, listing);
    writeAuditLog(tx, { action: "carListing.submitted", entityType: "carListing", entityId: ref.id, user, studioId: listing.studioId, after: { status: "pending" } });
  });
  return { id: ref.id };
});

// Customer: mark their own car as sold. It leaves the buyer list at once and shows as Sold to the seller and in admin.
export const markMyListingSold = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const d = validate(markMyListingSoldSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");
  const ref = col().doc(d.listingId);
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Listing not found.");
    const cur = snap.data() as CarListing;
    if (cur.sellerId !== user.uid || cur.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "This is not your listing.");
    if (cur.status === "sold") return;
    if (cur.status !== "live" && cur.status !== "reserved" && cur.status !== "pending") throw new HttpsError("failed-precondition", "This listing can not be marked as sold.");
    tx.update(ref, { status: "sold", updatedAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "carListing.sold", entityType: "carListing", entityId: ref.id, user, studioId: cur.studioId, before: { status: cur.status }, after: { status: "sold" } });
  });
  return { id: ref.id };
});

// Admin: approve (goes live for 60 days) or reject with a reason the seller can read.
// Seller removes one photo from their own listing. Owner only, one photo and its own object, never the listing or other photos.
// Photos are addressed by position (the seller sees signed URLs, not paths); expectedCount guards against a stale view.
export const removeMyListingPhoto = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const d = validate(removeMyListingPhotoSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");
  const ref = col().doc(d.listingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Listing not found.");
  const cur = snap.data() as CarListing;
  if (cur.sellerId !== user.uid || cur.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "This is not your listing.");
  if (cur.status === "sold") throw new HttpsError("failed-precondition", "This listing is closed.");
  if (cur.photoPaths.length !== d.expectedCount || d.index >= cur.photoPaths.length) throw new HttpsError("aborted", "Your photos changed. Refresh and try again.");
  if (cur.photoPaths.length <= 1) throw new HttpsError("failed-precondition", "A listing needs at least one photo. Use Replace to swap this photo for a different one.");
  const path = cur.photoPaths[d.index]!;
  checkPhotos([path], cur.tenantId);
  // Object first. A Storage failure leaves the listing untouched so a retry is safe. A missing object is fine.
  try { await getStorage().bucket().file(path).delete({ ignoreNotFound: true }); }
  catch { throw new HttpsError("unavailable", "Could not remove the photo. Nothing was changed. Try again."); }
  await getFirestore().runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data() as CarListing;
    if (fresh.sellerId !== user.uid) throw new HttpsError("permission-denied", "This is not your listing.");
    const next = fresh.photoPaths.filter((p) => p !== path);
    if (next.length === 0) throw new HttpsError("failed-precondition", "A listing needs at least one photo.");
    tx.update(ref, { photoPaths: next, updatedAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "carListing.photoRemoved", entityType: "carListing", entityId: ref.id, user, studioId: fresh.studioId, before: { photos: fresh.photoPaths.length }, after: { photos: next.length } });
  });
  return { id: ref.id };
});

// Seller replaces one photo on their own listing. The new file is uploaded first through issueListingPhotoUploadUrl; this call swaps it in
// at that position inside a transaction (owner, expectedCount and the old path are re-checked, so a concurrent edit cannot be overwritten), then
// removes the old object. Old-object removal is best effort: if Storage fails the listing already shows the new photo and a leftover file may remain.
export const replaceMyListingPhoto = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const d = validate(replaceMyListingPhotoSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");
  const ref = col().doc(d.listingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Listing not found.");
  const cur = snap.data() as CarListing;
  if (cur.sellerId !== user.uid || cur.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "This is not your listing.");
  if (cur.status === "sold") throw new HttpsError("failed-precondition", "This listing is closed.");
  if (cur.photoPaths.length !== d.expectedCount || d.index >= cur.photoPaths.length) throw new HttpsError("aborted", "Your photos changed. Refresh and try again.");
  checkPhotos([d.newPath], cur.tenantId);
  if (cur.photoPaths.includes(d.newPath)) throw new HttpsError("invalid-argument", "That photo is already on this listing.");
  const [uploaded] = await getStorage().bucket().file(d.newPath).exists();
  if (!uploaded) throw new HttpsError("failed-precondition", "The new photo did not upload. Try again.");
  const oldPath = cur.photoPaths[d.index]!;
  await getFirestore().runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data() as CarListing;
    if (fresh.sellerId !== user.uid) throw new HttpsError("permission-denied", "This is not your listing.");
    if (fresh.photoPaths[d.index] !== oldPath || fresh.photoPaths.length !== d.expectedCount) throw new HttpsError("aborted", "Your photos changed. Refresh and try again.");
    const next = fresh.photoPaths.map((p, i) => (i === d.index ? d.newPath : p));
    tx.update(ref, { photoPaths: next, updatedAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "carListing.photoReplaced", entityType: "carListing", entityId: ref.id, user, studioId: fresh.studioId, before: { photos: fresh.photoPaths.length }, after: { photos: next.length } });
  });
  let oldRemoved = true;
  try { checkPhotos([oldPath], cur.tenantId); await getStorage().bucket().file(oldPath).delete({ ignoreNotFound: true }); } catch { oldRemoved = false; }
  return { id: ref.id, oldRemoved };
});

export const reviewListing = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const d = validate(reviewListingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");
  if (d.decision === "reject" && !d.reason?.trim()) throw new HttpsError("invalid-argument", "Add a short reason for the seller.");
  const ref = col().doc(d.listingId);
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Listing not found.");
    const cur = snap.data() as CarListing;
    assertTenant(user, cur.tenantId);
    const now = new Date().toISOString();
    tx.update(ref, d.decision === "approve"
      ? { status: "live", approvedAt: now, expiresAt: new Date(Date.now() + SIXTY_DAYS).toISOString(), rejectionReason: null, updatedAt: now }
      : { status: "rejected", rejectionReason: d.reason ?? null, updatedAt: now });
    writeAuditLog(tx, { action: "carListing.reviewed", entityType: "carListing", entityId: ref.id, user, studioId: cur.studioId, after: { decision: d.decision } });
  });
  return { id: ref.id };
});

// Admin: pin ONE reviewed photo as the public cover. Re-approving replaces the pin; removing or
// replacing the photo on the listing revokes it automatically (path/generation no longer matches).
// expectedSha256 pins an approval to exact reviewed bytes: a changed photo can never be silently approved.
export const approveListingPhoto = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const d = validate(approveListingPhotoSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.carListings()).doc(d.listingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Listing not found.");
  const listing = snap.data() as CarListing;
  assertTenant(user, listing.tenantId);
  if (!d.photoPath.startsWith(`${listing.tenantId}/listings/`) || d.photoPath.includes(".."))
    throw new HttpsError("invalid-argument", "That photo does not belong to this studio.");
  if (!listing.photoPaths.includes(d.photoPath)) throw new HttpsError("invalid-argument", "That photo is not on this listing.");
  const file = getStorage().bucket().file(d.photoPath);
  const [bytes] = await file.download();
  const [meta] = await file.getMetadata();
  const review: PublicListingPhotoReview = {
    tenantId: listing.tenantId,
    sourcePath: d.photoPath,
    sourceGeneration: String(meta.generation),
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
    contentType: typeof meta.contentType === "string" ? meta.contentType : "image/jpeg",
    byteSize: bytes.byteLength,
    reviewedBy: user.uid,
    reviewedAt: new Date().toISOString(),
  };
  if (d.expectedSha256 && review.contentSha256 !== d.expectedSha256.toLowerCase())
    throw new HttpsError("failed-precondition", "The photo bytes changed since review. Nothing was approved.");
  await db.runTransaction(async (tx) => {
    tx.set(db.collection(PUBLIC_LISTING_PHOTOS).doc(d.listingId), review);
    writeAuditLog(tx, {
      action: "carListing.photoApproved", entityType: "carListing", entityId: d.listingId, user, studioId: listing.studioId,
      after: { sourcePath: d.photoPath, contentSha256: review.contentSha256, byteSize: review.byteSize },
    });
  });
  return { listingId: d.listingId, contentSha256: review.contentSha256 };
});

async function view(l: CarListing, uid: string): Promise<CarListingView> {
  const bucket = getStorage().bucket();
  const photoUrls = await Promise.all(l.photoPaths.map(async (p) => (await bucket.file(p).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 3600 * 1000 }))[0]));
  return { id: l.id, source: l.source, status: l.status, make: l.make, model: l.model, variant: l.variant, year: l.year, kmDriven: l.kmDriven, fuel: l.fuel, gearbox: l.gearbox, bodyType: l.bodyType ?? null, owners: l.owners, colour: l.colour, area: l.area, askingPrice: l.askingPrice, description: l.description, insuranceValidTill: l.insuranceValidTill, photoUrls, mine: l.sellerId === uid, rejectionReason: l.sellerId === uid ? l.rejectionReason : null, createdAt: l.createdAt };
}

/** A customer sees the asking price only on their own listing, or after asking the studio for it. Staff always see it. */
export function gatePrice(v: CarListingView, who: { role: string; uid: string; sellerId: string | null | undefined; asked: Set<string> }): CarListingView {
  if (who.role !== "customer" || who.sellerId === who.uid || who.asked.has(v.id)) return v;
  return { ...v, askingPrice: 0, priceHidden: true };
}

// Customers: live and reserved listings (not expired), plus their own in any status. Staff with includeAll get private fields too.
export const listCarListings = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const d = validate(listCarListingsSchema, request.data ?? {});
  await enforceRateLimit(subjectFrom(user), "gallery.read");
  const staffAll = user.claims.role !== "customer" && d.includeAll === true;
  const snap = await col().where("tenantId", "==", user.claims.tenantId).limit(300).get();
  const now = Date.now();
  const all = snap.docs.map((x) => x.data() as CarListing);
  if (staffAll) {
    all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const out = await Promise.all(all.slice(0, 150).map(async (l) => ({ ...(await view(l, user.uid)), status: l.status, sellerName: l.sellerName, sellerPhone: l.sellerPhone, registrationNumber: l.registrationNumber, reservePrice: l.reservePrice, adminNotes: l.adminNotes, photoPaths: l.photoPaths, expiresAt: l.expiresAt })));
    return { listings: out };
  }
  const keep = all
    .filter((l) => (d.mine === true ? l.sellerId === user.uid : (l.status === "live" || l.status === "reserved") && (!l.expiresAt || Date.parse(l.expiresAt) > now)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  // A customer sees an asking price only for their own listings, or after they asked the studio for it (an "interest" lead).
  const asked = new Set<string>();
  if (user.claims.role === "customer") {
    const leads = await getFirestore().collection(COLLECTIONS.carLeads()).where("buyerId", "==", user.uid).get();
    for (const x of leads.docs) { const ld = x.data() as CarLead; if (ld.kind === "interest") asked.add(ld.listingId); }
  }
  return {
    listings: await Promise.all(keep.map(async (l) => {
      return gatePrice(await view(l, user.uid), { role: user.claims.role, uid: user.uid, sellerId: l.sellerId, asked });
    })),
  };
});

// Customer: "I'm interested" or "Report this listing". Goes to the admin inbox; seller details are never shared.
export const expressInterest = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const d = validate(expressInterestSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");
  const lsnap = await col().doc(d.listingId).get();
  if (!lsnap.exists) throw new HttpsError("not-found", "Listing not found.");
  const listing = lsnap.data() as CarListing;
  assertTenant(user, listing.tenantId);
  if (listing.sellerId === user.uid) throw new HttpsError("failed-precondition", "This is your own listing.");
  if (listing.status !== "live" && listing.status !== "reserved") throw new HttpsError("failed-precondition", "This car is no longer listed.");
  const profile = await getFirestore().collection(COLLECTIONS.customers()).doc(user.uid).get();
  const pd = (profile.data() ?? {}) as { name?: string; displayName?: string; phone?: string };
  const ref = getFirestore().collection(COLLECTIONS.carLeads()).doc();
  const now = new Date().toISOString();
  const lead: CarLead = { id: ref.id, tenantId: listing.tenantId, listingId: listing.id, kind: d.kind, buyerId: user.uid, buyerName: pd.name ?? pd.displayName ?? "Customer", buyerPhone: d.phone ?? pd.phone ?? null, note: d.note ?? null, status: "new", createdAt: now, updatedAt: now };
  await getFirestore().runTransaction(async (tx) => {
    tx.set(ref, lead);
    writeAuditLog(tx, { action: "carLead.created", entityType: "carLead", entityId: ref.id, user, studioId: listing.studioId, after: { kind: d.kind, listingId: listing.id } });
  });
  return { id: ref.id };
});

export const listCarLeads = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  validate(listCarLeadsSchema, request.data ?? {});
  await enforceRateLimit(subjectFrom(user), "gallery.read");
  const snap = await getFirestore().collection(COLLECTIONS.carLeads()).where("tenantId", "==", user.claims.tenantId).limit(300).get();
  const leads = snap.docs.map((x) => x.data() as CarLead).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { leads };
});

export const setCarLeadStatus = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const d = validate(setLeadStatusSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");
  const ref = getFirestore().collection(COLLECTIONS.carLeads()).doc(d.leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Lead not found.");
  assertTenant(user, (snap.data() as CarLead).tenantId);
  await ref.update({ status: d.status, updatedAt: new Date().toISOString() });
  return { id: ref.id };
});

// Public browsing: anyone, signed in or not, can see live and reserved cars. Public fields only, never seller details.
export const listPublicCarListings = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const ip = String(request.rawRequest?.headers?.["x-forwarded-for"] ?? request.rawRequest?.ip ?? "anon").split(",")[0]?.trim() ?? "anon";
  await enforceRateLimit({ uid: `ip:${ip}`, tenantId: "public", role: null }, "gallery.read");
  const snap = await col().where("tenantId", "==", FIRST_TENANT_ID).limit(300).get();
  const now = Date.now();
  const keep = snap.docs.map((x) => x.data() as CarListing)
    .filter((l) => (l.status === "live" || l.status === "reserved") && (!l.expiresAt || Date.parse(l.expiresAt) > now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 60);
  // Anonymous response is an explicit allowlist (see lib/public-listing.ts): no price, owner info, description or photos.
  // photoUrl is the revocable handler URL, present only while a same-tenant review of a current photo exists;
  // the handler re-checks live state and the exact object generation on every request and 404s otherwise.
  const reviews = keep.length
    ? await getFirestore().getAll(...keep.map((l) => getFirestore().collection(PUBLIC_LISTING_PHOTOS).doc(l.id)))
    : [];
  const reviewBy = new Map(reviews.filter((r) => r.exists).map((r) => [r.id, r.data() as PublicListingPhotoReview]));
  const now2 = Date.now();
  const base = `https://asia-south1-${process.env.GCLOUD_PROJECT ?? "autodeck-studio"}.cloudfunctions.net/publicListingPhoto`;
  const listings = keep.map((l) => ({ ...publicListingView(l), photoUrl: canServePublicPhoto(l, reviewBy.get(l.id), now2) ? `${base}?listingId=${l.id}` : null }));
  return { listings };
});
