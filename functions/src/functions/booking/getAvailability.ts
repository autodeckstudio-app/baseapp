import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, StudioConfig, ServiceJob } from "@autodeck/core";
import { MAX_SERVICE_SPAN_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getAvailabilitySchema } from "../../schemas/booking.js";
import {
  computeAvailability,
  buildOccupiedInterval,
  type OccupiedInterval,
} from "../../lib/availability.js";
import { addDays } from "../../lib/schedule.js";

const MAX_RETURNED_SLOTS = 60;

export const getAvailability = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(getAvailabilitySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "read.availability");

  const db = getFirestore();
  const lookAheadDays = data.lookAheadDays ?? 14;

  // Fetch service
  const serviceSnap = await db.collection(COLLECTIONS.services()).doc(data.serviceId).get();
  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  const service = serviceSnap.data() as Service;
  if (service.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (!service.active) {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  // Fetch studio config
  const configSnap = await db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get();
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");
  const config = configSnap.data() as StudioConfig;
  if (config.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  // Collect all compatible bays
  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType,
  );
  if (compatibleBays.length === 0) {
    return { slots: [] };
  }

  // Build the date range to query jobs for. The lower bound is widened
  // backward by MAX_SERVICE_SPAN_DAYS so that multi-day jobs which STARTED
  // before data.startDate but are still running (occupying the bay) through
  // the requested window are still found — a same-day-only query would
  // silently miss them (Phase 5 — multi-day booking).
  const queryStartDate = addDays(data.startDate, -MAX_SERVICE_SPAN_DAYS);
  const endDate = addDays(data.startDate, lookAheadDays);

  // Query all non-cancelled/delivered jobs for compatible bays in the date range
  const occupiedByBay = new Map<string, OccupiedInterval[]>();

  await Promise.all(
    compatibleBays.map(async (bay) => {
      const jobsSnap = await db
        .collection(COLLECTIONS.jobs())
        .where("studioId", "==", data.studioId)
        .where("bayId", "==", bay.id)
        .where("scheduledDate", ">=", queryStartDate)
        .where("scheduledDate", "<=", endDate)
        .get();

      const intervals: OccupiedInterval[] = [];
      for (const doc of jobsSnap.docs) {
        const job = doc.data() as ServiceJob;
        if (job.status === "CANCELLED" || job.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
      }
      occupiedByBay.set(bay.id, intervals);
    }),
  );

  const slots = computeAvailability({
    startDate: data.startDate,
    lookAheadDays,
    serviceDurationMinutes: service.estimatedDurationMinutes,
    requiredBayType: service.requiredBayType,
    bays: config.bays,
    operatingHours: config.operatingHours,
    holidays: config.holidays,
    timezone: config.timezone,
    occupiedByBay,
  });

  return { slots: slots.slice(0, MAX_RETURNED_SLOTS) };
});
