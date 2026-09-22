import { collection, query, where, orderBy, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob } from "@autodeck/core";

/**
 * Real-time listener for the operational job linked to a booking.
 * A booking has at most one job (bookingId is set once, at job creation).
 *
 * Filters by tenantId and customerId as well as bookingId: Firestore rejects
 * a list query outright (not per-document) unless every field the security
 * rule checks is constrained by an equality filter the rules engine can
 * verify statically. The /jobs rule requires ownTenant(resource.data) (needs
 * tenantId) unconditionally, and resource.data.customerId == uid for the
 * customer-role branch — so both must be filtered here even though
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
 * Real-time listener for all jobs against a single vehicle — the data source
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


/** Real-time customer job feed used by the vehicle-first Home projection. */
export function listenToMyJobs(tenantId: string, customerId: string, onData: (jobs: ServiceJob[]) => void, onError: (err: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.jobs()), where("tenantId", "==", tenantId), where("customerId", "==", customerId), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ServiceJob)), onError);
}
