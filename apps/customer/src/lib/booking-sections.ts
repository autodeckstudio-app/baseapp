// Which section of the Visits screen a booking belongs in. A car that is already
// in the studio is not "coming up", even when its booking date has passed.
export interface SectionBooking { id?: string; status: string; scheduledAt: string }

export function bookingSections<B extends SectionBooking>(all: B[]): { inStudio: B[]; upcoming: B[]; past: B[] } {
  const byTime = (a: B, b: B) => a.scheduledAt.localeCompare(b.scheduledAt);
  const inStudio = all.filter((b) => b.status === "ACTIVE").sort(byTime);
  const upcoming = all.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED").sort(byTime);
  const past = all.filter((b) => !inStudio.includes(b) && !upcoming.includes(b));
  return { inStudio, upcoming, past };
}

/** The service to offer for one-tap rebooking: the most recent finished visit that had a service attached. */
export function lastCompletedService<B extends SectionBooking & { serviceId?: string | null }>(all: B[]): B | null {
  const done = all.filter((b) => b.status === "COMPLETED" && !!b.serviceId).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return done[0] ?? null;
}
