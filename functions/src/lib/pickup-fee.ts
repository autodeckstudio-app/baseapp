// Pickup and drop fees on a visit's price. Pure. The fee is taxed exactly like the service (the breakdown's own snapshotted
// rate, so it follows the studio's GST setting: nothing here invents a rate). Setting is absolute, so repeating it changes nothing.
import type { PriceBreakdown } from "@autodeck/core";
import { calculateTax } from "./pricing.js";

/** The fee for each leg of a request, from the amount the server stored when the request was made. */
export function legFees(kind: "pickup" | "drop" | "both", feePaise: number | null | undefined): { pickup: number; drop: number } {
  if (!feePaise || feePaise <= 0) return { pickup: 0, drop: 0 };
  // The stored amount is the whole request (per leg, so "both" is two legs). Each leg is an equal share.
  const leg = kind === "both" ? Math.round(feePaise / 2) : feePaise;
  return { pickup: kind === "drop" ? 0 : leg, drop: kind === "pickup" ? 0 : leg };
}

/** The breakdown with the given pickup and drop fees (replacing any already on it). Tax is recomputed on subtotal minus the membership discount. */
export function applyPickupFees(pb: PriceBreakdown, pickup: number, drop: number): PriceBreakdown {
  const subtotal = pb.subtotal - pb.pickupFee - pb.dropFee + pickup + drop;
  const discount = pb.membershipDiscount ?? 0;
  const tax = calculateTax(subtotal - discount, pb.taxRatePercent);
  return { ...pb, pickupFee: pickup, dropFee: drop, subtotal, tax, total: subtotal - discount + tax };
}
