import type { PriceSnapshot, Service } from './types';

/** ₹10,000 in paise. Services priced at or below this need no advance. */
export const ADVANCE_THRESHOLD_PAISE = 1_000_000;

/** 40% advance on qualifying bookings. */
export const ADVANCE_PERCENTAGE = 0.4;

/**
 * Computes a booking's price snapshot from the currently-selected services.
 *
 * This is the ONLY place price/advance amounts are decided. The result is
 * frozen (Object.freeze) because, once computed at booking time, it must
 * never be mutated or silently recomputed from a later price change — the
 * caller (backend) stores this snapshot once and treats it as permanent.
 *
 * No tax/discount handling is included: neither was ever part of any
 * approved product decision, so none is assumed here.
 */
export function computePriceSnapshot(
  selectedServices: ReadonlyArray<Pick<Service, 'serviceId' | 'basePrice'>>
): Readonly<PriceSnapshot> {
  if (selectedServices.length === 0) {
    throw new Error('computePriceSnapshot requires at least one selected service');
  }

  const lineItems = selectedServices.map((service) => ({
    serviceId: service.serviceId,
    price: service.basePrice,
  }));

  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal;

  const advanceRequired = total > ADVANCE_THRESHOLD_PAISE;
  const advanceAmount = advanceRequired ? Math.round(total * ADVANCE_PERCENTAGE) : 0;

  return Object.freeze({
    lineItems,
    subtotal,
    total,
    advanceRequired,
    advanceAmount,
  });
}
