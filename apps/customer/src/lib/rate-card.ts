// Which finished visit, if any, to ask the customer to rate on Home.
export interface RateBooking { id: string; status: string; serviceId?: string | null; scheduledAt: string; updatedAt?: string }

export const RATE_WINDOW_DAYS = 7;

/** The newest completed visit finished within the window. updatedAt is when the booking became COMPLETED. */
export function rateCandidate<B extends RateBooking>(all: B[], now = Date.now()): B | null {
  const done = all
    .filter((b) => b.status === "COMPLETED" && !!b.serviceId)
    .map((b) => ({ b, at: Date.parse(b.updatedAt ?? b.scheduledAt) }))
    .filter((x) => !Number.isNaN(x.at) && now - x.at <= RATE_WINDOW_DAYS * 86400000 && x.at <= now + 3600000)
    .sort((a, c) => c.at - a.at);
  return done[0]?.b ?? null;
}
