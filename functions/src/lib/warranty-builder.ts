// Builds a Warranty from the completed ServiceJob + its Service catalogue
// entry, both read at seal time (job DELIVERED). Everything is snapshotted —
// later catalogue edits must never alter an already-issued Warranty
// (doc06 §6.4 Rule 3). Warranty.id == jobId, giving deterministic,
// duplicate-proof issuance (see onAdvanceToDelivered in advanceJobStatus.ts).
import type { Warranty, ServiceJob, Service, WarrantyDurationUnit } from "@autodeck/core";

export interface BuildWarrantyParams {
  job: ServiceJob;
  service: Service;
  sealedAt: string;
}

// Calendar-correct addition (not fixed day-counts, to avoid leap-year drift
// on 'years'/'months'). Never called for 'lifetime'.
function addDuration(startDate: string, value: number, unit: Exclude<WarrantyDurationUnit, "lifetime">): string {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (unit === "days") date.setUTCDate(date.getUTCDate() + value);
  else if (unit === "months") date.setUTCMonth(date.getUTCMonth() + value);
  else date.setUTCFullYear(date.getUTCFullYear() + value);
  const iso = date.toISOString().slice(0, 10);
  return iso;
}

// Phase 2D.1: endDate is computed once, at issuance, from the Service's
// structured duration fields — never guessed. 'lifetime' and
// null/unconfigured both correctly resolve to a null endDate; only a
// concrete {value, unit} pair (unit != 'lifetime') produces a date.
function computeEndDate(startDate: string, service: Service): string | null {
  const { warrantyDurationValue: value, warrantyDurationUnit: unit } = service;
  if (unit === null || unit === "lifetime" || value === null) return null;
  return addDuration(startDate, value, unit);
}

// Returns null when the service carries no warranty (e.g. a plain wash) —
// no Warranty should be issued for such jobs.
export function buildWarranty(params: BuildWarrantyParams): Warranty | null {
  const { job, service, sealedAt } = params;
  if (!service.warrantyLabel) return null;

  const startDate = sealedAt.slice(0, 10);

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
    startDate,
    endDate: computeEndDate(startDate, service),
    installerEmployeeId: job.assignedEmployeeId,
    productBatchNumber: null,
    certificateUrl: null,
    qrVerificationToken: null,
    sealedAt,
    revokedAt: null,
    revokedReason: null,
  };
}
