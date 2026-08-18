import { collection, query, where, orderBy, limit, getDocs, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Customer, Vehicle, ServiceJob } from "@autodeck/core";

const NAME_SEARCH_LIMIT = 200;

// Bounded tenant-wide fetch + client-side substring filter — same approach
// as the admin app's customer list (Phase 3E). Firestore has no native
// case-insensitive "contains" query; at V1 tenant scale a bounded fetch is
// simpler and safer than standing up a search index for this.
export async function searchCustomersByName(tenantId: string, nameQuery: string): Promise<Customer[]> {
  const q = query(collection(db, COLLECTIONS.customers()), where("tenantId", "==", tenantId), limit(NAME_SEARCH_LIMIT));
  const snap = await getDocs(q);
  const needle = nameQuery.trim().toLowerCase();
  return snap.docs
    .map((d) => d.data() as Customer)
    .filter((c) => c.name.toLowerCase().includes(needle));
}

// Reuses the existing tenantId+registrationNumber index (see
// apps/admin/src/lib/protection-service.ts's findVehicleByRegistration —
// same query shape, studio-side copy since apps cannot share RN/web lib code).
export async function findVehicleByRegistration(tenantId: string, registrationNumber: string): Promise<Vehicle | null> {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("tenantId", "==", tenantId),
    where("registrationNumber", "==", registrationNumber.toUpperCase()),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  return first ? (first.data() as Vehicle) : null;
}

// Job history scoped to tenant + THIS studio — "relevant to studio", not
// every studio in the tenant (V1 has one studio, but the query is scoped
// correctly for when that's no longer true).
export function listenToJobsForCustomerAtStudio(
  tenantId: string,
  studioId: string,
  customerId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ServiceJob)), onError);
}

export function listenToJobsForVehicleAtStudio(
  tenantId: string,
  studioId: string,
  vehicleId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("vehicleId", "==", vehicleId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ServiceJob)), onError);
}
