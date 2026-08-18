import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type {
  Service,
  StudioConfig,
  ServiceJob,
  Booking,
  Vehicle,
  Membership,
  MembershipUsage,
} from "@autodeck/core";
import {
  MAX_ADVANCE_BOOKING_DAYS,
  MAX_SERVICE_SPAN_DAYS,
} from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createBookingSchema } from "../../schemas/booking.js";
import { calculatePrice, applyMembershipBenefit } from "../../lib/pricing.js";
import {
  buildOccupiedInterval,
  hasConflict,
  type OccupiedInterval,
} from "../../lib/availability.js";
import { localToUTC, utcToLocalDate, utcToLocalTime, addDays, computeScheduleEnd } from "../../lib/schedule.js";

export const createBooking = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(createBookingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.create");

  const db = getFirestore();
  const now = new Date();

  // Validate booking is not too far in advance
  const requestedStart = localToUTC(data.scheduledDate, data.scheduledTime, "Asia/Kolkata");
  const maxDate = new Date(now.getTime() + MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000);
  if (requestedStart <= now) {
    throw new HttpsError("invalid-argument", "Booking time must be in the future.");
  }
  if (requestedStart > maxDate) {
    throw new HttpsError(
      "invalid-argument",
      `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance.`,
    );
  }

  // Pre-fetch all inputs outside the transaction (read-heavy; re-validated inside)
  const [serviceSnap, configSnap, vehicleSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(data.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get(),
    db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get(),
  ]);

  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");

  const service = serviceSnap.data() as Service;
  const config = configSnap.data() as StudioConfig;
  const vehicle = vehicleSnap.data() as Vehicle;

  if (service.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (config.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (vehicle.ownerId !== user.uid) {
    throw new HttpsError("permission-denied", "Vehicle does not belong to this customer.");
  }
  if (!service.active) {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType,
  );
  if (compatibleBays.length === 0) {
    throw new HttpsError("failed-precondition", "No bays available for this service type.");
  }

  // Membership pre-validation (cheap, non-transactional fail-fast). The
  // authoritative check happens again inside the transaction against a fresh
  // read, since washesUsed is mutable and racy across concurrent bookings.
  const todayStr = now.toISOString().slice(0, 10);
  if (data.membershipId !== undefined) {
    const membershipSnap = await db.collection(COLLECTIONS.memberships()).doc(data.membershipId).get();
    if (!membershipSnap.exists) {
      throw new HttpsError("not-found", "Membership not found.");
    }
    const membership = membershipSnap.data() as Membership;
    if (membership.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    }
    if (membership.customerId !== user.uid) {
      throw new HttpsError("permission-denied", "Cannot use another customer's membership.");
    }
    if (membership.status !== "active") {
      throw new HttpsError(
        "failed-precondition",
        `Membership is not active (status: ${membership.status}).`,
      );
    }
    if (!membership.endDate || membership.endDate < todayStr) {
      throw new HttpsError("failed-precondition", "Membership has expired.");
    }
  }

  // Compute server-authoritative price
  const breakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    taxRatePercent: config.taxRatePercent,
    taxDescription: config.taxDescription,
    currency: config.currency,
  });

  // Authoritative, multi-day-aware completion instant — walks forward
  // consuming operating-hours-only minutes, skipping closed/holiday days.
  // Reduces to requestedStart + duration for any service that fits within
  // its start day (Phase 5 — multi-day booking; single source of truth used
  // by both booking and job records below, and re-derived identically by
  // rescheduleBooking).
  const estimatedEndAt = computeScheduleEnd(
    requestedStart,
    service.estimatedDurationMinutes,
    config.operatingHours,
    config.holidays,
    config.timezone,
  );
  const nowIso = now.toISOString();

  const bookingRef = db.collection(COLLECTIONS.bookings()).doc();
  const jobRef = db.collection(COLLECTIONS.jobs()).doc();
  const intentRef = db.collection(COLLECTIONS.bookingIntents()).doc(data.idempotencyKey);

  const result = await db.runTransaction(async (tx) => {
    // Idempotency check
    const intentSnap = await tx.get(intentRef);
    if (intentSnap.exists) {
      const existingBookingId = (intentSnap.data() as { bookingId: string }).bookingId;
      const existingSnap = await tx.get(
        db.collection(COLLECTIONS.bookings()).doc(existingBookingId),
      );
      return { booking: existingSnap.data() as Booking };
    }

    // Re-validate availability inside the transaction to prevent race conditions.
    // Query all active jobs for compatible bays across a MAX_SERVICE_SPAN_DAYS-
    // wide window around the requested date — a same-day-only query would miss
    // a multi-day job that started earlier but is still occupying the bay
    // (Phase 5 — multi-day booking).
    const rangeStartDate = addDays(data.scheduledDate, -MAX_SERVICE_SPAN_DAYS);
    const rangeEndDate = addDays(data.scheduledDate, MAX_SERVICE_SPAN_DAYS);
    const bayOccupancy = new Map<string, OccupiedInterval[]>();
    for (const bay of compatibleBays) {
      const jobsSnap = await tx.get(
        db
          .collection(COLLECTIONS.jobs())
          .where("studioId", "==", data.studioId)
          .where("bayId", "==", bay.id)
          .where("scheduledDate", ">=", rangeStartDate)
          .where("scheduledDate", "<=", rangeEndDate),
      );
      const intervals: OccupiedInterval[] = [];
      for (const doc of jobsSnap.docs) {
        const job = doc.data() as ServiceJob;
        if (job.status === "CANCELLED" || job.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
      }
      bayOccupancy.set(bay.id, intervals);
    }

    // Find the least-loaded available bay
    let assignedBayId: string | null = null;
    let minJobs = Infinity;

    for (const bay of compatibleBays) {
      const occupied = bayOccupancy.get(bay.id) ?? [];
      if (!hasConflict(requestedStart, estimatedEndAt, occupied)) {
        if (occupied.length < minJobs) {
          minJobs = occupied.length;
          assignedBayId = bay.id;
        }
      }
    }

    if (!assignedBayId) {
      throw new HttpsError(
        "resource-exhausted",
        "No bays available for the requested time slot. Please choose another time.",
      );
    }

    // Membership benefit — re-validated against a FRESH read inside the
    // transaction (the race-safety guarantee: two concurrent bookings both
    // reading washesUsed and racing to consume the last credit will have one
    // transaction retried/serialized by Firestore, exactly like bay
    // assignment above — doc07 §7.5).
    let finalBreakdown = breakdown;
    let membershipWashUsed = false;
    let membershipDiscountApplied = false;
    const membershipRef = data.membershipId
      ? db.collection(COLLECTIONS.memberships()).doc(data.membershipId)
      : null;

    if (membershipRef) {
      const membershipSnap = await tx.get(membershipRef);
      if (!membershipSnap.exists) {
        throw new HttpsError("not-found", "Membership not found.");
      }
      const membership = membershipSnap.data() as Membership;
      if (membership.tenantId !== user.claims.tenantId || membership.customerId !== user.uid) {
        throw new HttpsError("permission-denied", "Cannot use another customer's membership.");
      }
      if (membership.status !== "active" || !membership.endDate || membership.endDate < data.scheduledDate) {
        throw new HttpsError("failed-precondition", "Membership is not active or has expired.");
      }

      const consumeWash = service.membershipWashEligible && membership.washesUsed < membership.washesTotal;
      finalBreakdown = applyMembershipBenefit(breakdown, {
        discountPercent: membership.discountPercent,
        consumeWash,
      });
      membershipWashUsed = consumeWash;
      membershipDiscountApplied = consumeWash || finalBreakdown.membershipDiscount !== null && finalBreakdown.membershipDiscount > 0;

      if (consumeWash) {
        tx.update(membershipRef, { washesUsed: membership.washesUsed + 1, updatedAt: nowIso });
      }

      if (membershipDiscountApplied) {
        const usageRef = db.collection(SUBCOLLECTIONS.membershipUsage(data.membershipId as string)).doc();
        const usage: MembershipUsage = {
          id: usageRef.id,
          tenantId: user.claims.tenantId,
          membershipId: data.membershipId as string,
          customerId: user.uid,
          usageType: consumeWash ? "wash" : "discount",
          jobId: jobRef.id,
          bookingId: bookingRef.id,
          valueRedeemed: consumeWash ? breakdown.subtotal : (finalBreakdown.membershipDiscount ?? 0),
          usedAt: nowIso,
        };
        tx.set(usageRef, usage);
        writeAuditLog(tx, {
          action: consumeWash ? "membership.wash_used" : "membership.discount_applied",
          entityType: "Membership",
          entityId: data.membershipId as string,
          user,
          studioId: data.studioId,
          after: {
            jobId: jobRef.id,
            bookingId: bookingRef.id,
            valueRedeemed: usage.valueRedeemed,
            washesRemaining: consumeWash
              ? membership.washesTotal - (membership.washesUsed + 1)
              : membership.washesTotal - membership.washesUsed,
          },
        });
      }
    }

    const booking: Booking = {
      id: bookingRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      customerId: user.uid,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      vehicleCategory: data.vehicleCategory,
      scheduledAt: requestedStart.toISOString(),
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(estimatedEndAt, config.timezone),
      estimatedEndTime: utcToLocalTime(estimatedEndAt, config.timezone),
      durationMinutes: service.estimatedDurationMinutes,
      bayId: assignedBayId,
      assignedEmployeeId: null,
      status: "CONFIRMED",
      priceBreakdown: finalBreakdown,
      totalAmount: finalBreakdown.total,
      membershipId: data.membershipId ?? null,
      membershipDiscountApplied,
      membershipWashUsed,
      paymentStatus: "unpaid",
      notes: data.notes ?? null,
      idempotencyKey: data.idempotencyKey,
      rescheduleCount: 0,
      confirmedAt: nowIso,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const job: ServiceJob = {
      id: jobRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      bookingId: bookingRef.id,
      customerId: user.uid,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      bayId: assignedBayId,
      assignedEmployeeId: null,
      status: "PENDING_VEHICLE",
      statusHistory: [
        {
          status: "PENDING_VEHICLE",
          changedAt: nowIso,
          changedBy: user.uid,
          notes: null,
        },
      ],
      scheduledAt: requestedStart.toISOString(),
      scheduledDate: data.scheduledDate,
      // Buffer-free — same instant as booking.estimatedEndAt above (single
      // source of truth). The turnover buffer is applied only when building
      // occupancy intervals (buildOccupiedInterval), never stored here.
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(estimatedEndAt, config.timezone),
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      studioNotes: data.notes ?? null,
      additionalWorkDelta: 0,
      priceBreakdown: finalBreakdown, // same snapshot already computed for the booking — not recomputed
      totalAmount: finalBreakdown.total,
      paymentStatus: "unpaid",
      isWalkIn: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      sealedAt: null,
    };

    tx.set(bookingRef, booking);
    tx.set(jobRef, job);
    tx.set(intentRef, {
      bookingId: bookingRef.id,
      customerId: user.uid,
      tenantId: user.claims.tenantId,
      createdAt: nowIso,
    });
    writeAuditLog(tx, {
      action: "booking.created",
      entityType: "Booking",
      entityId: bookingRef.id,
      user,
      studioId: data.studioId,
      after: {
        id: bookingRef.id,
        serviceId: data.serviceId,
        scheduledAt: requestedStart.toISOString(),
        bayId: assignedBayId,
        totalAmount: breakdown.total,
        status: "CONFIRMED",
      },
    });

    return { booking };
  });

  return result;
});
