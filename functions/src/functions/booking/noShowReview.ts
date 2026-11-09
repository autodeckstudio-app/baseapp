import {decideCombinedReturn} from '../../lib/combined-return.js';
import{isDeepStrictEqual}from "node:util";
import{combinedNoShowAmounts,checkedCombinedPayment}from "@autodeck/core";
// Legacy no-show resolutions retain their historical candidates. Version2 uses the approved service-only 20% rule. Refunds remain explicit Admin decisions through the outbox.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { isBiggerVisit, CANCEL_SHORT, CANCEL_BIGGER, type Booking, type Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { reserveRefund,planReserveInTx,applyReserveInTx, refundablePaise } from "../../lib/refund-outbox.js";

const NO_SHOW_FLAT_PAISE = 10000; // Rs 100
const NO_SHOW_PCT = 0.2; // 20%

const contactSchema = z.object({
  bookingId: z.string().min(1),
  channel: z.enum(["phone", "whatsapp", "in_person"]),
  note: z.string().trim().min(3).max(500),
}).strict();

const previewSchema = z.object({ bookingId: z.string().min(1) }).strict();

const resolveSchema = z.object({
  bookingId: z.string().min(1),
  resolution: z.enum(["charge", "waive", "reopen"]),
  // Exact charge in paise for resolution=charge. Explicit on purpose: the
  // flat-vs-percentage choice within the delegated policy is unresolved, so
  // the server never selects it silently.
  chargePaise: z.number().int().min(0).nullish(),
  reason: z.string().trim().min(3).max(500),
}).strict();

// Mapped default (settled mapping, same bands as the customer cancel fee): small jobs Rs 100, bigger jobs 20% of the
// booking total, never more than what was captured. When the service class cannot be determined there is NO default
// (null): the admin must pass an explicit charge. Deviations are allowed only as a labelled, reasoned exception.
async function mappedNoShowDefault(db: FirebaseFirestore.Firestore, booking: Booking & { id: string }, captured: number) {
  if(booking.combinedPayment){try{checkedCombinedPayment(booking.combinedPayment,booking.totalAmount);const amounts=combinedNoShowAmounts(booking.priceBreakdown,captured);return{serviceClass:"service_only",key:"service_20",chargePaise:amounts.retainedPaise,refundPaise:amounts.refundReviewPaise};}catch{throw new HttpsError("failed-precondition","No-show price snapshot needs office review.");}}
  let categories = (booking as { cancelCategories?: string[] }).cancelCategories ?? [];
  if (!categories.length && booking.serviceId) {
    const svc = await db.collection(COLLECTIONS.services()).doc(booking.serviceId).get();
    const c = svc.exists ? (svc.data() as { category?: string }).category : undefined;
    if (c) categories = [String(c)];
  }
  if (!categories.length) return null;
  const bigger = isBiggerVisit(categories);
  const raw = bigger ? Math.round((Math.max(0, booking.totalAmount) * CANCEL_BIGGER.feePercent) / 100) : CANCEL_SHORT.feePaise;
  const chargePaise = Math.min(raw, captured);
  return { serviceClass: bigger ? "bigger" : "small", key: bigger ? "pct_20" : "flat_rs100", chargePaise, refundPaise: captured - chargePaise };
}

interface NoShowContext {
  booking: Booking & { id: string };
  payment: Payment | null;
}

async function loadNoShow(db: FirebaseFirestore.Firestore, bookingId: string): Promise<NoShowContext> {
  const snap = await db.collection(COLLECTIONS.bookings()).doc(bookingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = { ...(snap.data() as Booking), id: snap.id };
  if (booking.status !== "CANCELLED" || !booking.missedAt) {
    throw new HttpsError("failed-precondition", "Only a booking auto-cancelled as a no-show can be reviewed here.");
  }
  let payment: Payment | null = null;
  if(booking.combinedPayment){const payments=await db.collection(COLLECTIONS.payments()).where("bookingId","==",bookingId).limit(21).get();const captured=payments.docs.map(d=>d.data()as Payment).filter(p=>p.status==="completed"||p.status==="partially_refunded");if(payments.size>20||captured.length>1)throw new HttpsError("failed-precondition","Multiple captured payments need a combined refund review.");payment=captured[0]??null;if(payment&&(payment.tenantId!==booking.tenantId||payment.customerId!==booking.customerId||payment.studioId!==booking.studioId))throw new HttpsError("failed-precondition","Payment scope needs review.");return{booking,payment};}
  const pq = await db.collection(COLLECTIONS.payments()).where("bookingId", "==", bookingId).limit(1).get();
  if (!pq.empty) payment = pq.docs[0]!.data() as Payment;
  return { booking, payment };
}

function assertAdmin(user: ReturnType<typeof extractUser>) {
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required for no-show review.");
  }
}

// Read-back of the stored no-show outcome for the resolved panel. The refund
// amount and state come from the authoritative refund request, never
// recomputed from booking fields; a missing request yields nulls and the
// client labels status conservatively.
export const getNoShowResolution = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(previewSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const { booking } = await loadNoShowAny(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const combined=(booking as any).combinedReturn;
  if(combined)return{bookingId:data.bookingId,resolution:(booking as any).noShowResolution??null,chargePaise:combined.feePaise,refundRequestId:null,refundAmountPaise:combined.refundPaise,refundStatus:combined.status};
  const resolution = (booking as { noShowResolution?: string }).noShowResolution ?? null;
  const chargePaise = (booking as { noShowChargePaise?: number }).noShowChargePaise ?? 0;
  const refundRequestId = (booking as { noShowRefundRequestId?: string }).noShowRefundRequestId ?? null;
  let refundAmountPaise: number | null = null;
  let refundStatus: string | null = null;
  if (refundRequestId) {
    const rr = await db.collection(COLLECTIONS.refundRequests()).doc(refundRequestId).get();
    if (rr.exists) {
      const d = rr.data() as { amountPaise?: number; status?: string };
      refundAmountPaise = d.amountPaise ?? null;
      refundStatus = d.status ?? null;
    }
  }
  return { bookingId: data.bookingId, resolution, chargePaise, refundRequestId, refundAmountPaise, refundStatus };
});

async function loadNoShowAny(db: FirebaseFirestore.Firestore, bookingId: string): Promise<NoShowContext> {
  const snap = await db.collection(COLLECTIONS.bookings()).doc(bookingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = { ...(snap.data() as Booking), id: snap.id };
  let payment: Payment | null = null;
  const pq = await db.collection(COLLECTIONS.payments()).where("bookingId", "==", bookingId).limit(1).get();
  if (!pq.empty) payment = pq.docs[0]!.data() as Payment;
  return { booking, payment };
}

export const recordNoShowContact = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(contactSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const { booking } = await loadNoShowAny(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const now = new Date().toISOString();
  const entry = { at: now, by: user.uid, channel: data.channel, note: data.note };
  await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).update({
    noShowContactLog: [...((booking as { noShowContactLog?: unknown[] }).noShowContactLog ?? []), entry],
    updatedAt: now,
  });
  return { recorded: true, at: now };
});

export const previewNoShowResolution = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(previewSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const candidate=(await db.collection('bookings').doc(data.bookingId).get()).data()as Booking|undefined;
  if(candidate?.combinedPayment){assertTenant(user,candidate.tenantId);assertStudio(user,candidate.studioId,'Booking');const p=await decideCombinedReturn(db,user,{bookingId:data.bookingId,reason:'Preview no-show allocation',feeAction:'charge',preview:true},'admin','no_show');return{bookingId:data.bookingId,capturedPaise:p.paidPaise,candidates:[{key:'service_20',chargePaise:p.feePaise,refundPaise:p.refundPaise},{key:'waive',chargePaise:0,refundPaise:p.paidPaise}],mappedDefault:{key:'service_20',chargePaise:p.feePaise,refundPaise:p.refundPaise},policyNote:'20% of service only. Unused transport is excluded. Original-method returns require Admin approval.'};}
  const { booking, payment } = await loadNoShow(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const captured = payment && payment.status === "completed" ? payment.amount : 0;
  if(booking.combinedPayment){const mapped=await mappedNoShowDefault(db,booking,captured);return{bookingId:data.bookingId,capturedPaise:captured,candidates:[{key:"service_20",chargePaise:mapped!.chargePaise,refundPaise:mapped!.refundPaise},{key:"waive",chargePaise:0,refundPaise:captured}],mappedDefault:mapped,policyNote:"Keep 20% of discounted service including GST. Unused transport is excluded. Refund remainder awaits approval and processing."};}
  return {
    bookingId: data.bookingId,
    capturedPaise: captured,
    // Delegated policy direction, both readings surfaced; the choice between
    // them is an owner-pending value, so nothing here is preselected.
    candidates: [
      { key: "flat_rs100", chargePaise: Math.min(NO_SHOW_FLAT_PAISE, captured), refundPaise: Math.max(0, captured - NO_SHOW_FLAT_PAISE) },
      { key: "pct_20", chargePaise: Math.round(captured * NO_SHOW_PCT), refundPaise: captured - Math.round(captured * NO_SHOW_PCT) },
      { key: "waive", chargePaise: 0, refundPaise: captured },
    ],
    // Settled mapping: small = Rs 100, bigger = 20% of the booking total. null when the class is unknown (no silent charge).
    mappedDefault: await mappedNoShowDefault(db, booking, captured),
    policyNote: "Pick the no-show charge for this booking: Rs 100 or 20% of the captured payment, or waive it. The rest goes back to the customer.",
  };
});

export const resolveNoShow = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(resolveSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const candidate=(await db.collection('bookings').doc(data.bookingId).get()).data()as Booking|undefined;
  if(candidate?.combinedPayment){assertTenant(user,candidate.tenantId);assertStudio(user,candidate.studioId,'Booking');if(data.resolution==='reopen')throw new HttpsError('failed-precondition','Reopen requires a new capacity-checked booking.');return decideCombinedReturn(db,user,{bookingId:data.bookingId,reason:data.reason,feeAction:data.resolution==='waive'?'waive':'charge'},'admin','no_show',data.chargePaise);}
  const { booking, payment } = await loadNoShow(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const now = new Date().toISOString();

  if (data.resolution === "reopen") {
    // Held: the missed booking is CANCELLED and the reschedule machinery only
    // moves CONFIRMED bookings. A truthful, capacity-checked reopen needs its
    // own reviewed path rather than a shortcut around cancel state.
    throw new HttpsError("failed-precondition", "Reopen is held: rebook the customer through the normal booking flow so capacity is checked there.");
  }

  if ((booking as { noShowResolution?: string }).noShowResolution) {
    throw new HttpsError("already-exists", "This no-show is already resolved.");
  }

  const capturedNow = payment && payment.status === "completed" ? payment.amount : 0;
  const mapped = await mappedNoShowDefault(db, booking, capturedNow);
  // charge with no amount takes the mapped default; with no mapped default it is refused (no silent arbitrary charge).
  const charge = data.resolution === "waive" ? 0 : (data.chargePaise ?? mapped?.chargePaise ?? null);
  if(booking.combinedPayment&&data.resolution==="charge"&&charge!==mapped?.chargePaise)throw new HttpsError("invalid-argument","Combined no-show retention is 20% of service only. No unused transport charge.");
  const deviation = data.resolution === "charge" && mapped !== null && charge !== mapped.chargePaise;
  if (charge === null) throw new HttpsError("invalid-argument", "chargePaise is required for a charge resolution.");

  if(booking.combinedPayment){return db.runTransaction(async tx=>{const ref=db.collection(COLLECTIONS.bookings()).doc(data.bookingId),freshSnap=await tx.get(ref),fresh=freshSnap.data()as Booking&{noShowResolution?:string}|undefined;if(!fresh||fresh.status!=="CANCELLED"||!fresh.missedAt||fresh.noShowResolution||fresh.tenantId!==booking.tenantId||fresh.studioId!==booking.studioId||fresh.customerId!==booking.customerId||!isDeepStrictEqual(fresh.priceBreakdown,booking.priceBreakdown)||fresh.totalAmount!==booking.totalAmount||!isDeepStrictEqual(fresh.combinedPayment,booking.combinedPayment))throw new HttpsError("failed-precondition","No-show review changed. Refresh the exact decision.");let plan:null|Awaited<ReturnType<typeof planReserveInTx>>=null;const refund=capturedNow-charge;if(refund>0){if(!payment||payment.method!=="razorpay_payment_link")throw new HttpsError("failed-precondition","Verified provider capture is required for this refund review.");plan=await planReserveInTx(tx,db,{payment,amountPaise:refund,reason:`No-show resolution (${data.resolution}): ${data.reason}`,createdBy:user.uid,expectedBookingId:fresh.id});if(!plan.ok)throw new HttpsError("failed-precondition",plan.reason);}const refundRequestId=plan?.ok?applyReserveInTx(tx,plan).requestId:null;tx.update(ref,{noShowResolution:data.resolution,noShowChargePaise:charge,noShowResolvedAt:now,noShowResolvedBy:user.uid,noShowReason:data.reason,noShowMappedDefaultPaise:mapped!.chargePaise,...(refundRequestId?{noShowRefundRequestId:refundRequestId,refundStatus:"reserved"}:{}),cancellationFeeStatus:data.resolution==="waive"?"waived":"withheld",updatedAt:now});writeAuditLog(tx,{action:"booking.noshow_resolved",entityType:"Booking",entityId:data.bookingId,user,studioId:fresh.studioId,after:{resolution:data.resolution,chargePaise:charge,refundRequestId,reason:data.reason,serviceOnly:true}});return{resolved:true,resolution:data.resolution,chargePaise:charge,refundRequestId};});}

  let refundRequestId: string | null = null;
  if (payment && payment.status === "completed") {
    const captured = payment.amount;
    if (charge > captured) throw new HttpsError("invalid-argument", "Charge exceeds the captured amount.");
    const refund = captured - charge;
    if (refund > 0) {
      if (payment.method !== "razorpay_payment_link") {
        throw new HttpsError("failed-precondition", "Manual-payment refunds settle outside the provider; record them through the held manual flow.");
      }
      if (refund > refundablePaise(payment)) throw new HttpsError("failed-precondition", "Refund exceeds the refundable balance.");
      try {
        refundRequestId = (await reserveRefund(db, {
          payment, amountPaise: refund, reason: `No-show resolution (${data.resolution}): ${data.reason}`, createdBy: user.uid,
        })).requestId;
      } catch (err) {
        throw new HttpsError("failed-precondition", err instanceof Error ? err.message : "Could not reserve refund.");
      }
    }
  }

  await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).update({
    noShowResolution: data.resolution,
    noShowChargePaise: charge,
    noShowResolvedAt: now,
    noShowResolvedBy: user.uid,
    noShowReason: data.reason,
    ...(mapped ? { noShowMappedDefaultPaise: mapped.chargePaise } : {}),
    ...(deviation ? { noShowChargeException: true } : {}),
    ...(refundRequestId ? { noShowRefundRequestId: refundRequestId, refundStatus: "reserved" } : {}),
    cancellationFeeStatus: data.resolution === "waive" ? "waived" : "withheld",
    updatedAt: now,
  });

  const dbTx = await db.runTransaction(async (tx) => {
    writeAuditLog(tx, {
      action: "booking.noshow_resolved",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      after: { resolution: data.resolution, chargePaise: charge, refundRequestId, reason: data.reason, mappedDefaultPaise: mapped?.chargePaise ?? null, exception: deviation || data.resolution === "waive" },
    });
    return true;
  });
  void dbTx;

  return { resolved: true, resolution: data.resolution, chargePaise: charge, refundRequestId };
});
