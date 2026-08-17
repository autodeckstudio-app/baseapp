export type JobStatus =
  | "VEHICLE_RECEIVED"
  | "IN_PROGRESS"
  | "QUALITY_CHECK"
  | "READY_FOR_DELIVERY"
  | "DELIVERED";

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
  studioNotes: string | null;
  additionalWorkDelta: number; // paise — sum of approved ApprovalRequests
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  isWalkIn: boolean;
  createdAt: string;
  updatedAt: string;
  sealedAt: string | null; // set on DELIVERED
}

export interface ApprovalRequest {
  id: string;
  tenantId: string; // REQUIRED — tenant isolation
  studioId: string; // REQUIRED — studio scoping
  jobId: string;
  customerId: string;
  requestedBy: string; // employeeId
  reason: string;
  proposedWork: string;
  priceImpact: number; // paise — additional cost (can be 0)
  timeImpact: number; // additional minutes
  photos: string[]; // Storage URLs
  status: "pending" | "approved" | "rejected" | "expired";
  respondedAt: string | null;
  respondedBy: string | null; // customerId or adminId
  expiresAt: string; // 24h from creation
  createdAt: string;
}
