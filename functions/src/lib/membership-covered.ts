import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type {
  Booking,
  Invoice,
  Membership,
  MembershipUsage,
  Payment,
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

/**
 * LEGACY transition state: a covered visit that completed through the OLD zero-payment
 * route before the settle endpoint existed. Deployed recordManualPayment on a covered
 * (totalAmount=0) job writes exactly: one completed Payment (amount 0, invoiceId set)
 * and one ordinary Invoice (total 0, paymentId set, no settlementKind), then
 * paymentStatus="paid" on job+booking - nothing else. This predicate accepts ONLY that
 * exact shape, so an arbitrary paid/zero-invoice residue is NOT admitted:
 *  - readCoveredLink must pass (historic consumed wash + usage record, tenant/studio/
 *    customer/vehicle binding, booking not CANCELLED/EXPIRED) - checked by the caller;
 *  - job AND booking paymentStatus "paid", no settlementKind on either;
 *  - exactly one live (non-void) invoice, total 0, no settlementKind, FULLY bound to
 *    this visit: tenant/studio/job/booking/customer/vehicle all match;
 *  - exactly one COMPLETED payment for the job, amount 0, mutually linked
 *    (payment.invoiceId === invoice.id AND invoice.paymentId === payment.id), bound to
 *    the same tenant/studio/customer;
 *  - no REFUNDED payment for the job (refund ambiguity rejects);
 *  - invoice not void (live filter) and job not CANCELLED (aJS transition rules).
 * A stale-link-paid covered job (non-zero invoice), an unbound or unlinked zero invoice,
 * a paid job with no completed zero payment, or a refunded one all stay blocked.
 */
export async function isLegacyCoveredCompletion(
  db: Firestore,
  tx: Transaction,
  job: ServiceJob,
  booking: Booking,
  liveInvoices: Invoice[],
): Promise<boolean> {
  if (job.paymentStatus !== "paid" || booking.paymentStatus !== "paid") return false;
  if (job.settlementKind || booking.settlementKind) return false;
  if (liveInvoices.length !== 1) return false;
  const inv = liveInvoices[0]!;
  if (inv.settlementKind || inv.total !== 0) return false;
  if (
    inv.tenantId !== job.tenantId ||
    inv.studioId !== job.studioId ||
    inv.jobId !== job.id ||
    inv.bookingId !== booking.id ||
    inv.customerId !== job.customerId ||
    inv.vehicleId !== job.vehicleId
  )
    return false;
  const paySnap = await tx.get(
    db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).where("tenantId", "==", job.tenantId),
  );
  const payments = paySnap.docs.map((d) => d.data() as Payment);
  if (payments.some((pmt) => pmt.status === "refunded")) return false;
  const completed = payments.filter((pmt) => pmt.status === "completed");
  if (completed.length !== 1) return false;
  const pmt = completed[0]!;
  return (
    pmt.amount === 0 &&
    pmt.invoiceId === inv.id &&
    inv.paymentId === pmt.id &&
    pmt.tenantId === job.tenantId &&
    pmt.studioId === job.studioId &&
    pmt.customerId === job.customerId
  );
}
