// Customer-facing notification record. Written exclusively by the
// onAuditLogCreated trigger (functions/src/functions/notification/) — the
// AuditLog is the sole authoritative event source (Phase 2C architecture
// audit). No client ever writes this collection.
export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "job_started"
  | "job_completed"
  | "payment_successful"
  | "payment_failed"
  | "invoice_issued"
  | "membership_activated"
  | "membership_expired";

// Entities the customer app can navigate to from a notification. Job/Payment
// source events are resolved down to their owning Booking at write time
// (the customer app has no standalone job or payment detail screen).
export type NotificationEntityType = "Booking" | "Invoice" | "Membership";

export interface Notification {
  id: string; // == auditLogId — deterministic idempotency key (see spec)
  tenantId: string;
  userId: string; // recipient — Firebase Auth uid (customerId)
  auditLogId: string; // source event; doubles as this doc's idempotency key
  type: NotificationType;
  title: string;
  body: string;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
}
