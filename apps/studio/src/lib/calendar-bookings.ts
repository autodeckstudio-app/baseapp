import type { Booking, ServiceJob } from "@autodeck/core";

/** UTC ISO bounds of one calendar day in India time (the studio's day). */
export function dayRangeIST(date: string): { start: string; end: string } {
  return {
    start: new Date(`${date}T00:00:00+05:30`).toISOString(),
    end: new Date(`${date}T23:59:59.999+05:30`).toISOString(),
  };
}

/** Bookings that are still ahead of the studio floor: confirmed or pending, with no job created for them yet. Cancelled, finished and already-started bookings are the job list's business. */
export function bookedNotArrived(bookings: Pick<Booking, "id" | "status" | "scheduledAt">[], jobs: Pick<ServiceJob, "bookingId">[]): typeof bookings {
  const withJob = new Set(jobs.map((j) => j.bookingId).filter((x): x is string => !!x));
  return bookings
    .filter((b) => (b.status === "CONFIRMED" || b.status === "PENDING") && !withJob.has(b.id))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
