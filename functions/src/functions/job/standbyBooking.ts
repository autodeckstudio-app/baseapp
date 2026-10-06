import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, Booking, Service, StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { standbyBookingSchema } from "../../schemas/job.js";
import { buildOccupiedInterval, hasConflict } from "../../lib/availability.js";
import { computeScheduleEnd, utcToLocalDate, utcToLocalTime, getDayOfWeek } from "../../lib/schedule.js";

// A standby car owns neither a slot nor a bay until admission. The common
// studio lock serializes FIFO admission; bay locks also serialize bookings.
export const standbyBooking = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(standbyBookingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "job.assignBay");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.jobs()).doc(data.jobId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = snap.data() as ServiceJob;
    assertTenant(user, job.tenantId);
    if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) throw new HttpsError("permission-denied", "Job belongs to another studio.");
    if (!job.bookingId) throw new HttpsError("failed-precondition", "Standby is for booked late arrivals.");
    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(job.bookingId);
    const bookingSnap = await tx.get(bookingRef);
    const booking = bookingSnap.data() as Booking | undefined;
    if (!booking) throw new HttpsError("not-found", "Booking not found.");
    if (booking.priceOnRequest && booking.quoteStatus !== "approved") throw new HttpsError("failed-precondition", "Customer must approve the quote first.");
    const lockRef = db.collection(COLLECTIONS.bayLocks()).doc(`${job.tenantId}__${job.studioId}__standby`);
    await tx.get(lockRef);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    if (data.action === "enqueue") {
      if (job.status === "STANDBY") return { jobId: job.id, status: "STANDBY", alreadyQueued: true };
      if (job.status !== "PENDING_VEHICLE" || booking.status !== "CONFIRMED") throw new HttpsError("failed-precondition", "Only unarrived confirmed bookings can join standby.");
      if (Date.parse(job.scheduledAt) > nowDate.getTime()) throw new HttpsError("failed-precondition", "This booking is not late yet.");
      const oldBayLock = db.collection(COLLECTIONS.bayLocks()).doc(`${job.tenantId}__${job.studioId}__${job.bayId}`);
      await tx.get(oldBayLock);
      tx.update(ref, { status: "STANDBY", bayId: "", standbyArrivedAt: now, standbyAdmittedAt: null, updatedAt: now,
        statusHistory: [...job.statusHistory, { status: "STANDBY", changedAt: now, changedBy: user.uid, notes: "Arrived - standby. No slot or bay reserved." }] });
      tx.update(bookingRef, { status: "ACTIVE", bayId: "", standbyArrivedAt: now, standbyAdmittedAt: null, updatedAt: now });
      tx.set(oldBayLock, { lastAssignedAt: now });
      tx.set(lockRef, { lastAssignedAt: now });
      writeAuditLog(tx, { action: "booking.standby_arrived", entityType: "Booking", entityId: booking.id, user, studioId: job.studioId, before: { bayId: job.bayId }, after: { status: "STANDBY", bayId: null } });
      return { jobId: job.id, status: "STANDBY" };
    }
    if (job.status !== "STANDBY" || booking.status !== "ACTIVE") throw new HttpsError("failed-precondition", "This car is not waiting on standby.");
    if (!data.bayId) throw new HttpsError("invalid-argument", "Choose an available compatible bay.");
    const [configSnap, serviceSnap, allJobs] = await Promise.all([
      tx.get(db.collection(COLLECTIONS.studioConfig()).doc(job.studioId)),
      tx.get(db.collection(COLLECTIONS.services()).doc(job.serviceId)),
      tx.get(db.collection(COLLECTIONS.jobs()).where("tenantId", "==", job.tenantId).where("studioId", "==", job.studioId)),
    ]);
    if (!configSnap.exists || !serviceSnap.exists) throw new HttpsError("not-found", "Studio or service not found.");
    const config = configSnap.data() as StudioConfig;
    const service = serviceSnap.data() as Service;
    assertTenant(user, config.tenantId); assertTenant(user, service.tenantId);
    const bay = config.bays.find(b => b.id === data.bayId && b.active && b.bayType === service.requiredBayType);
    if (!bay || !service.active) throw new HttpsError("failed-precondition", "Choose an active bay compatible with this service.");
    const date = utcToLocalDate(nowDate, config.timezone);
    const time = utcToLocalTime(nowDate, config.timezone);
    const hours = config.operatingHours.find(h => h.dayOfWeek === getDayOfWeek(date));
    if (!hours || hours.closed || config.holidays.includes(date) || time < hours.open || time >= hours.close) throw new HttpsError("failed-precondition", "Standby admission is available during studio opening hours only.");
    const jobs = allJobs.docs.map(d => d.data() as ServiceJob);
    const queue = jobs.filter(j => j.status === "STANDBY").sort((a,b) => (a.standbyArrivedAt ?? a.createdAt).localeCompare(b.standbyArrivedAt ?? b.createdAt) || a.id.localeCompare(b.id));
    // FIFO per compatible bay type. A wash queue cannot block a protection bay.
    for (const waiting of queue) {
      if (waiting.id === job.id) break;
      const waitingService = await tx.get(db.collection(COLLECTIONS.services()).doc(waiting.serviceId));
      if ((waitingService.data() as Service | undefined)?.requiredBayType === bay.bayType) throw new HttpsError("failed-precondition", "Admit the first waiting car for this bay type before this car.");
    }
    const bayLock = db.collection(COLLECTIONS.bayLocks()).doc(`${job.tenantId}__${job.studioId}__${bay.id}`);
    await tx.get(bayLock);
    const end = computeScheduleEnd(nowDate, job.estimatedDurationMinutes, config.operatingHours, config.holidays, config.timezone);
    const occupants = jobs.filter(j => j.id !== job.id && j.bayId === bay.id && !["DELIVERED", "CANCELLED", "STANDBY"].includes(j.status));
    // Physically present cars occupy the bay until handover even past estimate.
    if (occupants.some(j => j.status !== "PENDING_VEHICLE" && Date.parse(j.scheduledAt) <= nowDate.getTime()) || hasConflict(nowDate, end, occupants.map(j => buildOccupiedInterval(j.scheduledAt, j.estimatedEndAt)))) throw new HttpsError("resource-exhausted", "Bay is occupied or reserved during this service. Wait or choose another compatible bay.");
    const schedule = { bayId: bay.id, scheduledAt: now, scheduledDate: date, estimatedEndAt: end.toISOString(), estimatedEndDate: utcToLocalDate(end, config.timezone), standbyAdmittedAt: now, updatedAt: now };
    tx.update(ref, { ...schedule, status: "VEHICLE_RECEIVED", statusHistory: [...job.statusHistory, { status: "VEHICLE_RECEIVED", changedAt: now, changedBy: user.uid, notes: "Admitted from standby into an available bay." }] });
    tx.update(bookingRef, { ...schedule, scheduledTime: time, estimatedEndTime: utcToLocalTime(end, config.timezone), missedAt: null, missedForScheduledAt: null });
    tx.set(lockRef, { lastAssignedAt: now }); tx.set(bayLock, { lastAssignedAt: now });
    writeAuditLog(tx, { action: "job.status_advanced", entityType: "ServiceJob", entityId: job.id, user, studioId: job.studioId, before: { status: "STANDBY" }, after: { status: "VEHICLE_RECEIVED", bayId: bay.id, scheduledAt: now } });
    return { jobId: job.id, status: "VEHICLE_RECEIVED", bayId: bay.id };
  }, { maxAttempts: 10 });
});
