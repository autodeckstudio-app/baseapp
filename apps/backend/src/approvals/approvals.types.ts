/**
 * The `approvals/{id}` Firestore document shape.
 *
 * Represents a single mid-visit approval request: staff proposes extra
 * work/cost during an in-progress visit, and the customer's decision
 * (recorded by staff — see approvals.service.ts's class doc for why) is
 * captured here. `decision` is intentionally NOT the same thing as
 * `BookingStatus`/`VisitStatus` — it is descriptive data about THIS
 * request's own outcome, never a competing state machine for the
 * booking/visit lifecycle (that remains solely `isValidBookingTransition`).
 *
 * `additionalAmount` is descriptive/audit data only — it is never merged
 * into `BookingRecord.priceSnapshot` (frozen at booking-creation time per
 * Phase 2E) and never triggers any payment. Actually charging or refunding
 * it is out of scope until Phase 2J's payment integration exists.
 */
export interface ApprovalRecord {
  approvalId: string; // backend-generated Firestore document ID
  bookingId: string;
  visitId: string;
  customerId: string; // denormalized from the visit, required by the existing approvals/{id} Firestore rule's ownership read-check
  description: string;
  additionalAmount: number; // integer, paise, nonnegative — the proposed extra cost, purely descriptive at this phase
  decision: 'pending' | 'approved' | 'declined';
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  createdByStaffId: string;
  resolvedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  resolvedByStaffId?: string;
}
