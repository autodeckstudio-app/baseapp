import type { BookingStatus } from '@autodeck/domain';

/**
 * The `visits/{id}` Firestore document shape.
 *
 * A Visit tracks the shop-floor lifecycle of a single Booking, one-to-one:
 * created at check-in (Booking `booked` -> `in_progress`), completed
 * (`in_progress` -> `completed`), and sealed (`completed` -> `sealed`).
 * `status` reuses the pre-existing `BookingStatus` domain type rather than
 * declaring a redundant parallel enum — in practice a Visit only ever
 * occupies the `in_progress`/`completed`/`sealed` values, since
 * VisitsService only ever writes those three.
 *
 * `customerId` and `vehicleId` are denormalized from the Booking at
 * check-in time: `customerId` is required by the existing
 * `visits/{id}` Firestore rule's ownership read-check
 * (`resource.data.customerId == request.auth.uid`), and both are useful
 * shop-floor context without a second read.
 *
 * Per the approved product decisions ("Visit lifecycle with immutable
 * sealing") and the existing rules-file comment on `visits/{id}`
 * ("The backend enforces the sealed-immutability rule in its own logic"),
 * once `status` is `sealed` no further transition is possible — enforced by
 * reusing `isValidBookingTransition` (`ALLOWED_BOOKING_TRANSITIONS.sealed`
 * is empty), not a separate hand-written check.
 */
export interface VisitRecord {
  visitId: string; // backend-generated Firestore document ID
  bookingId: string;
  customerId: string;
  vehicleId: string;
  status: BookingStatus;
  checkedInAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  checkedInByStaffId: string;
  completedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  completedByStaffId?: string;
  sealedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  sealedByStaffId?: string;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
}
