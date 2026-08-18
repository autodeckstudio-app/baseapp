import type { ServiceCategory } from "./service.js";

// Structured pre-service/service inspection report (Phase 4). Deliberately
// scoped to AutoDeck's detailing/protection business — exterior/glass/
// interior condition plus service-specific checks (PPF/ceramic/wash) — never
// a general mechanical-repair inspection system.
export type InspectionStatus = "in_progress" | "finalized";

export type InspectionArea = "exterior" | "glass" | "interior" | "service_specific";

export type InspectionRating = "good" | "fair" | "poor" | "not_applicable";

export interface InspectionChecklistItem {
  key: string; // stable identifier, e.g. "paint_condition"
  label: string; // display label, snapshotted at start (never re-read from a template later)
  area: InspectionArea;
  rating: InspectionRating | null; // null until the studio records a finding
  notes: string | null;
}

// One inspection per job — id == jobId, same deterministic-idempotency
// pattern as Warranty (id == jobId).
export interface Inspection {
  id: string;
  tenantId: string;
  studioId: string;
  jobId: string;
  bookingId: string | null;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  serviceName: string; // snapshot
  serviceCategory: ServiceCategory; // snapshot — determined which template was used
  status: InspectionStatus;
  checklist: InspectionChecklistItem[];
  overallNotes: string | null;
  // Reserved for a future Storage-backed photo capability — always [] today.
  // No Firebase Storage/Blaze is enabled in this build; do not populate this
  // client-side or imply photo upload works anywhere in the UI.
  photos: string[];
  startedAt: string;
  startedBy: string; // studio/admin uid
  finalizedAt: string | null;
  finalizedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
