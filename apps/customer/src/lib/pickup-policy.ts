import { PICKUP_FREE_ROAD_METERS, PICKUP_ROAD_RATE_PER_KM_PAISE } from "@autodeck/core";

// Fee and distance wording shown wherever pickup/drop is offered or tracked.
// One shared source so the booking flow (book/confirm.tsx) and the booking
// page status card (ui/PickupCard.tsx) never drift apart. Numbers come from
// core constants, never typed here.
export const PICKUP_POLICY = `The first ${PICKUP_FREE_ROAD_METERS / 1000} km by road from the studio are free, separately for pickup and for drop-off. Beyond that it is Rs ${PICKUP_ROAD_RATE_PER_KM_PAISE / 100} per extra km by road. Distance is measured by road, and the price you see before booking is the price you are charged. The fee is paid at the studio.`;
