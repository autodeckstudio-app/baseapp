export const FIRST_TENANT_ID = "automodz";
export const FIRST_STUDIO_ID = "studio-ahmedabad";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_CURRENCY = "INR";
export const DEFAULT_TAX_RATE_PERCENT = 18;
export const DEFAULT_TAX_DESCRIPTION = "GST 18%";

export const SLOT_INTERVAL_MINUTES = 30;
export const TURNOVER_BUFFER_MINUTES = 15;
export const MAX_ADVANCE_BOOKING_DAYS = 30;
// Upper bound on how many calendar days a single job/booking can span,
// derived from the real catalogue's longest service (LLumar Valor PPF,
// 4320 min ≈ 7.2 working days at a typical 600 min/day operating window)
// with headroom. Used to bound multi-day-aware bay-occupancy range queries
// so they stay index-friendly rather than scanning unbounded history/future
// (Phase 5 — multi-day booking).
export const MAX_SERVICE_SPAN_DAYS = 14;
export const MAX_CUSTOMER_RESCHEDULES = 3;
export const CANCELLATION_FREE_WINDOW_HOURS = 24;
/** Unarrived bookings remain valid until the daily closing time IST on their scheduled day.
 * Keep the operational status unchanged so missed bookings remain reschedulable.
 */
export function bookingCloseHour(scheduledAt: string): number {
  const local = new Date(Date.parse(scheduledAt) + 330 * 60000);
  return local.getUTCDay() === 0 ? 19 : 21;
}
export function bookingMissedAt(scheduledAt: string): number {
  const start = Date.parse(scheduledAt);
  if (!Number.isFinite(start)) return NaN;
  // Asia/Kolkata has a fixed UTC+05:30 offset, with no daylight saving time.
  const offset = 330 * 60000;
  const dayStart = Math.floor((start + offset) / 86400000) * 86400000 - offset;
  return dayStart + bookingCloseHour(scheduledAt) * 3600000;
}
export function isBookingMissed(b: { status: string; scheduledAt: string }, now: number = Date.now()): boolean {
  if (b.status !== "CONFIRMED" && b.status !== "PENDING") return false;
  return now >= bookingMissedAt(b.scheduledAt);
}
export function isBookingLateToday(b: { status: string; scheduledAt: string }, now: number = Date.now()): boolean {
  return (b.status === "CONFIRMED" || b.status === "PENDING") &&
    now >= Date.parse(b.scheduledAt) && now < bookingMissedAt(b.scheduledAt);
}

export const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING_VEHICLE: ["VEHICLE_RECEIVED", "CANCELLED"],
  VEHICLE_RECEIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK: ["READY_FOR_DELIVERY", "IN_PROGRESS"],
  READY_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
} as const;

export const BOOKING_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
} as const;

export const APPROVAL_EXPIRY_HOURS = 24;

export const MEMBERSHIP_DURATION_DAYS = 30;
