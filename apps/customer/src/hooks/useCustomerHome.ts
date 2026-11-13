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
import { clearWatchdogErrorOnDelivery, HOME_WATCHDOG_MSG } from "../lib/home-watchdog";
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
    let active=true;setPreferred(null);void AsyncStorage.getItem(ACTIVE_KEY).then(v=>{if(active)setPreferred(v)}).catch(()=>undefined);return()=>{active=false};
  }, [uid,tenantId,tick]);

  // Watchdog: if no listener has delivered within 8s (e.g. the watch stream
  // never establishes on a flaky network), stop waiting and render with the
  // error caption instead of spinning forever.
  useEffect(() => {
    if (!uid || !tenantId) return;
    delivered.current = false;
    setCoreReady(false);
    const t = setTimeout(() => {
      if (delivered.current) return;
      setError((e) => e ?? HOME_WATCHDOG_MSG);
      setVehicles((v) => v ?? []);
      setCoreReady(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [uid, tenantId, tick]);

  // Claim-pending session: signed in with claims but no customer doc yet
  // (staff-first record not claimed). There is nothing to listen to, so
  // resolve the designed empty model immediately - without this, vehicles
  // stays null, coreReady stays false, and Home hangs on the skeleton
  // forever (the 8s watchdog below also arms only when uid exists).
  useEffect(() => {
    if (uid || !tenantId) return;
    setVehicles([]);
    setCoreReady(true);
  }, [uid, tenantId]);

  useEffect(() => {
    setVehicles(null);setBookings([]);setJobs([]);setApprovals([]);setInvoices([]);setMemberships([]);setProtections([]);setError(null);if (!uid || !tenantId){if(tenantId){setVehicles([]);setCoreReady(true)}return;}
    const settled = new Set<string>();
    let active = true;
    const settle = (source: string) => {
      if (!active) return;
      settled.add(source);
      if (settled.size === 6) { delivered.current = true; setCoreReady(true); setError(clearWatchdogErrorOnDelivery); }
    };
    const failFor = (src: string) => (e?: unknown) => {
    if(!active)return;
    // eslint-disable-next-line no-console
    console.warn("[home] listener failed:", src, e);
    settle(src);
    const code = (e as { code?: string } | undefined)?.code;
    setError("Some of your home details could not load. Try refreshing.");
    // Never leave vehicles null on a listener error: a null model keeps the
    // Home on the loading spinner forever. Empty data + the error caption is
    // always better than a silent hang.
    setVehicles((v) => v ?? []);
  };
    const subs = [
      listenToMyVehicles(uid, tenantId, (v) => { if(!active)return;setVehicles(v); settle("cars"); }, failFor("cars")),
      listenToMyJobs(tenantId, uid, (v) => { if(!active)return;setJobs(v); settle("visits"); }, failFor("visits")),
      listenToMyPendingApprovals(tenantId, uid, (v) => { if(!active)return;setApprovals(v); settle("approvals"); }, failFor("approvals")),
      listenToMyIssuedInvoices(tenantId, uid, (v) => { if(!active)return;setInvoices(v); settle("bills"); }, failFor("bills")),
      listenToMyMemberships(tenantId, uid, (v) => { if(!active)return;setMemberships(v); settle("memberships"); }, failFor("memberships")),
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
            invoices,
            protections,
            memberships,
            now: new Date(),
          }),
    [vehicles, coreReady, preferred, bookings, jobs, approvals, invoices, protections, memberships, firstName],
  );

  const activeId = model?.activeVehicle?.id ?? null;
  useEffect(() => {
    setProtections([]);if (!uid || !tenantId || !activeId) return;let alive=true;
    const stop=listenToVehicleProtections(activeId, tenantId, uid, v=>{if(alive)setProtections(v)}, () => {if(alive)setProtections([])});return()=>{alive=false;stop()};
  }, [uid, tenantId, activeId]);

  return { model, error, refresh: () => setTick((t) => t + 1) };
}
