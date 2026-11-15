import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  STUDIO_COORDS,
  PICKUP_FREE_ROAD_METERS,
  CURRENT_PICKUP_TARIFF,
  pickupTariffLegFeePaise,
  pickupRoadKmForDisplay,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { roadMetersBetween, GOOGLE_ROUTES_API_KEY } from "../../lib/road-distance.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { resolveCustomerDocId } from "../../lib/customer-identity.js";

const quoteSchema = z
  .object({
    kind: z.enum(["pickup", "drop", "both"]),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

/** Quotes live 30 minutes: the booking flow quotes, shows, then sends the id with the request. */
export const PICKUP_QUOTE_TTL_MS = 30 * 60 * 1000;

/**
 * Customer asks what pickup/drop costs from their spot. The server checks the ROAD distance per selected leg,
 * each in the direction actually driven (pickup: the customer's spot to the studio; drop: the studio to the
 * customer's spot - one-way roads can make these differ, so "both" is two independent routes, never one route
 * doubled), stores the quote, and requestPickupDrop charges exactly the stored fee - the amount the customer
 * saw is the amount charged, never silently recomputed against a fresh route. Throws unavailable when the
 * distance cannot be known: the client then offers booking without pickup, never an estimate.
 */
export const getPickupQuote = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck(), secrets: [GOOGLE_ROUTES_API_KEY] }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  assertTenant(user, user.claims.tenantId);
  const data = validate(quoteSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "pickup.quote");

  const pin = { lat: data.lat, lng: data.lng };
  const legs: { leg: "pickup" | "drop"; roadMeters: number }[] = [];
  if (data.kind === "pickup" || data.kind === "both") {
    legs.push({ leg: "pickup", roadMeters: await roadMetersBetween(pin, STUDIO_COORDS) });
  }
  if (data.kind === "drop" || data.kind === "both") {
    legs.push({ leg: "drop", roadMeters: await roadMetersBetween(STUDIO_COORDS, pin) });
  }
  const pricedLegs=legs.map(l=>({...l,feePaise:pickupTariffLegFeePaise(l.roadMeters,CURRENT_PICKUP_TARIFF)}));
  const feePaise = pricedLegs.reduce((sum,l)=>sum+l.feePaise,0);
  const roadMeters = legs.reduce((sum, l) => sum + l.roadMeters, 0);
  const now = Date.now();
  const db = getFirestore();
  // Declared boundary and base capability unchanged: any principal the base relabeled
  // could call, keyed on its uid. The only behavior change is identity: a caller whose
  // auth uid resolves to a customer profile (claimed walk-in, doc id != uid) is stamped
  // with the canonical doc id; everyone else keeps the exact base uid keying. No
  // profile is required or created.
  const customerDocId = (await resolveCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid)) ?? user.uid;
  const ref = db.collection(COLLECTIONS.pickupQuotes()).doc();
  await ref.set({
    id: ref.id,
    tenantId: user.claims.tenantId,
    customerId: customerDocId,
    kind: data.kind,
    lat: data.lat,
    lng: data.lng,
    legs:pricedLegs,
    tariffVersion:CURRENT_PICKUP_TARIFF,
    roadMeters,
    feePaise,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PICKUP_QUOTE_TTL_MS).toISOString(),
    consumedAt: null,
  });
  return {
    quoteId: ref.id,
    kind: data.kind,
    tariffVersion:CURRENT_PICKUP_TARIFF,
    legs: pricedLegs.map((l) => ({ leg: l.leg, km: pickupRoadKmForDisplay(l.roadMeters), feePaise: l.feePaise })),
    feePaise,
    freeMeters: PICKUP_FREE_ROAD_METERS,
    expiresAt: new Date(now + PICKUP_QUOTE_TTL_MS).toISOString(),
  };
});
