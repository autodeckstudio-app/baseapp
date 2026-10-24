import { PICKUP_FAR_FEE_PAISE, PICKUP_NEAR_FEE_PAISE, PICKUP_NEAR_KM, pickupFeePaise } from "@autodeck/core";

// Fee and distance wording shown wherever pickup/drop is offered or tracked.
// One shared source so the booking flow (book/confirm.tsx) and the booking
// page status card (ui/PickupCard.tsx) never drift apart.
export const PICKUP_POLICY = `Under ${PICKUP_NEAR_KM} km of the studio it is Rs ${PICKUP_NEAR_FEE_PAISE / 100} for pickup and Rs ${PICKUP_NEAR_FEE_PAISE / 100} for drop-off. From ${PICKUP_NEAR_KM} km it is Rs ${PICKUP_FAR_FEE_PAISE / 100} for each. Distance is measured in a straight line. The fee is paid at the studio.`;

/** "Rs 150" style fee line for a measured distance and request kind. */
export const pickupFeeText = (km: number, kind: "pickup" | "drop" | "both"): string => `Rs ${pickupFeePaise(km, kind) / 100}`;
