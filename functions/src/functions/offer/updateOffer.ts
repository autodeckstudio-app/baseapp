import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Offer } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateOfferSchema, MAX_OFFER_DAYS } from "../../schemas/offer.js";

// Admin-only: edit the words, end it early or extend it, hide or show. Nothing is deleted.
export const updateOffer = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateOfferSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.offers()).doc(data.offerId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Offer not found.");
    const cur = snap.data() as Offer;
    assertTenant(user, cur.tenantId);
    assertStudio(user, cur.studioId, "Offer");
    const patch: Partial<Offer> = { updatedAt: new Date().toISOString() };
    if (data.headline !== undefined) patch.headline = data.headline;
    if (data.body !== undefined) patch.body = data.body ? data.body : null;
    if (data.cta !== undefined) patch.cta = data.cta ? data.cta : null;
    if (data.hidden !== undefined) patch.hidden = data.hidden;
    if (data.endsAt !== undefined) {
      const end = new Date(data.endsAt).toISOString();
      if (Date.parse(end) <= Date.parse(cur.startsAt)) throw new HttpsError("invalid-argument", "The end must be after the start.");
      if (Date.parse(end) - Date.parse(cur.startsAt) > MAX_OFFER_DAYS * 86_400_000) throw new HttpsError("invalid-argument", `An offer can run up to ${MAX_OFFER_DAYS} days.`);
      patch.endsAt = end;
    }
    tx.update(ref, patch);
    writeAuditLog(tx, { action: "offer.updated", entityType: "offer", entityId: ref.id, user, studioId: cur.studioId, after: { hidden: patch.hidden ?? cur.hidden, endsAt: patch.endsAt ?? cur.endsAt } });
  });
  return { id: ref.id };
});
