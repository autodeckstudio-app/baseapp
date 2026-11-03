import { customerCatalogueEligible, customerRatingPrivacy } from "@autodeck/core";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { assertTenant } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getServiceCatalogueSchema } from "../../schemas/service.js";
import { calculatePrice, taxFor } from "../../lib/pricing.js";
import { isSizePriced } from "@autodeck/core";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const getServiceCatalogue = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  // Any authenticated user of the correct tenant can browse the catalogue
  assertTenant(user, user.claims.tenantId);

  const data = validate(getServiceCatalogueSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "read.catalogue");

  const db = getFirestore();
  const isAdmin = user.claims.role === "admin" || user.claims.role === "superadmin";
  if(data.includeInactive && !isAdmin) throw new HttpsError("permission-denied", "Staff catalogue access required");
  // Preserve existing indexed query shapes; no new tenant+order-only index is assumed.
  const queryFor=(active:boolean)=>{
    let query=db.collection(COLLECTIONS.services()).where("tenantId", "==", user.claims.tenantId).where("active", "==", active).orderBy("displayOrder", "asc");
    if(data.category !== undefined) query=query.where("category", "==", data.category);
    return query;
  };
  const pages=await Promise.all((data.includeInactive ? [true,false] : [true]).map(active=>queryFor(active).get()));
  // Missing-active historical records remain excluded, exactly as the old active/hidden readers did.
  const docs=pages.flatMap(page=>page.docs).sort((a,b)=>(a.data()["displayOrder"]??0)-(b.data()["displayOrder"]??0)||a.id.localeCompare(b.id));
  const privateMetadata = isAdmin ? new Map((await Promise.all(docs.map(doc=>db.collection("servicePrivate").doc(doc.id).get()))).filter(x=>x.exists).map(x=>[x.id,x.data()!])) : new Map();
  const services = docs.filter(doc => isAdmin || customerCatalogueEligible({id:doc.id},process.env["CATALOGUE_IDENTITY_HOLD_PREVIEW"] === "true")).map((doc) => {
    const svc = doc.data() as Service;
    if (isAdmin) {
      const metadata=privateMetadata.get(doc.id);
      const fields=metadata?.tenantId === user.claims.tenantId ? Object.fromEntries(["internalRating","internalNotes","priceBasis","priceBasisAt"].filter(key=>metadata[key]!==undefined).map(key=>[key,metadata[key]])) : {};
      return {...svc,...fields} as Service;
    }
    // Sources and pricing basis are admin-only; customers only learn whether a price is an estimate.
    const { internalNotes: _n, priceBasis, priceBasisAt: _a, ...rest } = svc;
    return customerRatingPrivacy({ ...rest, priceEstimate: svc.priceEstimate === true || /estimate/i.test(priceBasis ?? "") } as Service);
  });

  // Display totals for list tiles, computed with the same engine bookings use while the
  // documents are already loaded. Replaces one calculateServicePrice round trip per visible
  // service on car-size selection. Booking confirm still prices server-side at write time.
  let displayTotals: Record<string, number> | undefined;
  if (data.vehicleCategory !== undefined) {
    displayTotals = {};
    for (const svc of services) {
      if (svc.priceOnRequest === true) continue;
      // A size-priced service whose document lacks this size's pricing row must not present
      // its flat base as if it were the size-adjusted price: omit the display total so the
      // tile falls back to "From <base>". Booking math is untouched (separate review).
      if (isSizePriced(svc.category) && !(svc.vehicleCategoryPricing ?? []).some((r) => r.vehicleCategory === data.vehicleCategory)) continue;
      const breakdown = calculatePrice({
        basePrice: svc.basePrice,
        serviceCategory: svc.category,
        vehicleCategory: data.vehicleCategory,
        vehicleCategoryPricing: svc.vehicleCategoryPricing ?? [],
        currency: svc.currency,
        ...taxFor(null),
      });
      displayTotals[svc.id] = breakdown.total;
    }
  }

  return displayTotals === undefined ? { services } : { services, displayTotals };
});
