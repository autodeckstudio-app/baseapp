"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Customer, Vehicle, Booking, ServiceJob, Membership, Payment, Invoice, Warranty, Protection, Notification, AuditLog } from "@autodeck/core";
import { useAdminAuth } from "../../../../lib/auth-context";
import {
  listenToCustomer,
  listenToCustomerVehicles,
  listenToCustomerBookings,
  listenToCustomerJobs,
  listenToCustomerMemberships,
  listenToCustomerPayments,
  listenToCustomerInvoices,
  listenToCustomerNotifications,
  listenToCustomerAudit,
  getWarrantiesForVehicles,
  getProtectionsForVehicles,
} from "../../../../lib/customers-service";
import { CustomerView } from "../../../../experience/CustomerView";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [protections, setProtections] = useState<Array<Protection & { vehicleId: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return listenToCustomer(id, setCustomer, (err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!id || !claims) return undefined;
    const unsubs = [
      listenToCustomerVehicles(id, claims.tenantId, setVehicles, (err) => setError(err.message)),
      listenToCustomerBookings(id, claims.tenantId, setBookings, (err) => setError(err.message)),
      listenToCustomerJobs(id, claims.tenantId, setJobs, (err) => setError(err.message)),
      listenToCustomerMemberships(id, claims.tenantId, setMemberships, (err) => setError(err.message)),
      listenToCustomerPayments(id, claims.tenantId, setPayments, (err) => setError(err.message)),
      listenToCustomerInvoices(id, claims.tenantId, setInvoices, (err) => setError(err.message)),
      listenToCustomerNotifications(id, claims.tenantId, setNotifications, (err) => setError(err.message)),
      listenToCustomerAudit(id, claims.tenantId, setAudit, (err) => setError(err.message)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [id, claims]);

  useEffect(() => {
    if (!id || !claims || vehicles.length === 0) return;
    const vehicleIds = vehicles.map((v) => v.id);
    void getWarrantiesForVehicles(vehicleIds, claims.tenantId, id).then(setWarranties);
    void getProtectionsForVehicles(vehicleIds).then(setProtections);
  }, [id, claims, vehicles]);

  if (error) return <div className="ad-panel ad-empty" role="alert"><p className="ad-title">Couldn&apos;t load this customer</p><p>{error}</p></div>;
  if (customer === undefined) return <div className="ad-page"><div className="ad-skel" style={{ height: 140, marginBottom: 16 }} /><div className="ad-skel" style={{ height: 320 }} /></div>;
  if (customer === null) return <div className="ad-panel ad-empty"><p className="ad-title">Customer not found</p><p>They may have been merged or removed.</p></div>;

  return (
    <CustomerView
      d={{ customer, vehicles, bookings, jobs, memberships, payments, invoices, notifications, audit, warranties, protections }}
      onBack={() => router.push("/customers")}
      onOpen={(href) => router.push(href)}
    />
  );
}
