"use client";

import { goBackOrTo } from "../../../../lib/go-back";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Service, Customer, Vehicle, Booking, ServiceJob, Membership, Payment, Invoice, Warranty, Protection, Notification, AuditLog } from "@autodeck/core";
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
  listenToWarrantiesForVehicles,
  listenToProtectionsForVehicles,
} from "../../../../lib/customers-service";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../../lib/firebase";
import { getServicesIncludingHidden } from "../../../../lib/catalogue-service";
import { CustomerView, type ContactPatch, type VehiclePatch } from "../../../../experience/CustomerView";

export default function CustomerDetailPage(){
 const {id}=useParams<{id:string}>();const {user,claims,loading}=useAdminAuth();
 if(loading||!user||!claims)return <div className="ax-page" role="status">Checking customer access…</div>;
 return <CustomerDetailBody key={[id,user.uid,claims.tenantId,claims.role,claims.studioId??''].join('|')}/>;
}
function CustomerDetailBody() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useAdminAuth();
  const [loaded,setLoaded]=useState<Set<string>>(()=>new Set());
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
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void getServicesIncludingHidden().then(setServices).catch(() => setServices([])); }, []);

  useEffect(() => {
    if(!id||!claims)return;
    let alive=true;setLoaded(new Set());
    const read=<T,>(name:string,set:(value:T)=>void)=>(value:T)=>{if(alive){set(value);setLoaded(prior=>new Set([...prior,name]));}};
    const fail=(err:Error)=>{if(alive)setError(err.message)};
    const unsubs=[
      listenToCustomer(id,read('customer',setCustomer),fail),
      listenToCustomerVehicles(id,claims.tenantId,read('vehicles',setVehicles),fail),
      listenToCustomerBookings(id,claims.tenantId,read('bookings',setBookings),fail),
      listenToCustomerJobs(id,claims.tenantId,read('jobs',setJobs),fail),
      listenToCustomerMemberships(id,claims.tenantId,read('memberships',setMemberships),fail),
      listenToCustomerPayments(id,claims.tenantId,read('payments',setPayments),fail),
      listenToCustomerInvoices(id,claims.tenantId,read('invoices',setInvoices),fail),
      listenToCustomerNotifications(id,claims.tenantId,read('notifications',setNotifications),fail),
      listenToCustomerAudit(id,claims.tenantId,read('audit',setAudit),fail),
    ];
    return()=>{alive=false;unsubs.forEach(stop=>stop())};
  },[id,claims?.tenantId]);

  const vehicleKey = vehicles.map((v) => v.id).sort().join(",");
  useEffect(() => {
    if (!id || !claims) return undefined;
    const ids = vehicleKey ? vehicleKey.split(",") : [];
    const unsubs = [
      listenToWarrantiesForVehicles(ids, claims.tenantId, id, setWarranties, () => undefined),
      listenToProtectionsForVehicles(ids, setProtections, () => undefined),
    ];
    return () => unsubs.forEach((u) => u());
  }, [id, claims, vehicleKey]);

  if (error) return <div className="ax-panel ax-empty" role="alert"><p className="ax-title">Couldn&apos;t load this customer</p><p>{error}</p></div>;
  if(customer&&(customer.id!==id||customer.tenantId!==claims?.tenantId))return <div role="alert">Customer scope could not be verified.</div>;
  if(loaded.size<9)return <div className="ax-page" role="status">Loading customer records…</div>;
  if (customer === undefined) return <div className="ax-page"><div className="ax-skel" style={{ height: 140, marginBottom: 16 }} /><div className="ax-skel" style={{ height: 320 }} /></div>;
  if (customer === null) return <div className="ax-panel ax-empty"><p className="ax-title">Customer not found</p><p>They may have been merged or removed.</p></div>;

  return (
    <CustomerView
      d={{ customer, vehicles, bookings, jobs, memberships, payments, invoices, notifications, audit, warranties, protections }}
      services={services}
      onSave={async (patch: ContactPatch) => {
        await httpsCallable<{ customerId: string } & ContactPatch, { updated: boolean }>(functions, "updateCustomerContact")({ customerId: id, ...patch });
      }}
      onSaveVehicle={async (vehicleId: string, patch: VehiclePatch) => {
        await httpsCallable(functions, "updateVehicle")({ vehicleId, ...patch });
      }}
      onResolveDoc={async (doc) => {
        if (doc.kind === "rc") return (await httpsCallable<{ vehicleId: string; path: string; kind: "rc" }, { url: string }>(functions, "publishVehiclePhoto")({ vehicleId: doc.vehicleId, path: doc.path, kind: "rc" })).data.url;
        return (await httpsCallable<{ customerId: string; path: string }, { url: string }>(functions, "publishLicensePhoto")({ customerId: id, path: doc.path })).data.url;
      }}
      onBack={() => goBackOrTo(router, "/customers")}
      onOpen={(href) => router.push(href)}
    />
  );
}
