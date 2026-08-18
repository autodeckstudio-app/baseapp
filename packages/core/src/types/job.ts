import type { PriceBreakdown } from "./booking.js";

export type JobStatus =
  | "PENDING_VEHICLE"      // Created from booking; vehicle not yet arrived
  | "VEHICLE_RECEIVED"     // Vehicle checked in (or walk-in)
  | "IN_PROGRESS"
  | "QUALITY_CHECK"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export interface JobStatusHistoryEntry {
  status: JobStatus;
  changedAt: string;
  changedBy: string; // employeeId or adminId
  notes: string | null;
}

export interface ServiceJob {
  id: string;
  tenantId: string;
  studioId: string;
  bookingId: string | null; // null for walk-ins
  customerId: string;
  vehicleId: string;
  serviceId: string;
  bayId: string;
  assignedEmployeeId: string | null;
  status: JobStatus;
  statusHistory: JobStatusHistoryEntry[]; // append-only embedded array
  scheduledAt: string; // ISO UTC — booked start time or walk-in creation time
  scheduledDate: string; // "YYYY-MM-DD" in studio TZ — used for date-scoped queries
  // ISO UTC — true service completion instant (buffer-free), computed via
  // computeScheduleEnd from scheduledAt + estimatedDurationMinutes, walking
  // forward across operating days only (multi-day-aware; equals the naive
  // scheduledAt + estimatedDurationMinutes for any service that fits within
  // its start day). The turnover buffer is applied only where occupancy
  // intervals are built (buildOccupiedInterval), never baked in here — this
  // keeps estimatedEndAt directly comparable to Booking.estimatedEndAt.
  estimatedEndAt: string;
  estimatedEndDate: string; // "YYYY-MM-DD" in studio TZ — == scheduledDate unless the job spans multiple days
  estimatedDurationMinutes: number; // snapshotted from service at job creation
  studioNotes: string | null;
  additionalWorkDelta: number; // paise — sum of approved ApprovalRequests
  // Server-authoritative price snapshot, resolved at job creation from
  // (service, vehicleCategory) via the shared pricing engine. For a
  // booking-sourced job this is a copy of the booking's own snapshot
  // (computed once, never recomputed); for a walk-in it is computed
  // directly since there is no booking. Immutable after creation — this is
  // the historical truth for payment/invoice, independent of bookingId.
  priceBreakdown: PriceBreakdown;
  totalAmount: number; // paise — equals priceBreakdown.total
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  isWalkIn: boolean;
  createdAt: string;
  updatedAt: string;
  sealedAt: string | null; // set on DELIVERED
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

// Mid-job additional-work approval (Phase 3). The additional work is always
// an existing catalogue Service selected by studio/admin — never a
// free-typed price — so unitPrice/priceImpact are always server-computed via
// the same pricing engine used for bookings (calculatePrice), never trusted
// from the client. originalAmount/newTotal are frozen at creation time so
// the customer sees a coherent before/after even if other approvals resolve
// in between. Approving increments ServiceJob.additionalWorkDelta/
// totalAmount — the original Booking/Job priceBreakdown snapshot is never
// rewritten (doc06 §6.4 Rule 1).
export interface ApprovalRequest {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  bookingId: string | null; // SNAPSHOT — job's booking, if any (null for walk-ins)
  customerId: string;
  vehicleId: string; // SNAPSHOT — for display without re-reading the job
  requestedBy: string; // uid of the studio/admin user who created it
  reason: string; // free text — why this work is needed
  serviceId: string; // the additional service, selected from the catalogue
  serviceName: string; // SNAPSHOT
  quantity: number; // >= 1
  unitPrice: number; // paise — from the pricing engine, per unit
  priceImpact: number; // paise — unitPrice * quantity
  timeImpactMinutes: number; // estimatedDurationMinutes * quantity
  originalAmount: number; // paise — job.totalAmount at request creation
  newTotal: number; // paise — originalAmount + priceImpact
  photos: string[]; // Storage URLs — unused in this build (no Storage/Blaze)
  status: ApprovalStatus;
  respondedAt: string | null;
  respondedBy: string | null; // customerId (approve/reject) or studio/admin uid (cancel)
  expiresAt: string; // APPROVAL_EXPIRY_HOURS from creation
  createdAt: string;
}
