import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { ServiceJob } from "@autodeck/core";
import { isDeepStrictEqual } from "node:util";
import { HttpsError } from "firebase-functions/v2/https";
import { calculateTax } from "./pricing.js";
/** Historical membership use is an original discount, never money received.
 * Current plan expiry/counters do not reprice an already booked service. */
export async function readVisitMembershipExtras(
  tx: Transaction,
  db: Firestore,
  job: ServiceJob,
  booking: Record<string, any> | undefined,
) {
  const fail = (): never => {
    throw new HttpsError(
      "failed-precondition",
      "Review the original membership and payable extras.",
    );
  };
  if (!booking?.["membershipId"]) return null;
  const b = booking,
    p = job.priceBreakdown,
    amount = (n: unknown): n is number =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (
    typeof b["membershipId"] !== "string" ||
    !/^[-A-Za-z0-9_]{1,120}$/.test(b["membershipId"]) ||
    b["giftId"] ||
    job.settlementKind ||
    job.status === "CANCELLED" ||
    b["status"] === "CANCELLED" ||
    b["status"] === "EXPIRED" ||
    job.serviceId !== b["serviceId"] ||
    !isDeepStrictEqual(b["priceBreakdown"], p) ||
    b["totalAmount"] !== p.total ||
    !amount(p.membershipDiscount) ||
    p.membershipDiscount <= 0 ||
    !Array.isArray(p.addOns) ||
    !amount(p.basePrice) ||
    !amount(p.scopeAdjustment) ||
    !amount(p.subtotal) ||
    !amount(p.pickupFee) ||
    !amount(p.dropFee) ||
    !amount(p.tax) ||
    !amount(p.total) ||
    !Number.isSafeInteger(p.roundOffPaise ?? 0) ||
    !Number.isFinite(p.taxRatePercent) ||
    p.taxRatePercent < 0 ||
    p.taxRatePercent > 100
  )
    return fail();
  const addOns = p.addOns;
  if (
    addOns.length > 4 ||
    new Set(addOns.map((a) => a.id)).size !== addOns.length ||
    addOns.some(
      (a) =>
        typeof a.id !== "string" ||
        !a.id ||
        typeof a.name !== "string" ||
        !a.name.trim() ||
        !amount(a.price),
    )
  )
    return fail();
  const base = p.basePrice + p.scopeAdjustment,
    extras = addOns.reduce((n, a) => n + a.price, 0),
    taxable = p.subtotal - p.membershipDiscount;
  if (
    !Number.isSafeInteger(base + extras + p.pickupFee + p.dropFee) ||
    p.subtotal !== base + extras + p.pickupFee + p.dropFee ||
    p.membershipDiscount > base ||
    taxable < 0 ||
    p.tax !== calculateTax(taxable, p.taxRatePercent) ||
    p.total !== taxable + p.tax + (p.roundOffPaise ?? 0) ||
    p.total < 0 ||
    b["membershipDiscountApplied"] !== true
  )
    return fail();
  const m = (
      await tx.get(db.collection("memberships").doc(b["membershipId"]))
    ).data(),
    uses = await tx.get(
      db
        .collection("memberships")
        .doc(b["membershipId"])
        .collection("usage")
        .where("jobId", "==", job.id)
        .limit(3),
    );
  if (
    !m ||
    m["id"] !== b["membershipId"] ||
    m["tenantId"] !== job.tenantId ||
    m["customerId"] !== job.customerId ||
    uses.size !== 1
  )
    return fail();
  if (
    (
      await tx.get(
        db
          .collection("memberships")
          .doc(b["membershipId"])
          .collection("visitCancellationRestores")
          .doc(job.id),
      )
    ).exists
  )
    return fail();
  const doc = uses.docs[0]!,
    u = doc.data(),
    wash = b["membershipWashUsed"] === true;
  if (
    u["id"] !== doc.id ||
    u["membershipId"] !== b["membershipId"] ||
    u["tenantId"] !== job.tenantId ||
    u["customerId"] !== job.customerId ||
    u["bookingId"] !== job.bookingId ||
    u["jobId"] !== job.id ||
    u["usageType"] !== (wash ? "wash" : "discount") ||
    u["valueRedeemed"] !== p.membershipDiscount ||
    !Number.isFinite(Date.parse(u["usedAt"])) ||
    u["restoredAt"] ||
    u["cancelledAt"] ||
    (wash &&
      (p.membershipDiscount !== base ||
        p.membershipDiscountPercent !== null)) ||
    (!wash &&
      (!Number.isFinite(p.membershipDiscountPercent) ||
        p.membershipDiscountPercent! < 0 ||
        p.membershipDiscountPercent! > 100 ||
        p.membershipDiscount !==
          Math.round((base * p.membershipDiscountPercent!) / 100)))
  )
    return fail();
  return {
    membershipId: b["membershipId"],
    usageId: doc.id,
    usage: u,
    originalBreakdown: p,
  };
}
