import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { isOfferLive, type Offer, type OfferView } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listOffersSchema } from "../../schemas/offer.js";

const READ_WINDOW_MS = 60 * 60 * 1000;

// Customers get offers that are live right now (started, not ended, not hidden). Staff can ask for everything.
export const listOffers = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(listOffersSchema, request.data ?? {});
  await enforceRateLimit(subjectFrom(user), "gallery.read");

  const all = user.claims.role !== "customer" && data.includeAll === true;
  const now = Date.now();
  const snap = await getFirestore().collection(COLLECTIONS.offers()).where("tenantId", "==", user.claims.tenantId).limit(200).get();
  const keep = snap.docs
    .map((d) => d.data() as Offer)
    .filter((o) => all || isOfferLive(o, now))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, all ? 100 : 3);

  const bucket = getStorage().bucket();
  const offers: OfferView[] = await Promise.all(
    keep.map(async (o) => {
      const [url] = await bucket.file(o.imagePath).getSignedUrl({ version: "v4", action: "read", expires: now + READ_WINDOW_MS });
      return { id: o.id, headline: o.headline, body: o.body, cta: o.cta, url, link: o.link, startsAt: o.startsAt, endsAt: o.endsAt, hidden: o.hidden };
    }),
  );
  return { offers };
});
