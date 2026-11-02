// Premium reschedule request DECISION (basket item 6, stage 2 - PREVIEW, not activated).
// An admin approves or declines a customer's pending request. Approval moves the
// booking through the shared transactional reschedule path (runRescheduleMove):
// capacity is re-validated inside the transaction, the new slot is acquired before
// the old one is released, and payment/advance fields are never in the update set,
// so the original booking's advance and payment survive unchanged and any failure
// rolls back atomically. Decline only marks the request; the booking never moves.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Service } from "@autodeck/core";
import { isBookingMissed } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { decideBookingRescheduleRequestSchema } from "../../schemas/booking.js";
import { canDecideRescheduleRequest, classifyDecisionRetry, isPremiumCategory } from "../../lib/reschedule-request.js";
import { runRescheduleMove } from "../../lib/reschedule-move.js";
import { localToUTC, computeScheduleEnd } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const decideBookingRescheduleRequest = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const data = validate(decideBookingRescheduleRequestSchema, request.data);
  const user = extractUser(request);
  await enforceRateLimit(subjectFrom(user), "booking.reschedule");

  // Adopted rule says Admin approval - studio staff do not decide (stricter reading).
  if (user.claims.role !== "admin" && user.claims.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Only an admin can decide a reschedule request.");
  }

  const db = getFirestore();
  const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data() as Booking;

  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");

  const req = booking.rescheduleRequest;
  if (!req) throw new HttpsError("failed-precondition", "This booking has no reschedule request.");

  const serviceSnap = await db.collection(COLLECTIONS.services()).doc(booking.serviceId).get();
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  const service = serviceSnap.data() as Service;
  assertTenant(user, service.tenantId);
  if (!isPremiumCategory(service.category)) {
    throw new HttpsError("failed-precondition", "Reschedule requests apply to premium services only.");
  }

  const configSnap = await db.collection(COLLECTIONS.studioConfig()).doc(booking.studioId).get();
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");
  const config = configSnap.data() as import("@autodeck/core").StudioConfig;
  assertTenant(user, config.tenantId);

  // Exactly-once decision retry, checked BEFORE the pending guard: a retried
  // decision with the same key and same approve value returns the decided
  // state instead of failing "already decided"; the same key with the opposite
  // value is a conflict, never a silent flip.
  if (req.status !== "pending") {
    const cls = classifyDecisionRetry(req, data);
    if (cls === "retry") return { booking };
    if (cls === "conflict") {
      throw new HttpsError("aborted", "This decision key was already used with the opposite decision. Use a new key.");
    }
  }
  const guard = canDecideRescheduleRequest(booking, req);
  if (!guard.ok) throw new HttpsError(guard.code as never, guard.message);
  if (isBookingMissed(booking)) {
    throw new HttpsError("failed-precondition", "The appointment has already passed; this request can no longer be approved.");
  }

  const nowIso = new Date().toISOString();

  if (!data.approve) {
    // Decline: mark the request only. The booking keeps its original slot; the
    // one-request counter still stands, so the customer cannot silently re-ask.
    const declineOutcome = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(bookingRef)).data() as Booking | undefined;
      const freshReq = fresh?.rescheduleRequest;
      if (!fresh || !freshReq) throw new HttpsError("failed-precondition", "This booking has no reschedule request.");
      // Concurrent double-decline: after a tx retry the request may already be
      // terminal. Classify against the decision key instead of failing.
      if (freshReq.status !== "pending") {
        const cls = classifyDecisionRetry(freshReq, data);
        if (cls === "retry") return "retry" as const;
        if (cls === "conflict") throw new HttpsError("aborted", "This decision key was already used with the opposite decision. Use a new key.");
      }
      const pendingReq = freshReq;
      const recheck = canDecideRescheduleRequest(fresh, pendingReq);
      if (!recheck.ok) throw new HttpsError(recheck.code as never, recheck.message);

      const rescheduleRequest = { ...pendingReq, status: "declined" as const, decidedBy: user.uid, decidedAt: nowIso, note: data.note ?? pendingReq.note ?? null, decisionIdempotencyKey: data.idempotencyKey };
      tx.update(bookingRef, { rescheduleRequest, updatedAt: nowIso });
      writeAuditLog(tx, {
        action: "booking.reschedule_decided",
        entityType: "Booking",
        entityId: data.bookingId,
        user,
        studioId: booking.studioId,
        before: { rescheduleRequest: pendingReq },
        after: { rescheduleRequest },
      });
      return "applied" as const;
    });
    if (declineOutcome === "retry") return { booking: (await bookingRef.get()).data() as Booking };
    return { booking: { ...booking, rescheduleRequest: { ...req, status: "declined" as const, decidedBy: user.uid, decidedAt: nowIso, note: data.note ?? req.note ?? null, decisionIdempotencyKey: data.idempotencyKey } } as Booking };
  }

  // Approve: move to the REQUESTED time (the admin approves the request as made,
  // not an arbitrary new time) through the shared transactional move. The extra
  // freshness check fails the approval if a concurrent decision or booking change
  // landed after the pre-transaction read - the transaction then rolls back and
  // the original slot, advance and payment are untouched.
  const newStart = localToUTC(req.requestedDate, req.requestedTime, config.timezone);
  if (newStart <= new Date()) {
    throw new HttpsError("failed-precondition", "The requested time has passed. Decline the request instead.");
  }
  const visitMinutes = booking.durationMinutes || service.estimatedDurationMinutes;
  const compatibleBays = config.bays.filter((b) => b.active && b.bayType === service.requiredBayType);
  if (compatibleBays.length === 0) {
    throw new HttpsError("failed-precondition", "No bays available for this service type.");
  }
  const newEstimatedEndAt = computeScheduleEnd(newStart, visitMinutes, config.operatingHours, config.holidays, config.timezone);

  const approvedRequest = { ...req, status: "approved" as const, decidedBy: user.uid, decidedAt: nowIso, note: data.note ?? req.note ?? null, decisionIdempotencyKey: data.idempotencyKey };
  const updatedBooking = await runRescheduleMove(db, user, booking, config, compatibleBays, {
    bookingId: data.bookingId,
    newDate: req.requestedDate,
    newTime: req.requestedTime,
    newStart,
    newEstimatedEndAt,
    visitMinutes,
    missed: false,
    auditAction: "booking.reschedule_decided",
    auditExtra: { before: { rescheduleRequest: req }, after: { rescheduleRequest: approvedRequest } },
    extraBookingUpdates: { rescheduleRequest: approvedRequest },
    extraFreshnessCheck: (fresh) => {
      const freshReq = fresh.rescheduleRequest;
      if (!freshReq) throw new HttpsError("failed-precondition", "This booking has no reschedule request.");
      // Concurrent double-approval: after a tx retry the request may already be
      // terminal. A same-key same-value retry must NOT apply a second move -
      // the shared move would still consume capacity checks, and the count
      // would double. Fail closed: the first decision already committed, so a
      // retry aborts the transaction and the original move stands exactly once.
      if (freshReq.status !== "pending") {
        throw new HttpsError("failed-precondition", `This reschedule request is already ${freshReq.status}.`);
      }
      const recheck = canDecideRescheduleRequest(fresh, freshReq);
      if (!recheck.ok) throw new HttpsError(recheck.code as never, recheck.message);
      if (freshReq!.requestedDate !== req.requestedDate || freshReq!.requestedTime !== req.requestedTime) {
        throw new HttpsError("failed-precondition", "The request changed. Reload it before deciding.");
      }
    },
  });

  return { booking: updatedBooking };
});
