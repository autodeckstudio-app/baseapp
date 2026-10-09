import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

// Invoices must show the service's human-readable display name, never the raw
// catalogue id. Resolved from the live catalogue at payment time (the invoice
// line item then snapshots it). Falls back to the legacy "Service <id>" label
// only when the catalogue entry is genuinely unreadable (deleted service or a
// tenant mismatch), so a billed service is never silently omitted and its name
// is never fabricated.
export async function resolveServiceName(
  db: Firestore,
  tx: Transaction,
  tenantId: string,
  serviceId: string,
): Promise<string> {
  const snap = await tx.get(db.collection(COLLECTIONS.services()).doc(serviceId));
  if (snap.exists) {
    const service = snap.data() as Service;
    if (service.tenantId === tenantId && typeof service.name === "string" && service.name.trim()) {
      return service.name.trim();
    }
  }
  return `Service ${serviceId}`;
}
