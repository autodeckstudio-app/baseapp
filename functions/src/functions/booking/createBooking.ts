import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, StudioConfig, ServiceJob, Booking, Vehicle } from "@autodeck/core";
import {
  TURNOVER_BUFFER_MINUTES,
  MAX_ADVANCE_BOOKING_DAYS,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { createBookingSchema } from "../../schemas/booking.js";
import { calculatePrice } from "../../lib/pricing.js";
import {
  buildOccupiedInterval,
  hasConflict,
  type OccupiedInterval,
} from "../../lib/availability.js";
import { localToUTC, utcToLocalDate, utcToLocalTime } from "../../lib/schedule.js";

export const createBooking = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(createBookingSchema, request.data);

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

  // Compute server-authoritative price
  const breakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    taxRatePercent: config.taxRatePercent,
    taxDescription: config.taxDescription,
    currency: config.currency,
  });

  const estimatedEndAt = new Date(
    requestedStart.getTime() + service.estimatedDurationMinutes * 60000,
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
    // Query all active jobs for compatible bays on the requested date.
    const bayOccupancy = new Map<string, OccupiedInterval[]>();
    for (const bay of compatibleBays) {
      const jobsSnap = await tx.get(
        db
          .collection(COLLECTIONS.jobs())
          .where("studioId", "==", data.studioId)
          .where("bayId", "==", bay.id)
          .where("scheduledDate", "==", data.scheduledDate),
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
      if (!hasConflict(requestedStart, service.estimatedDurationMinutes, occupied)) {
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
      priceBreakdown: breakdown,
      totalAmount: breakdown.total,
      membershipDiscountApplied: false,
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
      estimatedEndAt: new Date(
        requestedStart.getTime() +
          (service.estimatedDurationMinutes + TURNOVER_BUFFER_MINUTES) * 60000,
      ).toISOString(),
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      studioNotes: data.notes ?? null,
      additionalWorkDelta: 0,
      priceBreakdown: breakdown, // same snapshot already computed for the booking — not recomputed
      totalAmount: breakdown.total,
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
