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
  // Phase 2D decision: nullable. doc06's structured warrantyTemplate
  // ({period, unit, description}) was never implemented — the actual Service
  // catalogue only carries a free-text `warrantyLabel` with no machine-
  // readable duration, so a numeric expiry cannot be honestly computed.
  // null here means "see warrantyLabel/coverageTerms for the stated term" —
  // not an invented computation. Revisit once Service gains a structured
  // duration field.
  endDate: string | null; // ISO date
  installerEmployeeId: string | null;
  productBatchNumber: string | null;
  certificateUrl: string | null; // Storage signed URL — V2+; null in this build (no PDF service)
  qrVerificationToken: string | null; // V2+
  sealedAt: string; // immutable — set when job transitions to DELIVERED
  revokedAt: string | null; // exceptional cases only; requires admin + audit log
  revokedReason: string | null;
}
