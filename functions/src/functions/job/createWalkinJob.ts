import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, StudioConfig, ServiceJob, Vehicle, Customer } from "@autodeck/core";
import { TURNOVER_BUFFER_MINUTES } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createWalkinJobSchema } from "../../schemas/job.js";
import {
  buildOccupiedInterval,
  hasConflict,
  type OccupiedInterval,
} from "../../lib/availability.js";
import { utcToLocalDate } from "../../lib/schedule.js";
import { calculatePrice } from "../../lib/pricing.js";

export const createWalkinJob = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(createWalkinJobSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "job.walkinCreate");

  const db = getFirestore();
  const now = new Date();
  const nowIso = now.toISOString();

  // Studio users are scoped to their own studio — matches the same check
  // already enforced on advanceJobStatus/assignBay/createApproval.
  if (user.claims.role === "studio" && user.claims.studioId !== data.studioId) {
    throw new HttpsError("permission-denied", "Cannot create a walk-in job for a different studio.");
  }

  const [serviceSnap, configSnap, vehicleSnap, customerSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(data.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get(),
    db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get(),
    db.collection(COLLECTIONS.customers()).doc(data.customerId).get(),
  ]);

  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
  if (!customerSnap.exists) throw new HttpsError("not-found", "Customer not found.");

  const service = serviceSnap.data() as Service;
  const config = configSnap.data() as StudioConfig;
  const vehicle = vehicleSnap.data() as Vehicle;
  const customer = customerSnap.data() as Customer;

  assertTenant(user, service.tenantId);
  assertTenant(user, config.tenantId);
  assertTenant(user, vehicle.tenantId);
  assertTenant(user, customer.tenantId);
  if (vehicle.ownerId !== data.customerId) {
    throw new HttpsError("failed-precondition", "Vehicle does not belong to the given customer.");
  }

  if (!service.active) {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  // Verify the requested bay exists, is active, and matches the service's required type
  const bay = config.bays.find((b) => b.id === data.bayId);
  if (!bay) throw new HttpsError("not-found", "Bay not found in studio configuration.");
  if (!bay.active) throw new HttpsError("failed-precondition", "Bay is not active.");
  if (bay.bayType !== service.requiredBayType) {
    throw new HttpsError(
      "failed-precondition",
      `Bay type '${bay.bayType}' is not compatible with service requiring '${service.requiredBayType}'.`,
    );
  }

  // Server-authoritative price snapshot — same pricing engine used by createBooking.
  // Resolved once, at creation, from (service, vehicleCategory); immutable thereafter.
  const priceBreakdown = calculatePrice({
    basePrice: service.basePrice,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    taxRatePercent: config.taxRatePercent,
    taxDescription: config.taxDescription,
    currency: config.currency,
  });

  const scheduledDate = utcToLocalDate(now, config.timezone);
  const estimatedEndAt = new Date(
    now.getTime() + (service.estimatedDurationMinutes + TURNOVER_BUFFER_MINUTES) * 60000,
  );
  const jobRef = db.collection(COLLECTIONS.jobs()).doc();

  await db.runTransaction(async (tx) => {
    // Transactional bay check: ensure no active job is currently occupying this bay
    const activeJobsSnap = await tx.get(
      db
        .collection(COLLECTIONS.jobs())
        .where("studioId", "==", data.studioId)
        .where("bayId", "==", data.bayId)
        .where("scheduledDate", "==", scheduledDate),
    );

    const occupied: OccupiedInterval[] = [];
    for (const doc of activeJobsSnap.docs) {
      const job = doc.data() as ServiceJob;
      if (job.status === "CANCELLED" || job.status === "DELIVERED") continue;
      occupied.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
    }

    if (hasConflict(now, service.estimatedDurationMinutes, occupied)) {
      throw new HttpsError(
        "resource-exhausted",
        "Bay is currently occupied. Please select a different bay.",
      );
    }

    const walkinJob: ServiceJob = {
      id: jobRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      bookingId: null,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      bayId: data.bayId,
      assignedEmployeeId: user.uid,
      status: "VEHICLE_RECEIVED",
      statusHistory: [
        {
          status: "VEHICLE_RECEIVED",
          changedAt: nowIso,
          changedBy: user.uid,
          notes: data.notes ?? null,
        },
      ],
      scheduledAt: nowIso,
      scheduledDate,
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedDurationMinutes: service.estimatedDurationMinutes,
      studioNotes: data.notes ?? null,
      additionalWorkDelta: 0,
      priceBreakdown,
      totalAmount: priceBreakdown.total,
      paymentStatus: "unpaid",
      isWalkIn: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      sealedAt: null,
    };

    tx.set(jobRef, walkinJob);
    writeAuditLog(tx, {
      action: "job.walkin_created",
      entityType: "ServiceJob",
      entityId: jobRef.id,
      user,
      studioId: data.studioId,
      after: {
        id: jobRef.id,
        bayId: data.bayId,
        serviceId: data.serviceId,
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        totalAmount: priceBreakdown.total,
      },
    });
  });

  const created = await db.collection(COLLECTIONS.jobs()).doc(jobRef.id).get();
  return { job: created.data() as ServiceJob };
});
