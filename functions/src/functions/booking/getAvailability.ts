import {acceptedServiceQuote} from "../../lib/accepted-service-quote.js";
import type {QuoteJourney} from "@autodeck/core";
import {hasReleasedBay, isReservationBackedPending} from "@autodeck/core";
import { customerHasPriority } from "../../lib/priority-access.js";
import { heldStartTimes, isPriorityHeld } from "../../lib/priority-hold.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, StudioConfig, ServiceJob } from "@autodeck/core";
import { MAX_SERVICE_SPAN_DAYS } from "@autodeck/core";
import { extrasProblem } from "../../lib/booking-lines.js";
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
import { physicallyHeldBayIds } from "../../lib/bay-type-lock.js";
import { planStages, visitStages, SLOT_INTERVAL_MINUTES, TURNOVER_BUFFER_MINUTES } from "@autodeck/core";
import type { AvailableSlot } from "../../lib/availability.js";
import { computeScheduleEnd, getDayOfWeek, localToUTC, minutesToTime, timeToMinutes, utcToLocalDate, utcToLocalTime } from "../../lib/schedule.js";
import { activeReservationsForBays } from "../../lib/bay-reservations.js";
import { addDays } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";

const MAX_RETURNED_SLOTS = 60;

export const getAvailability = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
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
  if (service.customerMenu?.priceMode==='inspection'&&!data.quoteJourneyId) throw new HttpsError('failed-precondition','Bring your car to the studio for inspection. Agree work and price before service.');
  if (!service.active || service.catalogueEntryKind==='enquiry') {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  // Extra services in the same visit lengthen the slot. Same rules as createBooking; the price is not needed here.
  let visitMinutes = service.estimatedDurationMinutes;
  const cartExtras: Service[] = []; // cart order (approved execution order)
  if(data.quoteJourneyId){if(data.extraServiceIds?.length)throw new HttpsError("failed-precondition","Accepted quote covers its exact work only.");const cid=await requireCustomerDocId(db,COLLECTIONS.customers(),user.claims.tenantId,user.uid);const q=(await db.collection("serviceQuoteJourneys").doc(data.quoteJourneyId).get()).data() as QuoteJourney|undefined;const offer=acceptedServiceQuote(q,{tenantId:user.claims.tenantId,customerId:cid,studioId:data.studioId,serviceId:data.serviceId,vehicleId:q?.scope.vehicleId??"",revision:data.quoteRevision??0,termsVersion:data.quoteTermsVersion??""});if((service.productKey??null)!==q!.scope.productKey||!!q!.requestedReference&&service.name!==q!.scope.coverage)throw new HttpsError('failed-precondition','The selected offering changed. Ask the studio to review the quote.');visitMinutes=offer.workingMinutes;}else if(data.quoteRevision||data.quoteTermsVersion)throw new HttpsError("invalid-argument","Quote reference required.");
  if (data.extraServiceIds?.length) {
    const extraSnaps = await Promise.all(data.extraServiceIds.map((id) => db.collection(COLLECTIONS.services()).doc(id).get()));
    if (extraSnaps.some((x) => !x.exists)) throw new HttpsError("not-found", "Service not found.");
    const extras = extraSnaps.map((x) => ({ ...(x.data() as Service), id: x.id }));
    if (extras.some((e) => e.tenantId !== user.claims.tenantId)) throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    const problem = extrasProblem({ ...service, id: serviceSnap.id }, extras, { gift: false });
    if (problem) throw new HttpsError("failed-precondition", problem);
    visitMinutes = extras.reduce((m, e) => m + e.estimatedDurationMinutes, visitMinutes);
    cartExtras.push(...extras);
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

  // Mixed-bay visit: every stage needs a free bay of its own type (one reservation per stage at booking time).
  const cartTypes = [...new Set([service.requiredBayType, ...cartExtras.map((e) => e.requiredBayType)])];
  const mixedVisit = cartTypes.length > 1;
  const candidateBays = mixedVisit ? config.bays.filter((b) => b.active && cartTypes.includes(b.bayType)) : compatibleBays;
  if (mixedVisit && cartTypes.some((t) => !candidateBays.some((b) => b.bayType === t))) return { slots: [] };

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
    candidateBays.map(async (bay) => {
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
        if (hasReleasedBay(job)||job.status === "CANCELLED" || job.status === "DELIVERED" || isReservationBackedPending(job)) continue;
        intervals.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
      }
      occupiedByBay.set(bay.id, intervals);
    }),
  );

  // Bays held by bookings' stage reservations (bayReservations) are planned occupancy too.
  const reservedByBay = await activeReservationsForBays((q) => q.get(), db, data.studioId, candidateBays.map((b) => b.id));
  for (const [reservedBayId, list] of reservedByBay) occupiedByBay.set(reservedBayId, [...(occupiedByBay.get(reservedBayId) ?? []), ...list]);

  // A vehicle still physically in a bay keeps it whatever its estimate says (overrun, overnight, closed days), so
  // that bay offers no slot until staff release or move it. Same rule as createBooking; no far-future dates.
  const heldBays = await physicallyHeldBayIds((q) => q.get(), db, data.studioId, candidateBays.map((b) => b.id));

  const slots: AvailableSlot[] = mixedVisit ? mixedVisitSlots({ startDate: data.startDate, lookAheadDays, ordered: [{ ...service, id: serviceSnap.id }, ...cartExtras], bays: candidateBays.filter((b) => !heldBays.has(b.id)), occupied: occupiedByBay, config }) : computeAvailability({
    startDate: data.startDate,
    lookAheadDays,
    serviceDurationMinutes: visitMinutes,
    requiredBayType: service.requiredBayType,
    bays: config.bays.filter((b) => !heldBays.has(b.id)),
    operatingHours: config.operatingHours,
    holidays: config.holidays,
    timezone: config.timezone,
    occupiedByBay,
  });

  // Held start times are hidden from customers without a priority slot until the hold ends (18:00 the evening before).
  let visible = slots;
  if (user.claims.role === "customer") {
    const now = new Date();
    const customerDocId = await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid);
    const mine = await customerHasPriority(db, customerDocId, now, config.timezone);
    if (!mine) {
      const heldByDate = new Map<string, string[]>();
      visible = slots.filter((s) => {
        let held = heldByDate.get(s.date);
        if (!held) {
          held = heldStartTimes({ date: s.date, serviceDurationMinutes: visitMinutes, operatingHours: config.operatingHours, holidays: config.holidays, timezone: config.timezone });
          heldByDate.set(s.date, held);
        }
        return !isPriorityHeld({ date: s.date, startTime: s.startTime, held, now, timezone: config.timezone });
      });
    }
  }
  return { slots: visible.slice(0, MAX_RETURNED_SLOTS) };
});

/** Start times for a mixed-bay visit: every stage planned in cart order with 0 transfer minutes (approved), each in a
 *  free bay of its own type. Same candidate rule as generateDaySlots: the visit (plus turnover) must fit the day, or it
 *  rolls over into the next open days when it cannot fit any single day. Past start times are never offered. */
function mixedVisitSlots(p: { startDate: string; lookAheadDays: number; ordered: Service[]; bays: StudioConfig["bays"]; occupied: Map<string, OccupiedInterval[]>; config: StudioConfig }): AvailableSlot[] {
  const stages = visitStages(p.ordered).flat();
  const total = stages.reduce((m, st) => m + st.minutes, 0);
  const tz = p.config.timezone, now = Date.now(), out: AvailableSlot[] = [];
  const workEnd = (start: Date, minutes: number) => computeScheduleEnd(start, minutes, p.config.operatingHours, p.config.holidays, tz);
  const bays = p.bays.map((b) => ({ id: b.id, bayType: b.bayType, active: b.active }));
  for (let d = 0; d < p.lookAheadDays; d++) {
    const date = addDays(p.startDate, d);
    const hours = p.config.operatingHours.find((h) => h.dayOfWeek === getDayOfWeek(date));
    if (!hours || hours.closed || p.config.holidays.includes(date)) continue;
    const openMin = timeToMinutes(hours.open), closeMin = timeToMinutes(hours.close);
    const lastStart = total + TURNOVER_BUFFER_MINUTES <= closeMin - openMin ? closeMin - total - TURNOVER_BUFFER_MINUTES : closeMin - SLOT_INTERVAL_MINUTES;
    for (let m = openMin; m <= lastStart; m += SLOT_INTERVAL_MINUTES) {
      const startTime = minutesToTime(m), startAt = localToUTC(date, startTime, tz);
      if (startAt.getTime() < now) continue;
      const plan = planStages({ startAt, stages, bays, occupied: p.occupied, workEnd, transferMinutes: 0 });
      if (!plan) continue;
      const end = new Date(plan.at(-1)!.endAt);
      out.push({ date, startTime, endTime: utcToLocalTime(end, tz), estimatedEndDate: utcToLocalDate(end, tz), startAt: startAt.toISOString(), estimatedEndAt: end.toISOString() });
    }
  }
  return out;
}
