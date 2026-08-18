"use client";

import { collection, query, where, orderBy, limit, doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Booking, ServiceJob, Payment, Invoice, ApprovalRequest, Customer, Vehicle, Service } from "@autodeck/core";

const LIST_LIMIT = 300;

/** Live, tenant-wide booking feed — newest scheduled slot first. Filters beyond
 * tenantId (status/service/studio/customer/vehicle search) are applied client-side
 * to avoid a combinatorial explosion of composite indexes for a bounded admin list. */
export function listenToBookings(
  tenantId: string,
  onData: (bookings: Booking[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.bookings()),
    where("tenantId", "==", tenantId),
    orderBy("scheduledAt", "desc"),
    limit(LIST_LIMIT),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Booking)), onError);
}

export function listenToBooking(
  bookingId: string,
  onData: (booking: Booking | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.bookings(), bookingId),
    (snap) => onData(snap.exists() ? (snap.data() as Booking) : null),
    onError,
  );
}

export function listenToJobForBooking(
  bookingId: string,
  tenantId: string,
  onData: (job: ServiceJob | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("bookingId", "==", bookingId),
    where("tenantId", "==", tenantId),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as ServiceJob | undefined) ?? null),
    onError,
  );
}

export function listenToApprovalsForJob(
  jobId: string,
  tenantId: string,
  onData: (approvals: ApprovalRequest[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.approvals()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as ApprovalRequest)), onError);
}

export function listenToPaymentForJob(
  jobId: string,
  tenantId: string,
  onData: (payment: Payment | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.payments()),
    where("jobId", "==", jobId),
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Payment | undefined) ?? null),
    onError,
  );
}

export function listenToInvoiceForJob(
  jobId: string,
  tenantId: string,
  onData: (invoice: Invoice | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, COLLECTIONS.invoices()), where("jobId", "==", jobId), where("tenantId", "==", tenantId));
  return onSnapshot(
    q,
    (snap) => onData(snap.empty ? null : (snap.docs.at(0)?.data() as Invoice | undefined) ?? null),
    onError,
  );
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.customers(), customerId));
  return snap.exists() ? (snap.data() as Customer) : null;
}

export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.vehicles(), vehicleId));
  return snap.exists() ? (snap.data() as Vehicle) : null;
}

export async function getService(serviceId: string): Promise<Service | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.services(), serviceId));
  return snap.exists() ? (snap.data() as Service) : null;
}
