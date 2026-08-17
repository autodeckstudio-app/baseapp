export type AuditAction =
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "job.status_advanced"
  | "job.sealed"
  | "payment.recorded"
  | "payment.refunded"
  | "invoice.generated"
  | "approval.created"
  | "approval.responded"
  | "membership.activated"
  | "membership.cancelled"
  | "employee.created"
  | "employee.role_changed"
  | "employee.deactivated"
  | "studio.config_updated"
  | "service.created"
  | "service.updated"
  | "service.deactivated";

export interface AuditLog {
  id: string;
  tenantId: string;
  studioId: string;
  action: AuditAction;
  entityType: string; // e.g. "Booking", "ServiceJob"
  entityId: string;
  performedBy: string; // uid
  performedByRole: string;
  before: Record<string, unknown> | null; // relevant fields before change
  after: Record<string, unknown> | null; // relevant fields after change
  metadata: Record<string, unknown>;
  createdAt: string;
}
