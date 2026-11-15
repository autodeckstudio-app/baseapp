/**
 * Shared rule for whether an open pickup/drop request can still be worked, used by Admin and Studio
 * so both apps agree. Cancelled, expired, no-show and missing bookings are never actionable. A
 * COMPLETED booking is actionable only while a return (drop) is still owed, or when every required
 * leg is done and the request just needs closing (CONFIRMED -> DONE).
 */
export type PickupEligibilityInput = {
  kind: string; // "pickup" | "drop" | "both"
  status: string; // request status
  pickupCompletedAt?: string | null;
  dropCompletedAt?: string | null;
};

export type PickupEligibility = { actionable: boolean; note: string | null };

export function pickupLegsOutstanding(r: Pick<PickupEligibilityInput, "kind" | "pickupCompletedAt" | "dropCompletedAt">): { pickup: boolean; drop: boolean } {
  const needsPickup = r.kind === "pickup" || r.kind === "both";
  const needsDrop = r.kind === "drop" || r.kind === "both";
  return { pickup: needsPickup && !r.pickupCompletedAt, drop: needsDrop && !r.dropCompletedAt };
}

/** bookingStatus undefined/null = the booking does not exist (orphan request). */
export function pickupEligibility(r: PickupEligibilityInput, bookingStatus: string | null | undefined): PickupEligibility {
  if (r.status !== "REQUESTED" && r.status !== "CONFIRMED") return { actionable: false, note: null };
  if (!bookingStatus) return { actionable: false, note: "No booking found for this request. Decline it to close it." };
  switch (bookingStatus) {
    case "CANCELLED": return { actionable: false, note: "Booking cancelled. Decline this request to close it." };
    case "EXPIRED": return { actionable: false, note: "Booking expired. Decline this request to close it." };
    case "NO_SHOW": return { actionable: false, note: "Booking marked no-show. Decline this request to close it." };
    case "COMPLETED": {
      const out = pickupLegsOutstanding(r);
      if (out.drop) return { actionable: true, note: "Booking completed. Car return (drop) is still owed." };
      if (r.status === "CONFIRMED" && !out.pickup) return { actionable: true, note: "Booking completed. All legs are done; mark the request done to close it." };
      return { actionable: false, note: "Booking completed and nothing is owed. Decline this request to close it." };
    }
    default: return { actionable: true, note: null };
  }
}
