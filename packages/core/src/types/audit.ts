export type AuditAction =
  | "customer.created"
  | "customer.profile_updated"
  | "vehicle.created"
  | "vehicle.updated"
  | "vehicle.archived"
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "job.status_advanced"
  | "job.sealed"
  | "payment.recorded"
  | "payment.refunded"
  | "invoice.generated"
  | "approval.created"
  | "approval.approved"
  | "approval.rejected"
  | "approval.cancelled"
  | "approval.expired"
  | "membership.plan_created"
  | "membership.plan_updated"
  | "membership.plan_activated"
  | "membership.plan_deactivated"
  | "membership.purchased"
  | "membership.activated"
  | "membership.cancelled"
  | "membership.wash_used"
  | "membership.discount_applied"
  | "membership.wash_restored"
  | "membership.expired"
  | "employee.created"
  | "employee.role_changed"
  | "employee.deactivated"
  | "studio.config_updated"
  | "service.created"
  | "service.updated"
  | "service.activated"
  | "service.deactivated"
  | "booking.rescheduled"
  | "booking.expired"
  | "job.walkin_created"
  | "job.bay_reassigned"
  | "payment.initiated"
  | "payment.completed"
  | "payment.failed"
  | "payment.cancelled"
  | "payment.refund_requested"
  | "payment.refunded"
  | "invoice.created"
  | "invoice.issued"
  | "invoice.paid"
  | "invoice.voided"
  | "protection.created"
  | "protection.updated"
  | "protection.verified"
  | "warranty.issued"
  | "inspection.started"
  | "inspection.updated"
  | "inspection.finalized"
  | "attendance.checked_in"
  | "attendance.checked_out"
  | "attendance.break_started"
  | "attendance.break_ended"
  | "attendance.marked";

export interface AuditLog {
  id: string;
  tenantId: string;
  studioId: string | null; // null for tenant-level operations (e.g. customer creation)
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
