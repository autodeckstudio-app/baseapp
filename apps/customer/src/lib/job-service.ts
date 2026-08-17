import { collection, query, where, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { ServiceJob } from "@autodeck/core";

/**
 * Real-time listener for the operational job linked to a booking.
 * A booking has at most one job (bookingId is set once, at job creation).
 * Firestore rules restrict reads to the job's own customerId.
 */
export function listenToJobForBooking(
  bookingId: string,
  onData: (job: ServiceJob | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.jobs()), where("bookingId", "==", bookingId));
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as ServiceJob | undefined) ?? null),
    onError,
  );
}
