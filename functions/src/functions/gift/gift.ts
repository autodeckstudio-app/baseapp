// Gift a wash. Buyer side: createGift, listMyGifts, cancelGift. Recipient side: redeemGift (claims the code for the
// account; the wash itself is booked through createBooking with giftCode). Studio side: lookupGift, voidGift.
// Buying: createGift makes a PENDING_PAYMENT gift and its payment (amount from the catalogue, never from the client). The
// app pays through createCheckoutOrder / verifyCheckoutPayment; the verified payment turns the gift ACTIVE (razorpay-webhook.ts)
// and starts the 60 days. getGiftCode then returns the code to the buyer. Gifts are not refundable.
// Dark until the client flag GIFT_LIVE is turned on.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  GIFT_PRICE_CATEGORY, GIFT_SERVICE_ID, giftState, type Gift, type Payment, type Service, type StudioConfig,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { calculatePrice } from "../../lib/pricing.js";
import { planGiftActivation } from "../../lib/gift-activate.js";
import { generateGiftCode, hashGiftCode } from "../../lib/gift-code.js";
import { assertNotLocked, attemptKeys, findGiftByHash, giftBlockReason, recordFailure } from "../../lib/gift-store.js";

const empty = z.object({}).strict();
const codeSchema = z.object({ code: z.string().min(1).max(40) }).strict();
const idSchema = z.object({ giftId: z.string().min(1) }).strict();
const voidSchema = z.object({ giftId: z.string().min(1), reason: z.string().min(1).max(300) }).strict();

/** The price of the gift: the server catalogue's gifted wash at the flat any-car rate. Clients never send a price. */
export async function giftPricePaise(db: FirebaseFirestore.Firestore, tenantId: string): Promise<number> {
  const svc = await db.collection(COLLECTIONS.services()).doc(GIFT_SERVICE_ID).get();
  if (!svc.exists) throw new HttpsError("failed-precondition", "Gifts are not available right now.");
  const service = svc.data() as Service;
  if (service.tenantId !== tenantId || !service.active) throw new HttpsError("failed-precondition", "Gifts are not available right now.");
  const cfg = await db.collection(COLLECTIONS.studioConfig()).where("tenantId", "==", tenantId).limit(1).get();
  const config = cfg.empty ? null : (cfg.docs[0]!.data() as StudioConfig);
  return calculatePrice({
    basePrice: service.basePrice,
    serviceCategory: service.category,
    vehicleCategory: GIFT_PRICE_CATEGORY,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    ...(config ? { taxRatePercent: config.taxRatePercent, taxDescription: config.taxDescription, currency: config.currency } : {}),
  }).total;
}

/** What a client may see of a gift. Never the hash. */
function view(g: Gift, now: number) {
  return { id: g.id, state: giftState(g, now), tail: g.codeTail, amountPaise: g.amountPaise, expiresAt: g.expiresAt, purchasedAt: g.purchasedAt, redeemedAt: g.redeemedAt, refundRequested: g.refundRequested, refundable: false };
}

/** Buyer starts a gift. Makes the gift and its payment (both unpaid) and returns the payment id for checkout. The code is made now but
 *  is only handed out by getGiftCode after the payment is verified. A buyer who retries gets the same unpaid gift back. */
export const createGift = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  validate(empty, request.data ?? {});
  await enforceRateLimit(subjectFrom(user), "gift.create");
  const db = getFirestore();
  const amountPaise = await giftPricePaise(db, user.claims.tenantId);
  const recent = await db.collection(COLLECTIONS.gifts()).where("buyerId", "==", user.uid).orderBy("createdAt", "desc").limit(5).get();
  for (const d of recent.docs) {
    const g = d.data() as Gift;
    if (g.status !== "PENDING_PAYMENT" || g.amountPaise !== amountPaise || Date.now() - Date.parse(g.createdAt) > 24 * 3_600_000) continue;
    const p = await db.collection(COLLECTIONS.payments()).where("giftId", "==", g.id).limit(1).get();
    const pay = p.empty ? null : (p.docs[0]!.data() as Payment);
    if (pay && (pay.status === "pending" || pay.status === "processing")) return { giftId: g.id, paymentId: pay.id, amountPaise };
  }
  const code = generateGiftCode();
  const codeHash = hashGiftCode(code)!;
  const ref = db.collection(COLLECTIONS.gifts()).doc();
  const payRef = db.collection(COLLECTIONS.payments()).doc();
  const nowIso = new Date().toISOString();
  const gift: Gift = {
    id: ref.id, tenantId: user.claims.tenantId, buyerId: user.uid, serviceId: GIFT_SERVICE_ID, amountPaise, codeHash, codeTail: code.slice(-4),
    status: "PENDING_PAYMENT", createdAt: nowIso, purchasedAt: null, expiresAt: null, claimedBy: null, redeemedBy: null, redeemedAt: null,
    bookingId: null, voidedAt: null, voidReason: null, refundRequested: false, paymentId: null,
  };
  const payment: Payment = {
    id: payRef.id, tenantId: user.claims.tenantId, studioId: null, targetType: "gift", jobId: null, bookingId: null, membershipId: null, giftId: ref.id,
    customerId: user.uid, amount: amountPaise, currency: "INR", method: "razorpay_payment_link", status: "pending",
    razorpayPaymentLinkId: null, razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null, completedAt: null, failedAt: null, cancelledAt: null,
    refundedAt: null, createdAt: nowIso, updatedAt: nowIso,
  };
  await db.runTransaction(async (tx) => {
    tx.create(ref, gift);
    tx.create(payRef, payment);
    tx.create(db.collection(COLLECTIONS.giftSecrets()).doc(ref.id), { giftId: ref.id, buyerId: user.uid, tenantId: user.claims.tenantId, code, createdAt: nowIso });
    writeAuditLog(tx, { action: "gift.created", entityType: "Gift", entityId: ref.id, user, studioId: null, after: { amountPaise, tail: gift.codeTail } });
  });
  return { giftId: ref.id, paymentId: payRef.id, amountPaise };
});

/** The buyer's code, only once the payment is verified (gift ACTIVE) and only to the buyer. This is how a buyer who closed the app
 *  after paying gets it again. An unpaid, void, used or expired gift never returns a code. */
export const getGiftCode = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  const data = validate(idSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gift.read");
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.gifts()).doc(data.giftId).get();
  const g = snap.exists ? (snap.data() as Gift) : null;
  if (!g || g.buyerId !== user.uid || g.tenantId !== user.claims.tenantId) throw new HttpsError("not-found", "Gift not found.");
  if (giftState(g, Date.now()) !== "unused") throw new HttpsError("failed-precondition", "This gift has no code to show.");
  const sec = await db.collection(COLLECTIONS.giftSecrets()).doc(g.id).get();
  const code = sec.exists ? ((sec.data() as { code?: string }).code ?? null) : null;
  if (!code || hashGiftCode(code) !== g.codeHash) throw new HttpsError("not-found", "Gift not found.");
  return { code, expiresAt: g.expiresAt };
});

export const listMyGifts = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  await enforceRateLimit(subjectFrom(user), "gift.read");
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.gifts()).where("buyerId", "==", user.uid).orderBy("createdAt", "desc").limit(50).get();
  const now = Date.now();
  const offer = await giftPricePaise(db, user.claims.tenantId).then((amountPaise) => ({ amountPaise })).catch(() => null);
  return { gifts: snap.docs.map((d) => d.data() as Gift).filter((g) => g.status !== "PENDING_PAYMENT").map((g) => view(g, now)), offer };
});

/** Recipient claims a code. It binds to this account; a second account cannot claim it. Wrong codes are counted and locked out. */
export const redeemGift = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  if (!user.phone) throw new HttpsError("failed-precondition", "Sign in with your phone number to redeem a gift.");
  const data = validate(codeSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gift.redeem");
  const db = getFirestore();
  const keys = attemptKeys(user.uid, request);
  const now = Date.now();
  await assertNotLocked(db, keys, now);
  const hash = hashGiftCode(data.code);
  const bad = new HttpsError("not-found", "That code did not work. Check it and try again.");
  if (!hash) { await recordFailure(db, keys, now); throw bad; }
  const result = await db.runTransaction(async (tx) => {
    const doc = await findGiftByHash(tx, db, hash);
    if (!doc) return { error: "missing" as const };
    const g = doc.data() as Gift;
    if (g.tenantId !== user.claims.tenantId) return { error: "missing" as const };
    const reason = giftBlockReason(g, user.uid, now);
    if (reason) return { error: reason };
    if (!g.claimedBy) {
      tx.update(doc.ref, { claimedBy: user.uid });
      writeAuditLog(tx, { action: "gift.claimed", entityType: "Gift", entityId: g.id, user, studioId: null, after: { tail: g.codeTail } });
    }
    return { ok: view({ ...g, claimedBy: user.uid }, now) };
  });
  if ("error" in result) {
    if (result.error === "missing") { await recordFailure(db, keys, now); throw bad; }
    throw new HttpsError("failed-precondition", result.error);
  }
  return result.ok;
});

/** Gifts are not refundable (Meet's decision). Kept so an older app gets a clear answer; it changes nothing. */
export const cancelGift = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  validate(idSchema, request.data);
  throw new HttpsError("failed-precondition", "Gifts cannot be refunded after payment. Please call the studio if something went wrong.");
});

/** Studio: look a gift up by the code a customer reads out, or by id. */
export const lookupGift = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(z.object({ code: z.string().max(40).optional(), giftId: z.string().max(100).optional() }).strict(), request.data);
  await enforceRateLimit(subjectFrom(user), "gift.admin");
  const db = getFirestore();
  let g: Gift | null = null;
  if (data.giftId) { const s = await db.collection(COLLECTIONS.gifts()).doc(data.giftId).get(); g = s.exists ? (s.data() as Gift) : null; }
  else if (data.code) { const h = hashGiftCode(data.code); if (h) { const q = await db.collection(COLLECTIONS.gifts()).where("codeHash", "==", h).limit(1).get(); g = q.empty ? null : (q.docs[0]!.data() as Gift); } }
  if (!g) throw new HttpsError("not-found", "No gift found.");
  assertTenant(user, g.tenantId);
  return { ...view(g, Date.now()), buyerId: g.buyerId, claimedBy: g.claimedBy, bookingId: g.bookingId, status: g.status, voidReason: g.voidReason };
});

/** Studio voids a gift that has not been used. A voided gift never works again. */
export const voidGift = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(voidSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gift.admin");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.gifts()).doc(data.giftId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Gift not found.");
    const g = snap.data() as Gift;
    assertTenant(user, g.tenantId);
    if (g.status === "REDEEMED") throw new HttpsError("failed-precondition", "This gift was already used.");
    if (g.status === "VOID" || g.status === "REFUNDED") throw new HttpsError("failed-precondition", "This gift is already void.");
    tx.update(ref, { status: "VOID", voidedAt: new Date().toISOString(), voidReason: data.reason });
    writeAuditLog(tx, { action: "gift.voided", entityType: "Gift", entityId: g.id, user, studioId: null, after: { reason: data.reason, tail: g.codeTail } });
  });
  return { ok: true };
});

/** Same rule the verified-payment path applies, as a standalone call. Safe to call twice. Throws when the gift cannot be activated. */
export async function activateGift(db: FirebaseFirestore.Firestore, giftId: string, paymentId: string, paidPaise: number): Promise<void> {
  const ref = db.collection(COLLECTIONS.gifts()).doc(giftId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Gift not found.");
    const g = snap.data() as Gift;
    if (g.status !== "PENDING_PAYMENT") return;
    const plan = planGiftActivation(g, { id: paymentId, amount: paidPaise, customerId: g.buyerId, tenantId: g.tenantId }, new Date().toISOString());
    if (!plan.activate) throw new HttpsError("failed-precondition", "Paid amount does not match the gift price.");
    tx.update(ref, plan.patch);
  });
}
