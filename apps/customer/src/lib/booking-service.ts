import { httpsCallable } from "firebase/functions";
import type { LiveStudioInfo } from "./studio-info";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import { isBookingMissed, bookingMissedAt, type Booking } from "@autodeck/core";

export function customerBookingState(booking: Booking): Booking {
  return isBookingMissed(booking) ? { ...booking, status: "CANCELLED", cancelledAt: new Date(bookingMissedAt(booking.scheduledAt)).toISOString(), cancellationReason: "Auto-cancelled: vehicle did not arrive by studio close." } : booking;
}

export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string; // local time-of-day on estimatedEndDate (may differ from `date` for multi-day slots)
  estimatedEndDate: string; // "YYYY-MM-DD" - == date unless the service spans multiple days
  startAt: string;
  estimatedEndAt: string;
}

type GetAvailabilityInput = {
  serviceId: string;
  studioId: string;
  startDate: string;
  lookAheadDays?: number;
};
type GetAvailabilityOutput = { slots: AvailableSlot[] };

type CreateBookingInput = {
  serviceId: string;
  vehicleId: string;
  vehicleCategory: string;
  studioId: string;
  scheduledDate: string;
  scheduledTime: string;
  idempotencyKey: string;
  notes?: string;
  /** Held until the server records redemptions; only sent while MEMBERSHIP_WASH_LIVE is true. */
  useMembershipWash?: boolean;
};
type CreateBookingOutput = { booking: Booking };

type CancelBookingInput = { bookingId: string; reason: string };
type CancelBookingOutput = { success: boolean };

type RescheduleBookingInput = {
  bookingId: string;
  newDate: string;
  newTime: string;
  idempotencyKey: string;
};
type RescheduleBookingOutput = { booking: Booking };

export async function getAvailability(
  serviceId: string,
  studioId: string,
  startDate: string,
  lookAheadDays = 14,
): Promise<AvailableSlot[]> {
  const fn = httpsCallable<GetAvailabilityInput, GetAvailabilityOutput>(
    functions,
    "getAvailability",
  );
  const result = await fn({ serviceId, studioId, startDate, lookAheadDays });
  availabilityCache.set(availabilityKey(serviceId, studioId, startDate, lookAheadDays), { at: Date.now(), slots: result.data.slots });
  return futureOnly(result.data.slots);
}

// Slots fetched in the last minute, so opening Book right after a service page shows times at once. Always refetched after.
const availabilityCache = new Map<string, { at: number; slots: AvailableSlot[] }>();
const availabilityKey = (a: string, b: string, c: string, d: number) => `${a}|${b}|${c}|${d}`;
const futureOnly = (slots: AvailableSlot[]) => { const now = Date.now(); return slots.filter((s) => { const t = Date.parse(s.startAt); return Number.isNaN(t) || t > now; }); };
export function peekAvailability(serviceId: string, studioId: string, startDate: string, lookAheadDays = 14): AvailableSlot[] | null {
  const hit = availabilityCache.get(availabilityKey(serviceId, studioId, startDate, lookAheadDays));
  return hit && Date.now() - hit.at < 60_000 ? futureOnly(hit.slots) : null;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const fn = httpsCallable<CreateBookingInput, CreateBookingOutput>(
    functions,
    "createBooking",
  );
  const result = await fn(input);
  return result.data.booking;
}

export async function cancelBooking(
  bookingId: string,
  reason: string,
): Promise<void> {
  const fn = httpsCallable<CancelBookingInput & { customerContext: boolean }, CancelBookingOutput>(
    functions,
    "cancelBooking",
  );
  await fn({ bookingId, reason, customerContext: true });
}

export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newTime: string,
  idempotencyKey: string,
): Promise<Booking> {
  const fn = httpsCallable<RescheduleBookingInput & { customerContext: boolean }, RescheduleBookingOutput>(
    functions,
    "rescheduleBooking",
  );
  const result = await fn({ bookingId, newDate, newTime, idempotencyKey, customerContext: true });
  return result.data.booking;
}

export async function getMyBookings(uid: string, tenantId: string): Promise<Booking[]> {
  const q = query(
    collection(db, COLLECTIONS.bookings()),
    where("customerId", "==", uid),
    where("tenantId", "==", tenantId),
    orderBy("scheduledAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => customerBookingState(d.data() as Booking));
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.bookings(), bookingId));
  if (!snap.exists()) return null;
  return customerBookingState(snap.data() as Booking);
}

// Generates a UUID-like idempotency key on the client.
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Returns today's date string in "YYYY-MM-DD" format (IST-aware).
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function approveBookingQuote(bookingId: string): Promise<void> {
  const fn = httpsCallable<{ bookingId: string }, { bookingId: string }>(functions, "respondToBookingQuote");
  await fn({ bookingId });
}

export async function getStudioInfo(studioId: string): Promise<LiveStudioInfo> {
  const fn = httpsCallable<{ studioId: string }, LiveStudioInfo>(functions, "getStudioInfo");
  return (await fn({ studioId })).data;
}

export function listenToBooking(bookingId: string, onData: (booking: Booking | null) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, COLLECTIONS.bookings(), bookingId), (snap) => onData(snap.exists() ? customerBookingState(snap.data() as Booking) : null), onError);
}
