"use client";

import { collection, query, where, orderBy, limit, doc, getDocs, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import type {
  Customer,
  Vehicle,
  Booking,
  ServiceJob,
  Membership,
  Payment,
  Invoice,
  Warranty,
  Protection,
  Notification,
  AuditLog,
} from "@autodeck/core";
import { getEffectiveMembershipStatus } from "@autodeck/core";

const LIST_LIMIT = 300;

/** Live, tenant-wide customer feed. Phone/name/registration-number search is
 * applied client-side (registration-number search cross-references vehicles -
 * see searchVehicleOwner below). */
export function listenToCustomers(
  tenantId: string,
  onData: (customers: Customer[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.customers()), where("tenantId", "==", tenantId), limit(LIST_LIMIT));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Customer)), onError);
}

// Registration-number search resolves to an owning customerId, reusing the
// existing tenantId+registrationNumber index (see protection-service.ts).
export async function findCustomerIdByRegistration(tenantId: string, registrationNumber: string): Promise<string | null> {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("tenantId", "==", tenantId),
    where("registrationNumber", "==", registrationNumber.toUpperCase()),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  return first ? (first.data() as Vehicle).ownerId : null;
}

export function listenToCustomer(
  customerId: string,
  onData: (customer: Customer | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.customers(), customerId),
    (snap) => onData(snap.exists() ? (snap.data() as Customer) : null),
    onError,
  );
}

export function listenToCustomerVehicles(
  customerId: string,
  tenantId: string,
  onData: (vehicles: Vehicle[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("ownerId", "==", customerId),
    where("tenantId", "==", tenantId),
    where("deletedAt", "==", null),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Vehicle)), onError);
}

export function listenToCustomerBookings(
  customerId: string,
  tenantId: string,
  onData: (bookings: Booking[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.bookings()),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("scheduledAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Booking)), onError);
}

export function listenToCustomerJobs(
  customerId: string,
  tenantId: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ServiceJob)), onError);
}

export function listenToCustomerMemberships(
  customerId: string,
  tenantId: string,
  onData: (memberships: Membership[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.memberships()),
    where("tenantId", "==", tenantId),
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
  );
  // Display-only correction (Phase 3H): a daily scheduler now keeps stored
  // status reasonably fresh too (see expireStaleMembershipsScheduled.ts),
  // but effective status is still derived here rather than trusted as-is -
  // correct even within the sweep's up-to-24h staleness window.
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const membership = d.data() as Membership;
          return { ...membership, status: getEffectiveMembershipStatus(membership) };
        }),
      ),
    onError,
  );
}

export function listenToCustomerPayments(
  customerId: string,
  tenantId: string,
  onData: (payments: Payment[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.payments()),
    where("customerId", "==", customerId),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Payment)), onError);
}

export function listenToCustomerInvoices(
  customerId: string,
  tenantId: string,
  onData: (invoices: Invoice[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.invoices()),
    where("customerId", "==", customerId),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Invoice)), onError);
}

export function listenToCustomerNotifications(
  customerId: string,
  tenantId: string,
  onData: (notifications: Notification[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.notifications()),
    where("tenantId", "==", tenantId),
    where("userId", "==", customerId),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Notification)), onError);
}

// Customer-entity audit trail only (customer.created / customer.profile_updated).
// Booking/job/payment audit history is visible from those entities' own detail
// pages - aggregating everything here would need one query per related
// entity, which does not scale with a customer's history size.
export function listenToCustomerAudit(
  customerId: string,
  tenantId: string,
  onData: (entries: AuditLog[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.auditLog()),
    where("tenantId", "==", tenantId),
    where("entityType", "==", "Customer"),
    where("entityId", "==", customerId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as AuditLog)), onError);
}

// One-shot: warranties + protections are per-vehicle subcollections/queries;
// fetched once per vehicle set rather than kept live (low change frequency,
// avoids one listener per vehicle for what is a secondary panel).
export async function getWarrantiesForVehicles(vehicleIds: string[], tenantId: string, customerId: string): Promise<Warranty[]> {
  if (vehicleIds.length === 0) return [];
  const results = await Promise.all(
    vehicleIds.map((vehicleId) =>
      getDocs(
        query(
          collection(db, COLLECTIONS.warranties()),
          where("vehicleId", "==", vehicleId),
          where("tenantId", "==", tenantId),
          where("customerId", "==", customerId),
          orderBy("sealedAt", "desc"),
        ),
      ),
    ),
  );
  return results.flatMap((snap) => snap.docs.map((d) => d.data() as Warranty));
}

export async function getProtectionsForVehicles(vehicleIds: string[]): Promise<Array<Protection & { vehicleId: string }>> {
  if (vehicleIds.length === 0) return [];
  const results = await Promise.all(
    vehicleIds.map(async (vehicleId) => {
      const snap = await getDocs(collection(db, SUBCOLLECTIONS.vehicleProtections(vehicleId)));
      return snap.docs.map((d) => ({ ...(d.data() as Protection), vehicleId }));
    }),
  );
  return results.flat();
}

// Live versions of the two per-vehicle panels: one listener per car, merged,
// so a new warranty or paper shows up without reloading the page.
export function listenToWarrantiesForVehicles(
  vehicleIds: string[],
  tenantId: string,
  customerId: string,
  onData: (warranties: Warranty[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const parts = new Map<string, Warranty[]>();
  const emit = () => onData([...parts.values()].flat());
  const unsubs = vehicleIds.map((vehicleId) =>
    onSnapshot(
      query(
        collection(db, COLLECTIONS.warranties()),
        where("vehicleId", "==", vehicleId),
        where("tenantId", "==", tenantId),
        where("customerId", "==", customerId),
      ),
      (snap) => {
        parts.set(vehicleId, snap.docs.map((d) => d.data() as Warranty));
        emit();
      },
      onError,
    ),
  );
  if (vehicleIds.length === 0) onData([]);
  return () => unsubs.forEach((u) => u());
}

export function listenToProtectionsForVehicles(
  vehicleIds: string[],
  onData: (protections: Array<Protection & { vehicleId: string }>) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const parts = new Map<string, Array<Protection & { vehicleId: string }>>();
  const emit = () => onData([...parts.values()].flat());
  const unsubs = vehicleIds.map((vehicleId) =>
    onSnapshot(
      collection(db, SUBCOLLECTIONS.vehicleProtections(vehicleId)),
      (snap) => {
        parts.set(vehicleId, snap.docs.map((d) => ({ ...(d.data() as Protection), vehicleId })));
        emit();
      },
      onError,
    ),
  );
  if (vehicleIds.length === 0) onData([]);
  return () => unsubs.forEach((u) => u());
}

/** Live feed of every car on file (not deleted) for the studio. */
export function listenToTenantVehicles(tenantId: string, onData: (v: Vehicle[]) => void, onError: (e: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.vehicles()), where("tenantId", "==", tenantId), where("deletedAt", "==", null));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Vehicle)), onError);
}
