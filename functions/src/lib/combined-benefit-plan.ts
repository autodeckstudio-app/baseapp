import type { Membership, PriceBreakdown } from "@autodeck/core";
import { applyMembershipBenefit, calculateTax } from "./pricing.js";
import { addExtrasToBreakdown, type BookingLine } from "./booking-lines.js";
import { applyPickupFees } from "./pickup-fee.js";
type Plan = Pick<
  Membership,
  | "id"
  | "tenantId"
  | "customerId"
  | "status"
  | "startDate"
  | "endDate"
  | "pickupsTotal"
  | "pickupsUsed"
  | "washesTotal"
  | "washesUsed"
  | "discountPercent"
>;
function count(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
}
function date(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
/** Read-only preparation seam. Callers must transactionally re-read ALL memberships and
 * apply returned deltas with booking/transport creation, never after charging.
 * No callable imports this until zero-payment and restoration paths are qualified.
 * Legacy transport consumes at staff confirmation, unlike service wash at booking.
 * Booking-time reservation and later membership cancellation need qualification
 * before these preparation deltas can replace that lifecycle.
 */
export function planCombinedBenefits(i: {
  service: PriceBreakdown;
  extras?: BookingLine[];
  pickupFeePaise: number;
  dropFeePaise: number;
  memberships: Plan[];
  membershipId?: string;
  washEligible: boolean;
  giftCovered: boolean;
  tenantId: string;
  customerId: string;
  scheduledDate: string;
}) {
  if (
    !date(i.scheduledDate) ||
    !count(i.pickupFeePaise) ||
    !count(i.dropFeePaise)
  )
    throw Error("Benefit review date or fees are invalid.");
  const raw = i.service;
  if (
    ![
      raw.basePrice,
      raw.scopeAdjustment,
      raw.subtotal,
      raw.tax,
      raw.total,
    ].every(count) ||
    !Number.isFinite(raw.taxRatePercent) ||
    raw.taxRatePercent < 0 ||
    raw.taxRatePercent > 100 ||
    raw.subtotal !== raw.basePrice + raw.scopeAdjustment ||
    raw.tax !== calculateTax(raw.subtotal, raw.taxRatePercent) ||
    raw.total !== raw.subtotal + raw.tax
  )
    throw Error("Original service price needs review.");
  if (i.giftCovered && (i.extras?.length ?? 0) > 0)
    throw Error("A gift wash cannot be combined with other services.");
  if (i.giftCovered && i.membershipId)
    throw Error("A gift cannot be combined with a membership wash.");
  if (
    i.service.pickupFee !== 0 ||
    i.service.dropFee !== 0 ||
    i.service.membershipDiscount !== null ||
    i.service.addOns.length > 0
  )
    throw Error("Review the original service price before applying benefits.");
  if (new Set(i.memberships.map((m) => m.id)).size !== i.memberships.length)
    throw Error("Membership list needs review.");
  const usable = i.memberships.filter(
    (m) =>
      m.tenantId === i.tenantId &&
      m.customerId === i.customerId &&
      m.status === "active" &&
      (!m.startDate ||
        (date(m.startDate.slice(0, 10)) &&
          m.startDate.slice(0, 10) <= i.scheduledDate)) &&
      (!m.endDate ||
        (date(m.endDate.slice(0, 10)) &&
          m.endDate.slice(0, 10) >= i.scheduledDate)),
  );
  let service = { ...i.service },
    washMembershipId: string | null = null,
    discountMembershipId: string | null = null;
  if (i.giftCovered) service = { ...service, basePrice:0,scopeAdjustment:0,subtotal: 0, tax: 0, total: 0 };
  if (i.membershipId) {
    const m = usable.find((candidate) => candidate.id === i.membershipId);
    if (
      !m ||
      !m.endDate ||
      !count(m.washesTotal) ||
      !count(m.washesUsed) ||
      !Number.isFinite(m.discountPercent) ||
      m.discountPercent < 0 ||
      m.discountPercent > 100
    )
      throw Error("The selected membership is not valid for this visit.");
    const consume = i.washEligible && m.washesUsed < m.washesTotal;
    service = applyMembershipBenefit(service, {
      consumeWash: consume,
      discountPercent: m.discountPercent,
    });
    if (consume) washMembershipId = m.id;
    else if ((service.membershipDiscount ?? 0) > 0) discountMembershipId = m.id;
  }
  // Match the existing whole-request free pickup entitlement, including drop-only.
  // Do not waste a credit on a request whose original directed quote is already free.
  const pickupPlan =
    i.pickupFeePaise + i.dropFeePaise > 0
      ? usable
          .filter(
            (m) =>
              count(m.pickupsTotal) &&
              count(m.pickupsUsed) &&
              m.pickupsUsed! < m.pickupsTotal!,
          )
          .sort(
            (a, b) =>
              (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999") ||
              a.id.localeCompare(b.id),
          )[0]
      : undefined;
  for (const line of i.extras ?? [])
    if (!count(line.price)) throw Error("Extra service price needs review.");
  const priced = addExtrasToBreakdown(service, i.extras ?? []);
  const breakdown = applyPickupFees(
    priced,
    pickupPlan ? 0 : i.pickupFeePaise,
    pickupPlan ? 0 : i.dropFeePaise,
  );
  if (![breakdown.subtotal, breakdown.tax, breakdown.total].every(count))
    throw Error("Combined benefit amounts need review.");
  return {
    breakdown,
    washMembershipId,
    discountMembershipId,
    pickupMembershipId: pickupPlan?.id ?? null,
    washDelta: washMembershipId ? 1 : 0,
    pickupDelta: pickupPlan ? 1 : 0,
    noPaymentRequired: breakdown.total === 0,
  };
}
