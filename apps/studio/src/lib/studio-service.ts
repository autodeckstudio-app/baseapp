import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth, db, functions } from "./firebase";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import type { Protection, ProtectionWorkEvent, ServiceJob, StudioConfig, Service, Booking } from "@autodeck/core";
import { dayRangeIST } from "./calendar-bookings";
import { mergeFloorJobs, OPEN_FLOOR_STATUSES } from "@autodeck/core";
import { MAX_SERVICE_SPAN_DAYS } from "@autodeck/core";

// Returns "YYYY-MM-DD" for N days after/before the given local date string.
// Mirrors functions/src/lib/schedule.ts's addDays (kept separate — this is
// client code, not a shared package).
function todayLocalIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type GetStudioJobsInput = { studioId: string; date?: string };
type GetStudioJobsOutput = { jobs: ServiceJob[]; date: string };

type AdvanceJobStatusInput = { jobId: string; notes?: string; rework?: boolean; protectionWork?: ProtectionWorkEvent[]; recordedWorkRevision?: number };
type AdvanceJobStatusOutput = { jobId: string; previousStatus: string; newStatus: string };

type CreateWalkinJobInput = {
  serviceId: string;
  vehicleId: string;
  vehicleCategory: string;
  bayId: string;
  customerId: string;
  studioId: string;
  notes?: string;
};
type CreateWalkinJobOutput = { job: ServiceJob };

type AssignBayInput = { jobId: string; bayId: string; reason?: string };
type AssignBayOutput = { jobId: string; previousBayId: string; newBayId: string };

export async function getStudioJobs(
  studioId: string,
  date?: string,
): Promise<GetStudioJobsOutput> {
  const fn = httpsCallable<GetStudioJobsInput, GetStudioJobsOutput>(
    functions,
    "getStudioJobs",
  );
  const input: GetStudioJobsInput = date !== undefined ? { studioId, date } : { studioId };
  const result = await fn(input);
  return result.data;
}

export async function advanceJobStatus(
  jobId: string,
  notes?: string,
  rework?: boolean,
  protectionWork?: ProtectionWorkEvent[],
  recordedWorkRevision?: number,
): Promise<AdvanceJobStatusOutput> {
  const fn = httpsCallable<AdvanceJobStatusInput, AdvanceJobStatusOutput>(
    functions,
    "advanceJobStatus",
  );
  const input: AdvanceJobStatusInput = notes !== undefined ? { jobId, notes } : { jobId };
  if (rework) input.rework = true;
  // The staff-declared protection-work declaration. Sent ONLY on the
  // READY_FOR_DELIVERY -> DELIVERED advance (the backend rejects it on any
  // other transition and requires it on that one).
  if (protectionWork !== undefined) input.protectionWork = protectionWork;
  if (recordedWorkRevision !== undefined) input.recordedWorkRevision = recordedWorkRevision;
  const result = await fn(input);
  return result.data;
}

/** Current-cycle protection records for one car, for the delivery
 * declaration panel. The tenantId equality filter is required: the
 * /vehicles/{id}/protections rule applies ownTenant(resource.data) to every
 * read, so Firestore must be able to verify it statically. Lifecycle is NOT
 * filtered in the query - legacy records predate the lifecycle field and are
 * current by default, so a where("lifecycle","==","current") would silently
 * hide them; the declaration builder treats a missing lifecycle as current. */
/** The verified operator fingerprint for a delivery declaration: the uid
 * PLUS the custom-claim scope (role/tenant/studio) read from the ID token
 * itself. A uid alone is not enough - the same account can be re-scoped
 * (new role, moved to another studio or tenant) while staying signed in,
 * and a declaration affirmed under the old scope must never ship under the
 * new one. Null means signed out. */
export type StaffAuth = {
  uid: string;
  role: string | null;
  tenantId: string | null;
  studioId: string | null;
};

async function staffAuthOf(u: User): Promise<StaffAuth> {
  const token = await u.getIdTokenResult();
  const c = token.claims as Record<string, unknown>;
  return {
    uid: u.uid,
    role: typeof c.role === "string" ? c.role : null,
    tenantId: typeof c.tenantId === "string" ? c.tenantId : null,
    studioId: typeof c.studioId === "string" ? c.studioId : null,
  };
}

/** The current operator fingerprint, or null when signed out. Resolves the
 * ID token, so the claims are the verified ones, not a cached profile. */
export function currentStaffAuth(): Promise<StaffAuth | null> {
  const u = auth.currentUser;
  return u ? staffAuthOf(u) : Promise.resolve(null);
}

/** Fires on sign-in, sign-out AND on every ID-token refresh - including a
 * refresh whose custom claims changed under the SAME uid (re-scoped role,
 * tenant or studio). Subscribers must treat any change as a new operator
 * context.
 * Sequenced: token resolution is async, so events are numbered and only the
 * LATEST event's resolution is delivered - a slow token fetch for an older
 * event can never publish after a newer sign-in/sign-out, and nothing is
 * delivered after unsubscribe. Every non-null token event FIRST delivers
 * `undefined` (verifying), synchronously, before its claims resolve - the
 * previously affirmed identity is not serviceable in that window. A
 * claims-read failure fails CLOSED (null: no affirmation context), never
 * silently keeps the previous identity. */
export function onStaffAuthChanged(cb: (a: StaffAuth | null | undefined) => void): Unsubscribe {
  let gen = 0;
  let active = true;
  const inner = onIdTokenChanged(auth, (u) => {
    const my = ++gen;
    if (!u) { if (active) cb(null); return; }
    // IMMEDIATE verifying: a prior affirmed identity is never serviceable
    // while the newer token's claims are still being read.
    if (active) cb(undefined);
    void staffAuthOf(u).then(
      (a) => { if (active && my === gen) cb(a); },
      () => { if (active && my === gen) cb(null); },
    );
  });
  return () => { active = false; inner(); };
}

/** Fingerprint of an operator scope for affirmation binding: uid + role +
 * tenant + studio. The same uid re-scoped to another role, tenant or studio
 * is a DIFFERENT fingerprint, so an affirmation armed under one scope can
 * never ride onto another. Absent or unverified identity is "none". */
export function staffAuthFingerprint(a: StaffAuth | null | undefined): string {
  return a ? `${a.uid}|${a.role ?? ""}|${a.tenantId ?? ""}|${a.studioId ?? ""}` : "none";
}

export async function getCurrentProtections(vehicleId: string, tenantId: string): Promise<Protection[]> {
  const q = query(
    collection(db, SUBCOLLECTIONS.vehicleProtections(vehicleId)),
    where("tenantId", "==", tenantId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Protection);
}

export async function cancelWalkinJob(jobId: string, reason: string): Promise<{ jobId: string; alreadyCancelled: boolean }> {
  const fn = httpsCallable<{ jobId: string; reason: string }, { jobId: string; alreadyCancelled: boolean }>(functions, "cancelWalkinJob");
  const result = await fn({ jobId, reason });
  return result.data;
}

export async function createWalkinJob(
  input: CreateWalkinJobInput,
): Promise<CreateWalkinJobOutput> {
  const fn = httpsCallable<CreateWalkinJobInput, CreateWalkinJobOutput>(
    functions,
    "createWalkinJob",
  );
  const result = await fn(input);
  return result.data;
}

export async function assignBay(input: AssignBayInput): Promise<AssignBayOutput> {
  const fn = httpsCallable<AssignBayInput, AssignBayOutput>(functions, "assignBay");
  const result = await fn(input);
  return result.data;
}

export async function getStudioConfig(studioId: string): Promise<StudioConfig | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.studioConfig(), studioId));
  if (!snap.exists()) return null;
  return snap.data() as StudioConfig;
}

// Filters by tenantId as well: the /jobs rule requires
// ownTenant(resource.data) unconditionally (regardless of role), so
// Firestore rejects the list query outright unless tenantId is also
// constrained by an equality filter it can verify statically — always the
// calling studio user's own claims.tenantId (never a hardcoded constant).
// Jobs visible "on" `date` are those SCHEDULED to start on or before it and
// still running through it (estimatedEndDate >= date) — a same-day exact
// match alone would silently drop an in-progress multi-day job (e.g. a PPF
// job that started Monday, still occupying a bay on Wednesday) from Today's
// Jobs / Calendar / Bay Board on any day after its start (Phase 5 —
// multi-day booking). The query is widened to a bounded range and filtered
// in-memory; reuses the existing (tenantId, studioId, scheduledDate,
// scheduledAt) composite index — a range filter on the last equality field
// needs no new index.
export function listenToJobsByDate(
  tenantId: string,
  studioId: string,
  date: string,
  onData: (jobs: ServiceJob[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const rangeStart = addDaysLocal(date, -MAX_SERVICE_SPAN_DAYS);
  const q = query(
    collection(db, COLLECTIONS.jobs()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("scheduledDate", ">=", rangeStart),
    where("scheduledDate", "<=", date),
  );
  const carry = date <= todayLocalIST();
  let windowJobs: ServiceJob[] = [];
  let openJobs: ServiceJob[] = [];
  let gotWindow = false;
  let gotOpen = !carry;
  const emit = () => { if (gotWindow && gotOpen) onData(mergeFloorJobs(windowJobs, openJobs, date, carry)); };
  const unsubWindow = onSnapshot(
    q,
    (snap) => { windowJobs = snap.docs.map((d) => d.data() as ServiceJob); gotWindow = true; emit(); },
    onError,
  );
  // Carry-over: every still-open job of this studio, whatever its scheduled date (Admin lists these).
  const unsubOpen = carry
    ? onSnapshot(
        query(
          collection(db, COLLECTIONS.jobs()),
          where("tenantId", "==", tenantId),
          where("studioId", "==", studioId),
          where("status", "in", [...OPEN_FLOOR_STATUSES]),
        ),
        (snap) => { openJobs = snap.docs.map((d) => d.data() as ServiceJob); gotOpen = true; emit(); },
        onError,
      )
    : () => undefined;
  return () => { unsubWindow(); unsubOpen(); };
}

export async function getServiceById(serviceId: string): Promise<Service | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.services(), serviceId));
  if (!snap.exists()) return null;
  return snap.data() as Service;
}

export type ReslotOption = { date: string; startTime: string; startAt: string; estimatedEndAt: string };
export async function getReslotOptions(job: ServiceJob): Promise<ReslotOption[]> {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const result = await httpsCallable<{ serviceId: string; studioId: string; startDate: string; lookAheadDays: number }, { slots: ReslotOption[] }>(functions, "getAvailability")({ serviceId: job.serviceId, studioId: job.studioId, startDate: date, lookAheadDays: 14 });
  return result.data.slots.filter(slot => Date.parse(slot.startAt) > Date.now());
}
export async function reslotBooking(bookingId: string, slot: ReslotOption): Promise<void> {
  await httpsCallable(functions, "rescheduleBooking")({ bookingId, newDate: slot.date, newTime: slot.startTime, idempotencyKey: `studio-${bookingId}-${slot.startAt}-${Date.now()}` });
}

export function listenToStandby(tenantId: string, studioId: string, onData: (jobs: ServiceJob[]) => void, onError: (err: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, COLLECTIONS.jobs()), where("tenantId", "==", tenantId), where("studioId", "==", studioId)), snap => onData(snap.docs.map(d => d.data() as ServiceJob).filter(j => j.status === "STANDBY").sort((a,b) => (a.standbyArrivedAt ?? a.createdAt).localeCompare(b.standbyArrivedAt ?? b.createdAt) || a.id.localeCompare(b.id))), onError);
}
export async function updateStandby(jobId: string, action: "enqueue" | "admit", bayId?: string): Promise<void> {
  await httpsCallable(functions, "standbyBooking")({ jobId, action, ...(bayId ? { bayId } : {}) });
}

/** Bookings for one studio day. Staff may read their tenant's bookings (firestore.rules /bookings) and the (tenantId, studioId, scheduledAt) index already exists, so this needs no rules or index change. */
export function listenToBookingsByDate(
  tenantId: string,
  studioId: string,
  date: string,
  onData: (bookings: Booking[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const { start, end } = dayRangeIST(date);
  const q = query(
    collection(db, COLLECTIONS.bookings()),
    where("tenantId", "==", tenantId),
    where("studioId", "==", studioId),
    where("scheduledAt", ">=", start),
    where("scheduledAt", "<=", end),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data() as Booking)), onError);
}

export async function releaseCompletedBay(jobId:string):Promise<{released:boolean;bayReleasedAt:string}> {
 const result=await httpsCallable<{jobId:string;confirmWorkCompleteAndBayEmpty:true},{released:boolean;bayReleasedAt:string}>(functions,'releaseCompletedBay')({jobId,confirmWorkCompleteAndBayEmpty:true});
 return result.data;
}
