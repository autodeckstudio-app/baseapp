import { collection, doc, query, where, orderBy, onSnapshot, type Unsubscribe, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Booking, ServiceJob } from "@autodeck/core";

/**
 * Real-time listener for the operational job linked to a booking.
 * A booking has at most one job (bookingId is set once, at job creation).
 *
 * Filters by tenantId and customerId as well as bookingId: Firestore rejects
 * a list query outright (not per-document) unless every field the security
 * rule checks is constrained by an equality filter the rules engine can
 * verify statically. The /jobs rule requires ownTenant(resource.data) (needs
 * tenantId) unconditionally, and resource.data.customerId == uid for the
 * customer-role branch - so both must be filtered here even though
 * bookingId alone would already identify a unique document.
 */
export function listenToJobForBooking(
  bookingId: string,
  tenantId: string,
  customerId: string,
  onData: (job: ServiceJob | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("bookingId", "==", bookingId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as ServiceJob | undefined) ?? null),
    onError,
  );
}

/**
 * Real-time listener for all jobs against a single vehicle - the data source
 * for the vehicle Passport/history view. Same equality-filter requirement as
 * listenToJobForBooking (tenantId + customerId both filtered, not just
 * vehicleId, to satisfy the /jobs rule statically).
 */
export function listenToJobsForVehicle(
  vehicleId: string,
  tenantId: string,
  customerId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("vehicleId", "==", vehicleId),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as ServiceJob)),
    onError,
  );
}

export function listenToMyJobs(tenantId:string,customerId:string,onData:(items:ServiceJob[])=>void,onError:(err:Error)=>void):Unsubscribe {
 const q=query(collection(db,COLLECTIONS.jobs()),where("tenantId","==",tenantId),where("customerId","==",customerId));
 return onSnapshot(q,snap=>onData(snap.docs.map(d=>({...d.data(),id:d.id}) as ServiceJob).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))),onError);
}

/**
 * A walk-in visit has a job but no booking (job.bookingId is null), so the
 * app's "follow the visit" link carries the JOB id. Reading bookings/<jobId>
 * hits a missing document, which the /bookings rule reports as
 * "Missing or insufficient permissions". Read the job directly instead.
 */
export function listenToJobById(jobId: string, onData: (job: ServiceJob | null) => void, onError: (err: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, COLLECTIONS.jobs(), jobId), (snap) => onData(snap.exists() ? ({ ...(snap.data() as ServiceJob), id: snap.id }) : null), onError);
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

/** Shapes a booking-less (walk-in) job like a booking so the visit screens can show it. */
export function bookingFromJob(job: ServiceJob): Booking {
  const status: Booking["status"] = job.status === "DELIVERED" ? "COMPLETED" : job.status === "CANCELLED" ? "CANCELLED" : "ACTIVE";
  return {
    id: job.id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    customerId: job.customerId,
    vehicleId: job.vehicleId,
    ...(job.vehicleSnapshot ? { vehicleSnapshot: job.vehicleSnapshot as unknown as NonNullable<Booking["vehicleSnapshot"]> } : {}),
    serviceId: job.serviceId,
    vehicleCategory: "" as unknown as Booking["vehicleCategory"],
    scheduledAt: job.scheduledAt,
    scheduledDate: job.scheduledDate,
    scheduledTime: hhmm(job.scheduledAt),
    estimatedEndAt: job.estimatedEndAt,
    estimatedEndDate: job.estimatedEndDate,
    estimatedEndTime: hhmm(job.estimatedEndAt),
    durationMinutes: job.estimatedDurationMinutes,
    bayId: job.bayId,
    assignedEmployeeId: job.assignedEmployeeId,
    status,
    priceBreakdown: job.priceBreakdown,
    totalAmount: job.totalAmount,
    membershipId: null,
    membershipDiscountApplied: false,
    membershipWashUsed: false,
    paymentStatus: job.paymentStatus,
    ...(job.settlementKind ? {settlementKind:job.settlementKind} : {}),
    ...(job.invoiceId ? {invoiceId:job.invoiceId} : {}),
    notes: job.studioNotes,
    idempotencyKey: "",
    rescheduleCount: 0,
    confirmedAt: job.createdAt,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/** The job made for a booking, read once (it is created with the booking). Null if it is not there yet. */
export async function getJobIdForBooking(bookingId: string, tenantId: string, customerId: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.jobs()), where("bookingId", "==", bookingId), where("tenantId", "==", tenantId), where("customerId", "==", customerId)));
  return snap.empty ? null : snap.docs[0]!.id;
}
