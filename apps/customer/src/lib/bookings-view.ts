// Pure helpers for the Bookings screen: only booking content, nothing else.
export interface JobLike { id: string; status: string; bookingId?: string | null; serviceId?: string }
export interface BookingLike { id: string; status: string; scheduledAt: string; serviceId?: string | null; vehicleId?: string }

const LIVE = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"];

/** The job that is in the studio right now (newest first order is kept). */
export function liveJobOf<J extends JobLike>(jobs: J[]): J | null {
  return jobs.find((j) => LIVE.includes(j.status)) ?? null;
}

/** The last few distinct services the customer finished, newest first, for one-tap rebooking. */
export function recentDistinctServices<B extends BookingLike>(all: B[], limit = 3): B[] {
  const seen = new Set<string>();
  const out: B[] = [];
  for (const b of [...all].filter((x) => x.status === "COMPLETED" && !!x.serviceId).sort((a, c) => c.scheduledAt.localeCompare(a.scheduledAt))) {
    const k = b.serviceId as string;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
    if (out.length >= limit) break;
  }
  return out;
}

/** Where "Track" on Home goes: the live job's own booking, or the job itself for a walk-in (the booking screen accepts either). Never another booking. */
export function liveTrackTarget(job: { id: string; bookingId?: string | null } | null | undefined, upcomingBookingId?: string | null): string | null {
  if (job) return job.bookingId ?? job.id;
  return upcomingBookingId ?? null;
}
