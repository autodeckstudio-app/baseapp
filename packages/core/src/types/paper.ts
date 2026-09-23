export type PaperKind = "RC" | "INSURANCE" | "PUC" | "FASTAG" | "OTHER";
export type PaperStatus = "PENDING" | "VERIFIED" | "REJECTED";

/**
 * One customer vehicle document submitted for office verification (the legacy
 * "declarations" flow). Staff register the paper from the physical document,
 * then verify or reject it. Expiry is derived from expiresOn at read time —
 * no scheduler rewrites status.
 */
export interface PaperVerification {
  id: string;
  tenantId: string;
  studioId: string;
  vehicleId: string;
  customerId: string; // owner auth uid, denormalized for rules and customer reads
  kind: PaperKind;
  reference: string; // document / policy / certificate number
  issuedOn: string | null; // YYYY-MM-DD
  expiresOn: string | null; // YYYY-MM-DD
  evidenceUrl: string | null; // photo of the document, if captured
  status: PaperStatus;
  reviewedBy: string | null; // auth uid
  reviewedAt: string | null; // ISO
  rejectionReason: string | null;
  notes: string | null;
  createdBy: string; // auth uid of the staff member who registered it
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
