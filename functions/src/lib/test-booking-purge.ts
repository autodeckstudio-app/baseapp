/**
 * Pure, fail-closed validation for the scoped test-booking cleanup
 * (purgeTestBookings). Every rule must hold for EVERY named booking or
 * nothing is deleted. Rules exist to make a real customer booking
 * undeletable through this path:
 *  - the booking must exist and be CANCELLED (any other status: reject)
 *  - it must belong to the exact customer account the caller named
 *  - no payment document may exist for the booking or any of its jobs
 *    (any payment record at all - pending, failed, completed: reject,
 *    money evidence is never purged here)
 *  - no invoice may exist
 *  - every linked job must itself be CANCELLED
 */
export interface PurgeCandidateDoc {
  id: string;
  status: string;
}

export interface PurgeCandidate {
  bookingId: string;
  bookingExists: boolean;
  bookingStatus?: string | undefined;
  bookingCustomerId?: string | undefined;
  jobs: PurgeCandidateDoc[];
  paymentCount: number;
  invoiceCount: number;
  intentIds: string[];
  pickupRequestIds: string[];
}

export type PurgeVerdict = { ok: true; bookingId: string } | { ok: false; bookingId: string; reason: string };

export function planTestBookingPurge(c: PurgeCandidate, expectedCustomerId: string): PurgeVerdict {
  if (!c.bookingExists) return { ok: false, bookingId: c.bookingId, reason: `booking ${c.bookingId} does not exist (already removed?)` };
  if (c.bookingStatus !== "CANCELLED") {
    return { ok: false, bookingId: c.bookingId, reason: `booking ${c.bookingId} has status ${c.bookingStatus ?? "unknown"}, only CANCELLED test bookings can be purged` };
  }
  if (c.bookingCustomerId !== expectedCustomerId) {
    return { ok: false, bookingId: c.bookingId, reason: `booking ${c.bookingId} belongs to a different customer account than the one named` };
  }
  if (c.paymentCount !== 0) {
    return { ok: false, bookingId: c.bookingId, reason: `booking ${c.bookingId} has ${c.paymentCount} payment record(s) - payment evidence is never purged` };
  }
  if (c.invoiceCount !== 0) {
    return { ok: false, bookingId: c.bookingId, reason: `booking ${c.bookingId} has ${c.invoiceCount} invoice(s) - financial records are never purged` };
  }
  const activeJob = c.jobs.find((j) => j.status !== "CANCELLED");
  if (activeJob) {
    return { ok: false, bookingId: c.bookingId, reason: `booking ${c.bookingId} has job ${activeJob.id} with status ${activeJob.status}, only fully-cancelled work can be purged` };
  }
  return { ok: true, bookingId: c.bookingId };
}
