export interface Warranty {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  warrantyLabel: string; // e.g. "5-Year PPF Film Warranty"
  coverageTerms: string; // plain-text warranty terms — sealed at job completion
  startDate: string; // ISO date
  endDate: string; // ISO date
  installerEmployeeId: string | null;
  productBatchNumber: string | null;
  certificateUrl: string | null; // Storage signed URL (V2+)
  qrVerificationToken: string | null; // V2+
  sealedAt: string; // immutable — set when job is DELIVERED
  revokedAt: string | null; // exceptional cases only; requires admin + audit log
  revokedReason: string | null;
}
