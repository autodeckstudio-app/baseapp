import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Booking } from "@autodeck/core";

export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string; // local time-of-day on estimatedEndDate (may differ from `date` for multi-day slots)
  estimatedEndDate: string; // "YYYY-MM-DD" — == date unless the service spans multiple days
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
  return result.data.slots;
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
  const fn = httpsCallable<CancelBookingInput, CancelBookingOutput>(
    functions,
    "cancelBooking",
  );
  await fn({ bookingId, reason });
}

export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newTime: string,
  idempotencyKey: string,
): Promise<Booking> {
  const fn = httpsCallable<RescheduleBookingInput, RescheduleBookingOutput>(
    functions,
    "rescheduleBooking",
  );
  const result = await fn({ bookingId, newDate, newTime, idempotencyKey });
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
  return snap.docs.map((d) => d.data() as Booking);
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.bookings(), bookingId));
  if (!snap.exists()) return null;
  return snap.data() as Booking;
}

// Generates a UUID-like idempotency key on the client.
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Returns today's date string in "YYYY-MM-DD" format (IST-aware).
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
