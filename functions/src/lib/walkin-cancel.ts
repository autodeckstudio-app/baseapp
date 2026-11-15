// Rule for cancelling a walk-in that was started by mistake. Pure so it can be tested without Firestore.
// Only a walk-in (no booking) that has just been checked in, with nothing paid and no work started.
export const WALKIN_CANCELLABLE_STATUS = ["VEHICLE_RECEIVED"] as const;

export function walkinCancelBlock(job: { isWalkIn: boolean; bookingId?: string | null; status: string; paymentStatus: string }): string | null {
  if (!job.isWalkIn || job.bookingId) return "Only a walk-in can be cancelled here. Bookings are cancelled from the admin app.";
  if (job.status === "CANCELLED") return null;
  if (!(WALKIN_CANCELLABLE_STATUS as readonly string[]).includes(job.status)) return "Work has already started on this job, so it cannot be cancelled here.";
  if (job.paymentStatus !== "unpaid") return "A payment has been recorded on this job, so it cannot be cancelled here.";
  return null;
}
