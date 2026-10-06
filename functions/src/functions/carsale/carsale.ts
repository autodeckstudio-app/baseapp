// Cars for sale: studio stock plus customer submissions behind admin approval.
// Everything goes through callables so private seller data never reaches a buyer.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { FIRST_STUDIO_ID, type CarLead, type CarListing, type CarListingView } from "@autodeck/core";
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
  noContactInText,
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

async function view(l: CarListing, uid: string): Promise<CarListingView> {
  const bucket = getStorage().bucket();
  const photoUrls = await Promise.all(l.photoPaths.map(async (p) => (await bucket.file(p).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 3600 * 1000 }))[0]));
  return { id: l.id, source: l.source, status: l.status, make: l.make, model: l.model, variant: l.variant, year: l.year, kmDriven: l.kmDriven, fuel: l.fuel, gearbox: l.gearbox, bodyType: l.bodyType ?? null, owners: l.owners, colour: l.colour, area: l.area, askingPrice: l.askingPrice, description: l.description, insuranceValidTill: l.insuranceValidTill, photoUrls, mine: l.sellerId === uid, rejectionReason: l.sellerId === uid ? l.rejectionReason : null, createdAt: l.createdAt };
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
  return { listings: await Promise.all(keep.map((l) => view(l, user.uid))) };
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
