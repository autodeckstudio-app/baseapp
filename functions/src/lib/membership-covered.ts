import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type {
  Booking,
  Invoice,
  Membership,
  MembershipUsage,
  Service,
  ServiceJob,
} from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
const deny = () => {
  throw new HttpsError(
    "failed-precondition",
    "This visit has no valid consumed membership wash linkage.",
  );
};
/** Reads only. Consumption is historical: an expired plan does not erase a consumed wash. */
export async function readCoveredLink(
  db: Firestore,
  tx: Transaction,
  job: ServiceJob,
): Promise<{ booking: Booking; membershipId: string }> {
  if (
    !job.bookingId ||
    job.isWalkIn ||
    job.totalAmount !== 0 ||
    job.priceBreakdown?.total !== 0 ||
    job.additionalWorkDelta !== 0 ||
    job.status === "CANCELLED"
  )
    return deny();
  const bs = await tx.get(db.collection(COLLECTIONS.bookings()).doc(job.bookingId));
  const b = bs.data() as Booking | undefined;
  if (
    !b ||
    !b.membershipId ||
    !b.membershipWashUsed ||
    b.giftId ||
    ["CANCELLED", "EXPIRED"].includes(b.status) ||
    b.cancelIntent?.state === "waiting" ||
    b.cancelIntent?.state === "needs_review" ||
    b.tenantId !== job.tenantId ||
    b.studioId !== job.studioId ||
    b.customerId !== job.customerId ||
    b.vehicleId !== job.vehicleId ||
    b.serviceId !== job.serviceId ||
    b.totalAmount !== 0 ||
    b.priceBreakdown?.total !== 0
  )
    return deny();
  const [ms, ss, us] = await Promise.all([
    tx.get(db.collection(COLLECTIONS.memberships()).doc(b.membershipId)),
    tx.get(db.collection(COLLECTIONS.services()).doc(job.serviceId)),
    tx.get(
      db.collection(SUBCOLLECTIONS.membershipUsage(b.membershipId)).where("jobId", "==", job.id),
    ),
  ]);
  const m = ms.data() as Membership | undefined,
    s = ss.data() as Service | undefined;
  if (
    !m ||
    m.tenantId !== job.tenantId ||
    m.customerId !== job.customerId ||
    !s ||
    s.tenantId !== job.tenantId ||
    !s.membershipWashEligible
  )
    return deny();
  const washes = us.docs
    .map((d) => d.data() as MembershipUsage)
    .filter(
      (u) =>
        u.usageType === "wash" &&
        u.tenantId === job.tenantId &&
        u.customerId === job.customerId &&
        u.bookingId === b.id &&
        u.jobId === job.id &&
        u.membershipId === b.membershipId,
    );
  const wash = washes[0];
  if (
    washes.length !== 1 ||
    !wash ||
    !Number.isSafeInteger(wash.valueRedeemed) ||
    wash.valueRedeemed <= 0 ||
    job.priceBreakdown.membershipDiscount !== wash.valueRedeemed ||
    b.priceBreakdown.membershipDiscount !== wash.valueRedeemed
  )
    return deny();
  return { booking: b, membershipId: b.membershipId };
}
export function exactCoveredInvoice(
  i: Invoice,
  job: ServiceJob,
  booking: Booking,
  membershipId: string,
): boolean {
  return (
    i.settlementKind === "membership_covered" &&
    i.membershipId === membershipId &&
    i.paymentId === null &&
    i.status === "issued" &&
    !!i.issuedAt &&
    i.total === 0 &&
    i.jobId === job.id &&
    i.bookingId === booking.id &&
    i.customerId === job.customerId &&
    i.tenantId === job.tenantId &&
    i.studioId === job.studioId &&
    i.vehicleId === job.vehicleId &&
    job.invoiceId === i.id &&
    booking.invoiceId === i.id &&
    booking.settlementKind === "membership_covered" &&
    job.settlementKind === "membership_covered"
  );
}
