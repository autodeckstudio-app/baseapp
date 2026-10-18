import { redundantPairs, type PriceBreakdown, type Service, type VehicleCategory } from "@autodeck/core";
import { calculatePrice, calculateTax, type CalculatePriceInput } from "./pricing.js";

/** Most extra services on top of the main one (so 5 lines in all). */
export const MAX_EXTRA_SERVICES = 4;

export interface BookingLine {
  serviceId: string;
  name: string;
  /** paise, snapshot at booking time */
  price: number;
  durationMinutes: number;
}

export type ExtrasProblem = string;

/** Why these extras cannot ride in one slot with the main service, or null when they can. Plain words, shown to the customer. */
export function extrasProblem(primary: Service, extras: Service[], opts: { gift: boolean }): ExtrasProblem | null {
  if (extras.length === 0) return null;
  if (extras.length > MAX_EXTRA_SERVICES) return "You can add up to 5 services to one booking.";
  if (opts.gift) return "A gift wash cannot be combined with other services. Book them separately.";
  if (new Set(extras.map((e) => e.id)).size !== extras.length || extras.some((e) => e.id === primary.id)) return "Each service can be added once.";
  if (primary.priceOnRequest === true || extras.some((e) => e.priceOnRequest === true)) return "Services priced after inspection cannot be combined. Book them separately.";
  if (extras.some((e) => !e.active)) return "One of the services is not available right now.";
  if (extras.some((e) => e.requiredBayType !== primary.requiredBayType)) return "These services use different bays. Book them separately.";
  const overlap = redundantPairs([primary.id, ...extras.map((e) => e.id)])[0];
  if (overlap) {
    const nameOf = (id: string) => [primary, ...extras].find((x) => x.id === id)?.name ?? "that service";
    return `${nameOf(overlap[0])} already includes ${nameOf(overlap[1])}. Remove ${nameOf(overlap[1])} from this booking.`;
  }
  return null;
}

/** One line per extra service, priced for the car's size with the same rule as the main service. */
export function priceExtras(extras: Service[], p: { vehicleCategory: VehicleCategory; tax: Pick<CalculatePriceInput, "taxRatePercent" | "taxDescription">; currency?: string }): BookingLine[] {
  return extras.map((e) => {
    const b = calculatePrice({ basePrice: e.basePrice, vehicleCategory: p.vehicleCategory, vehicleCategoryPricing: e.vehicleCategoryPricing, ...p.tax, ...(p.currency ? { currency: p.currency } : {}) });
    return { serviceId: e.id, name: e.name, price: b.subtotal, durationMinutes: e.estimatedDurationMinutes };
  });
}

/** Adds the extras to a breakdown. The membership benefit already on it stays on the main service only; tax is recomputed on what is left to pay. */
export function addExtrasToBreakdown(bd: PriceBreakdown, lines: BookingLine[]): PriceBreakdown {
  if (lines.length === 0) return bd;
  const extra = lines.reduce((s, l) => s + l.price, 0);
  const subtotal = bd.subtotal + extra;
  const taxable = subtotal - (bd.membershipDiscount ?? 0);
  const tax = calculateTax(taxable, bd.taxRatePercent);
  return { ...bd, addOns: [...bd.addOns, ...lines.map((l) => ({ id: l.serviceId, name: l.name, price: l.price }))], subtotal, tax, total: taxable + tax };
}

export function totalMinutes(primaryMinutes: number, lines: BookingLine[]): number {
  return primaryMinutes + lines.reduce((s, l) => s + l.durationMinutes, 0);
}
