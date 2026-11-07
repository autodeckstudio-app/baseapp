import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  STUDIO_COORDS,
  PICKUP_FREE_ROAD_METERS,
  pickupLegFeePaiseForRoadMeters,
  pickupLegsFeePaise,
  pickupRoadKmForDisplay,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { roadMetersBetween, GOOGLE_ROUTES_API_KEY } from "../../lib/road-distance.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { requireCustomerDocId, resolveCustomerDocId } from "../../lib/customer-identity.js";

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
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
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
  const feePaise = pickupLegsFeePaise(legs.map((l) => l.roadMeters));
  const roadMeters = legs.reduce((sum, l) => sum + l.roadMeters, 0);
  const now = Date.now();
  const db = getFirestore();
  // Self-service is role-agnostic like createBooking: customers must own a
  // profile; staff without one keep legacy uid-keyed ownership.
  const resolvedDocId = user.claims.role === "customer"
    ? await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid)
    : await resolveCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid);
  const customerDocId = resolvedDocId ?? user.uid;
  const ref = db.collection(COLLECTIONS.pickupQuotes()).doc();
  await ref.set({
    id: ref.id,
    tenantId: user.claims.tenantId,
    customerId: customerDocId,
    kind: data.kind,
    lat: data.lat,
    lng: data.lng,
    legs,
    roadMeters,
    feePaise,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PICKUP_QUOTE_TTL_MS).toISOString(),
    consumedAt: null,
  });
  return {
    quoteId: ref.id,
    kind: data.kind,
    legs: legs.map((l) => ({ leg: l.leg, km: pickupRoadKmForDisplay(l.roadMeters), feePaise: pickupLegFeePaiseForRoadMeters(l.roadMeters) })),
    feePaise,
    freeMeters: PICKUP_FREE_ROAD_METERS,
    expiresAt: new Date(now + PICKUP_QUOTE_TTL_MS).toISOString(),
  };
});
