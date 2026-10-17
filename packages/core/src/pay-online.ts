import type { MenuGroupKey } from "./menu.js";
import { menuGroupOf } from "./menu.js";
import type { Service } from "./types/service.js";

/** Menu groups where the customer may choose to pay at the studio (bigger services). Every other priced service is paid in the app at booking.
 *  This is the one list to change. It is a first guess to be confirmed by the owner. */
export const PAY_AT_STUDIO_GROUPS: readonly MenuGroupKey[] = ["coatings", "ppf", "garage", "mods"];

export type BookingPayment = { online: boolean; studioChoice: boolean };
/** How a service is paid at booking. Quote-only services and zero totals have no online payment. */
export function bookingPayment(service: Pick<Service, "category" | "priceOnRequest">, totalPaise: number): BookingPayment {
  if (service.priceOnRequest === true || totalPaise <= 0) return { online: false, studioChoice: false };
  return { online: true, studioChoice: (PAY_AT_STUDIO_GROUPS as readonly string[]).includes(menuGroupOf(service.category).key) };
}
