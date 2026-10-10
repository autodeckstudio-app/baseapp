// Live inputs for the customer Home, ranked by the pure projectCustomerHome.
// Every listener is scoped to the signed-in customer; the rules enforce it.
import { useEffect, useMemo, useRef, useState } from "react";
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
  const delivered = useRef(false);
  const [coreReady, setCoreReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(ACTIVE_KEY).then(setPreferred);
  }, [tick]);

  // Watchdog: if no listener has delivered within 8s (e.g. the watch stream
  // never establishes on a flaky network), stop waiting and render with the
  // error caption instead of spinning forever.
  useEffect(() => {
    if (!uid || !tenantId) return;
    delivered.current = false;
    setCoreReady(false);
    const t = setTimeout(() => {
      if (delivered.current) return;
      setError((e) => e ?? "This is taking longer than usual. Check your connection and refresh.");
      setVehicles((v) => v ?? []);
      setCoreReady(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [uid, tenantId, tick]);

  useEffect(() => {
    if (!uid || !tenantId) return;
    setError(null);
    const settled = new Set<string>();
    let active = true;
    const settle = (source: string) => {
      if (!active) return;
      settled.add(source);
      if (settled.size === 6) { delivered.current = true; setCoreReady(true); }
    };
    const failFor = (src: string) => (e?: unknown) => {
    // eslint-disable-next-line no-console
    console.warn("[home] listener failed:", src, e);
    settle(src);
    const code = (e as { code?: string } | undefined)?.code;
    setError(`We couldn't load everything (${src}${code ? `: ${code}` : ""}). Showing what we have.`);
    // Never leave vehicles null on a listener error: a null model keeps the
    // Home on the loading spinner forever. Empty data + the error caption is
    // always better than a silent hang.
    setVehicles((v) => v ?? []);
  };
    const subs = [
      listenToMyVehicles(uid, tenantId, (v) => { setVehicles(v); settle("cars"); }, failFor("cars")),
      listenToMyJobs(tenantId, uid, (v) => { setJobs(v); settle("visits"); }, failFor("visits")),
      listenToMyPendingApprovals(tenantId, uid, (v) => { setApprovals(v); settle("approvals"); }, failFor("approvals")),
      listenToMyIssuedInvoices(tenantId, uid, (v) => { setInvoices(v); settle("bills"); }, failFor("bills")),
      listenToMyMemberships(tenantId, uid, (v) => { setMemberships(v); settle("memberships"); }, failFor("memberships")),
    ];
    getMyBookings(uid, tenantId).then((v) => { if (active) { setBookings(v); settle("bookings"); } }).catch(failFor("bookings"));
    return () => { active = false; subs.forEach((u) => u()); };
  }, [uid, tenantId, tick]);

  const model = useMemo(
    () =>
      vehicles === null || !coreReady
        ? null
        : projectCustomerHome({
            firstName: firstName ?? null,
            vehicles,
            preferredVehicleId: preferred,
            bookings,
            jobs,
            approvals,
            invoices: [], // bills live in service history, never on Home
            protections,
            memberships,
            now: new Date(),
          }),
    [vehicles, coreReady, preferred, bookings, jobs, approvals, protections, memberships, firstName],
  );

  const activeId = model?.activeVehicle?.id ?? null;
  useEffect(() => {
    if (!uid || !tenantId || !activeId) return;
    return listenToVehicleProtections(activeId, tenantId, uid, setProtections, () => setProtections([]));
  }, [uid, tenantId, activeId]);

  return { model, error, refresh: () => setTick((t) => t + 1) };
}
