// GUEST SHOP ORDER — NOT EXPORTED, NOT DEPLOYED. This callable exists for
// local review only: functions/src/index.ts deliberately does not export it,
// so it cannot be deployed. The store is not open; the only catalogue this
// accepts is the labelled dev fixture. Ordering real concepts is impossible
// because no concept has an owner-supplied price.
//
// Abuse control: the shared Firestore-backed limiter runs BEFORE any
// catalogue read, keyed by a hash of the guest client key — raw keys are
// never stored, and separate instances share one count.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { priceGuestOrder, type OrderLineInput, type GuestInput } from "@autodeck/core";
import { SHOP_FIXTURE } from "@autodeck/core/shop-fixture";
import { hitLimiter } from "../../lib/shop-rate-limit.js";

const GUEST_ORDER_RULE = { limit: 10, windowMs: 60_000 } as const;

const schema = z.object({
  lines: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    quantity: z.number().int().min(1),
  }).strict()).min(1),
  guest: z.object({
    name: z.string(), mobile: z.string(), email: z.string().optional(),
    address: z.string(), city: z.string(), state: z.string(), pincode: z.string(),
    clientKey: z.string().min(8),
  }).strict(),
}).strict();

export const placeGuestOrder = onCall({ region: "asia-south1" }, async (request) => {
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid order payload.");
  const data = parsed.data;
  const db = getFirestore();

  // Limiter first: abuse never reaches the catalogue.
  const hit = await hitLimiter(db, { scope: "placeGuestOrder", rawId: data.guest.clientKey, rule: GUEST_ORDER_RULE });
  if (!hit.allowed) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Try again shortly.");
  }

  const result = priceGuestOrder(SHOP_FIXTURE, data.lines as OrderLineInput[], data.guest as GuestInput);
  if (!result.ok) {
    throw new HttpsError("failed-precondition", `Cannot place order: ${result.code}${result.detail ? ` (${result.detail})` : ""}`);
  }
  // Dev fixture only: nothing is written, no payment, no notification.
  return { ok: true as const, totalPaise: result.totalPaise, idempotencyKey: result.idempotencyKey, fixture: true as const };
});
