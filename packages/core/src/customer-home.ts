// Pure projection for the customer Home (spec §6.2). Takes records the
// customer is already authorized to read and decides what Home leads with.
// It never invents lifecycle state: every hero state traces to a record.
//
// Priority (deterministic): approval waiting > payment due > in service >
// ready for pickup > upcoming booking > protection attention > idle/empty.
import type { Booking } from "./types/booking.js";
import type { Vehicle } from "./types/customer.js";
import type { ApprovalRequest, ServiceJob } from "./types/job.js";
import type { Invoice } from "./types/payment.js";
import type { Protection } from "./types/protection.js";
import type { Membership } from "./types/membership.js";

export type CustomerHeroState =
  | "empty"
  | "idle"
  | "booked"
  | "inService"
  | "awaitingApproval"
  | "paymentDue"
  | "ready";

export type CustomerActionKind =
  | "addVehicle"
  | "book"
  | "viewBooking"
  | "followVisit"
  | "reviewApproval"
  | "payInvoice"
  | "reviewProtection";

export interface CustomerAction {
  kind: CustomerActionKind;
  label: string;
  /** Record the action opens, when it opens one. */
  targetId?: string;
}

export interface ProtectionAttention {
  id: string;
  kind: Protection["kind"];
  expiryDate: string | null;
  /** Whole days until expiry; negative once expired. */
  daysLeft: number | null;
  attention: "expired" | "soon" | "ok" | "unknown";
}

export interface CustomerHomeInput {
  firstName?: string | null;
  vehicles: Vehicle[];
  /** Persisted preference; ignored when it no longer names an owned car. */
  preferredVehicleId?: string | null;
  bookings: Booking[];
  jobs: ServiceJob[];
  approvals: ApprovalRequest[];
  invoices: Invoice[];
  protections: Protection[];
  memberships: Membership[];
  now: Date;
}

export interface CustomerHomeModel {
  customer: { firstName?: string };
  activeVehicle?: Vehicle | undefined;
  otherVehicles: Vehicle[];
  heroState: CustomerHeroState;
  primaryAction: CustomerAction;
  upcomingBooking?: Booking | undefined;
  liveJob?: ServiceJob | undefined;
  pendingApproval?: ApprovalRequest | undefined;
  dueInvoice?: Invoice | undefined;
  protections: ProtectionAttention[];
  membership?: Membership | undefined;
  recentHistory: ServiceJob[];
  lastUpdatedAt: Date;
}

const LIVE_JOB: ReadonlySet<ServiceJob["status"]> = new Set([
  "VEHICLE_RECEIVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
]);
const UPCOMING_BOOKING: ReadonlySet<Booking["status"]> = new Set(["PENDING", "CONFIRMED"]);
const SOON_DAYS = 30;
const DAY_MS = 86_400_000;

/** Trimmed first word of a display name; undefined rather than "undefined". */
export function sanitizeFirstName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const first = name.trim().split(/\s+/)[0] ?? "";
  const clean = first.replace(/[^\p{L}\p{M}'-]/gu, "").slice(0, 24);
  return clean.length > 0 ? clean : undefined;
}

/** Local-device greeting only; never affects business state. */
export function greetingFor(now: Date, firstName?: string): string {
  const h = now.getHours();
  const part = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return firstName ? `${part}, ${firstName}` : part;
}

function lastActivity(v: Vehicle, bookings: Booking[], jobs: ServiceJob[]): string {
  let latest = v.updatedAt;
  for (const b of bookings) if (b.vehicleId === v.id && b.scheduledAt > latest) latest = b.scheduledAt;
  for (const j of jobs) if (j.vehicleId === v.id && j.scheduledAt > latest) latest = j.scheduledAt;
  return latest;
}

export function pickActiveVehicle(
  vehicles: Vehicle[],
  preferredId: string | null | undefined,
  bookings: Booking[],
  jobs: ServiceJob[],
): Vehicle | undefined {
  const owned = vehicles.filter((v) => v.deletedAt === null);
  if (owned.length === 0) return undefined;
  const preferred = preferredId ? owned.find((v) => v.id === preferredId) : undefined;
  if (preferred) return preferred;
  return [...owned].sort((a, b) => {
    const d = lastActivity(b, bookings, jobs).localeCompare(lastActivity(a, bookings, jobs));
    return d !== 0 ? d : a.id.localeCompare(b.id);
  })[0];
}

export function protectionAttention(p: Protection, now: Date): ProtectionAttention {
  if (!p.expiryDate) return { id: p.id, kind: p.kind, expiryDate: null, daysLeft: null, attention: "unknown" };
  const end = Date.parse(`${p.expiryDate.slice(0, 10)}T23:59:59`);
  const daysLeft = Math.floor((end - now.getTime()) / DAY_MS);
  const attention = p.status === "expired" || daysLeft < 0 ? "expired" : daysLeft <= SOON_DAYS ? "soon" : "ok";
  return { id: p.id, kind: p.kind, expiryDate: p.expiryDate, daysLeft, attention };
}

export function projectCustomerHome(input: CustomerHomeInput): CustomerHomeModel {
  const { now } = input;
  const firstName = sanitizeFirstName(input.firstName);
  const owned = input.vehicles.filter((v) => v.deletedAt === null);
  const active = pickActiveVehicle(owned, input.preferredVehicleId, input.bookings, input.jobs);
  const base = {
    customer: firstName ? { firstName } : {},
    lastUpdatedAt: now,
  };

  const membership = input.memberships
    .filter((m) => m.status === "active")
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0];

  if (!active) {
    return {
      ...base,
      otherVehicles: [],
      heroState: "empty",
      primaryAction: { kind: "addVehicle", label: "Add your car" },
      protections: [],
      membership,
      recentHistory: [],
    };
  }

  const mine = <T extends { vehicleId: string }>(xs: T[]) => xs.filter((x) => x.vehicleId === active.id);
  const nowIso = now.toISOString();

  const pendingApproval = mine(input.approvals)
    .filter((a) => a.status === "pending" && a.expiresAt > nowIso)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
  const dueInvoice = mine(input.invoices)
    .filter((i) => i.status === "issued")
    .sort((a, b) => (a.issuedAt ?? a.createdAt).localeCompare(b.issuedAt ?? b.createdAt))[0];
  const jobs = mine(input.jobs);
  const liveJob = jobs
    .filter((j) => LIVE_JOB.has(j.status))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];
  const readyJob = jobs
    .filter((j) => j.status === "READY_FOR_DELIVERY")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];
  const upcomingBooking = mine(input.bookings)
    .filter((b) => UPCOMING_BOOKING.has(b.status) && b.scheduledAt >= nowIso)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const protections = mine(input.protections)
    .map((p) => protectionAttention(p, now))
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
  const needsProtection = protections.find((p) => p.attention === "expired" || p.attention === "soon");
  const recentHistory = jobs
    .filter((j) => j.status === "DELIVERED")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, 5);

  let heroState: CustomerHeroState;
  let primaryAction: CustomerAction;
  if (pendingApproval) {
    heroState = "awaitingApproval";
    primaryAction = { kind: "reviewApproval", label: "Review extra work", targetId: pendingApproval.id };
  } else if (dueInvoice) {
    heroState = "paymentDue";
    primaryAction = { kind: "payInvoice", label: "View bill", targetId: dueInvoice.id };
  } else if (liveJob) {
    heroState = "inService";
    primaryAction = { kind: "followVisit", label: "Follow the visit", targetId: liveJob.bookingId ?? liveJob.id };
  } else if (readyJob) {
    heroState = "ready";
    primaryAction = { kind: "followVisit", label: "Ready for pickup", targetId: readyJob.bookingId ?? readyJob.id };
  } else if (upcomingBooking) {
    heroState = "booked";
    primaryAction = { kind: "viewBooking", label: "View booking", targetId: upcomingBooking.id };
  } else if (needsProtection) {
    heroState = "idle";
    primaryAction = { kind: "reviewProtection", label: "Check papers", targetId: needsProtection.id };
  } else {
    heroState = "idle";
    primaryAction = { kind: "book", label: "Book a service" };
  }

  return {
    ...base,
    activeVehicle: active,
    otherVehicles: owned.filter((v) => v.id !== active.id),
    heroState,
    primaryAction,
    upcomingBooking,
    liveJob: liveJob ?? readyJob,
    pendingApproval,
    dueInvoice,
    protections,
    membership,
    recentHistory,
  };
}
