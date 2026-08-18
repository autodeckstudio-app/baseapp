// Builds a Warranty from the completed ServiceJob + its Service catalogue
// entry, both read at seal time (job DELIVERED). Everything is snapshotted —
// later catalogue edits must never alter an already-issued Warranty
// (doc06 §6.4 Rule 3). Warranty.id == jobId, giving deterministic,
// duplicate-proof issuance (see onAdvanceToDelivered in advanceJobStatus.ts).
import type { Warranty, ServiceJob, Service } from "@autodeck/core";

export interface BuildWarrantyParams {
  job: ServiceJob;
  service: Service;
  sealedAt: string;
}

// Returns null when the service carries no warranty (e.g. a plain wash) —
// no Warranty should be issued for such jobs.
export function buildWarranty(params: BuildWarrantyParams): Warranty | null {
  const { job, service, sealedAt } = params;
  if (!service.warrantyLabel) return null;

  return {
    id: job.id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
    customerId: job.customerId,
    vehicleId: job.vehicleId,
    serviceId: service.id,
    serviceName: service.name,
    warrantyLabel: service.warrantyLabel,
    coverageTerms: service.warrantyLabel,
    startDate: sealedAt.slice(0, 10),
    // Phase 2D decision: no structured warranty duration exists on Service
    // (doc06's warrantyTemplate was never implemented) — see warranty.ts.
    endDate: null,
    installerEmployeeId: job.assignedEmployeeId,
    productBatchNumber: null,
    certificateUrl: null,
    qrVerificationToken: null,
    sealedAt,
    revokedAt: null,
    revokedReason: null,
  };
}
