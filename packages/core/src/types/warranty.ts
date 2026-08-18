export interface Warranty {
  id: string; // == jobId — one warranty per job; deterministic idempotency key
  tenantId: string;
  studioId: string;
  jobId: string; // originating job — the completed service that generated this warranty
  bookingId: string | null; // SNAPSHOT — originating booking, if any (null for walk-ins)
  customerId: string;
  vehicleId: string;
  serviceId: string; // reference only — never re-read for warranty terms (doc06 §6.4 Rule 3)
  serviceName: string; // SNAPSHOT — service catalogue name at seal time
  warrantyLabel: string; // SNAPSHOT — e.g. "5-Year PPF Film Warranty"
  coverageTerms: string; // SNAPSHOT — plain-text warranty terms, sealed at job completion
  startDate: string; // ISO date — job completion date
  // Phase 2D.1: computed once at issuance from Service.warrantyDurationValue
  // /warrantyDurationUnit (see warranty-builder.ts). null means the service
  // had no configured duration at seal time, OR unit was 'lifetime' — both
  // are legitimate, never guessed. Warranties issued before Phase 2D.1 keep
  // whatever endDate they were given (null, for all of them) — never
  // backfilled.
  endDate: string | null; // ISO date
  installerEmployeeId: string | null;
  productBatchNumber: string | null;
  certificateUrl: string | null; // Storage signed URL — V2+; null in this build (no PDF service)
  qrVerificationToken: string | null; // V2+
  sealedAt: string; // immutable — set when job transitions to DELIVERED
  revokedAt: string | null; // exceptional cases only; requires admin + audit log
  revokedReason: string | null;
}
