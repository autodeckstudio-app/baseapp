import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Offer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createOfferSchema } from "../../schemas/offer.js";

// Admin-only: publish an uploaded image as an offer banner for a date range. Words come from the studio, never from us.
export const createOffer = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(createOfferSchema, request.data);
  assertStudio(user, data.studioId, "Offer");
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  if (!data.path.startsWith(`${user.claims.tenantId}/offers/`) || data.path.includes("..")) {
    throw new HttpsError("invalid-argument", "That upload does not belong to this studio.");
  }
  const [exists] = await getStorage().bucket().file(data.path).exists();
  if (!exists) throw new HttpsError("failed-precondition", "The image was not uploaded yet.");

  if (data.link.kind === "service") {
    const svc = await getFirestore().collection(COLLECTIONS.services()).doc(data.link.serviceId as string).get();
    if (!svc.exists || (svc.data() as { tenantId?: string }).tenantId !== user.claims.tenantId) throw new HttpsError("invalid-argument", "That service was not found.");
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.offers()).doc();
  const now = new Date().toISOString();
  const offer: Offer = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: data.studioId,
    headline: data.headline,
    body: data.body ? data.body : null,
    cta: data.cta ? data.cta : null,
    imagePath: data.path,
    contentType: data.contentType,
    link: { kind: data.link.kind, serviceId: data.link.kind === "service" ? (data.link.serviceId ?? null) : null },
    startsAt: new Date(data.startsAt).toISOString(),
    endsAt: new Date(data.endsAt).toISOString(),
    hidden: false,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };
  await db.runTransaction(async (tx) => {
    tx.set(ref, offer);
    writeAuditLog(tx, { action: "offer.created", entityType: "offer", entityId: ref.id, user, studioId: data.studioId, after: { headline: offer.headline, startsAt: offer.startsAt, endsAt: offer.endsAt, link: offer.link.kind } });
  });
  return { id: ref.id };
});
