// Live inputs for the customer Home, ranked by the pure projectCustomerHome.
// Every listener is scoped to the signed-in customer; the rules enforce it.
import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  projectCustomerHome,
  type ApprovalRequest,
  type Booking,
  type CustomerHomeModel,
  type Invoice,
  type Membership,
  type Protection,
  type ServiceJob,
  type Vehicle,
} from "@autodeck/core";
import { listenToMyVehicles } from "../lib/vehicle-service";
import { getMyBookings } from "../lib/booking-service";
import { listenToVehicleProtections } from "../lib/protection-service";
import {
  listenToMyIssuedInvoices,
  listenToMyJobs,
  listenToMyMemberships,
  listenToMyPendingApprovals,
} from "../lib/home-service";

const ACTIVE_KEY = "autodeck.activeVehicle";

export async function setActiveVehicle(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

export interface CustomerHomeState {
  model: CustomerHomeModel | null;
  error: string | null;
  refresh: () => void;
}

export function useCustomerHome(uid: string | null, tenantId: string | null, firstName?: string | null): CustomerHomeState {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [protections, setProtections] = useState<Protection[]>([]);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void AsyncStorage.getItem(ACTIVE_KEY).then(setPreferred);
  }, [tick]);

  useEffect(() => {
    if (!uid || !tenantId) return;
    const fail = () => setError("We couldn't reach AutoDeck. Showing what we have.");
    const subs = [
      listenToMyVehicles(uid, tenantId, setVehicles, fail),
      listenToMyJobs(tenantId, uid, setJobs, fail),
      listenToMyPendingApprovals(tenantId, uid, setApprovals, fail),
      listenToMyIssuedInvoices(tenantId, uid, setInvoices, fail),
      listenToMyMemberships(tenantId, uid, setMemberships, () => undefined),
    ];
    getMyBookings(uid, tenantId).then(setBookings).catch(fail);
    return () => subs.forEach((u) => u());
  }, [uid, tenantId, tick]);

  const model = useMemo(
    () =>
      vehicles === null
        ? null
        : projectCustomerHome({
            firstName: firstName ?? null,
            vehicles,
            preferredVehicleId: preferred,
            bookings,
            jobs,
            approvals,
            invoices,
            protections,
            memberships,
            now: new Date(),
          }),
    [vehicles, preferred, bookings, jobs, approvals, invoices, protections, memberships, firstName],
  );

  const activeId = model?.activeVehicle?.id ?? null;
  useEffect(() => {
    if (!uid || !tenantId || !activeId) return;
    return listenToVehicleProtections(activeId, tenantId, uid, setProtections, () => setProtections([]));
  }, [uid, tenantId, activeId]);

  return { model, error, refresh: () => setTick((t) => t + 1) };
}
