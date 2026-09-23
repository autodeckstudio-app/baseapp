import type { Booking, ServiceJob, Vehicle } from "@autodeck/core";

export type HomeHeroState =
  | "empty"
  | "idle"
  | "booked"
  | "inService"
  | "awaitingApproval"
  | "paymentDue"
  | "ready";

export interface HomeAction {
  label: string;
  route: "garage" | "catalogue" | "booking" | "approval" | "payment";
  entityId?: string;
}

export interface CustomerHomeModel {
  firstName?: string;
  activeVehicle?: Vehicle;
  heroState: HomeHeroState;
  statement: string;
  detail: string;
  primaryAction: HomeAction;
  nextBooking?: Booking;
  activeJob?: ServiceJob;
  lastUpdatedAt: string;
}

export interface CustomerHomeInput {
  displayName?: string | null;
  vehicles: Vehicle[];
  selectedVehicleId?: string | null;
  bookings: Booking[];
  jobs: ServiceJob[];
  pendingApprovalId?: string | null;
  now?: Date;
}

const activeBooking = (bookings: Booking[], vehicleId: string) =>
  bookings
    .filter(
      (booking) =>
        booking.vehicleId === vehicleId &&
        (booking.status === "PENDING" ||
          booking.status === "CONFIRMED" ||
          booking.status === "ACTIVE"),
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

export function projectCustomerHome(
  input: CustomerHomeInput,
): CustomerHomeModel {
  const now = input.now ?? new Date();
  const firstName = input.displayName?.trim().split(/\s+/)[0] || undefined;
  const activeVehicle =
    input.vehicles.find((vehicle) => vehicle.id === input.selectedVehicleId) ??
    [...input.vehicles].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];

  if (!activeVehicle) {
    return {
      ...(firstName ? { firstName } : {}),
      heroState: "empty",
      statement: "Your garage starts here",
      detail:
        "Add your car to see its care, bookings and history in one place.",
      primaryAction: { label: "Add a vehicle", route: "garage" },
      lastUpdatedAt: now.toISOString(),
    };
  }

  const job = [...input.jobs]
    .filter(
      (candidate) =>
        candidate.vehicleId === activeVehicle.id &&
        candidate.status !== "DELIVERED" &&
        candidate.status !== "CANCELLED",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const booking = activeBooking(input.bookings, activeVehicle.id);
  const car =
    `${activeVehicle.make} ${activeVehicle.model}`.trim() ||
    activeVehicle.registrationNumber;

  if (input.pendingApprovalId) {
    return {
      ...(firstName ? { firstName } : {}),
      activeVehicle,
      heroState: "awaitingApproval",
      statement: `${car} needs your decision`,
      detail: "The studio has requested approval before continuing.",
      primaryAction: {
        label: "Review request",
        route: "approval",
        entityId: input.pendingApprovalId,
      },
      ...(booking ? { nextBooking: booking } : {}),
      ...(job ? { activeJob: job } : {}),
      lastUpdatedAt: now.toISOString(),
    };
  }

  if (job?.paymentStatus === "unpaid" && job.status === "READY_FOR_DELIVERY") {
    return {
      ...(firstName ? { firstName } : {}),
      activeVehicle,
      heroState: "paymentDue",
      statement: `${car} is ready`,
      detail: "Payment is due before delivery.",
      primaryAction: {
        label: "View payment",
        route: "payment",
        entityId: job.bookingId ?? job.id,
      },
      ...(booking ? { nextBooking: booking } : {}),
      activeJob: job,
      lastUpdatedAt: now.toISOString(),
    };
  }

  if (job?.status === "READY_FOR_DELIVERY") {
    return {
      ...(firstName ? { firstName } : {}),
      activeVehicle,
      heroState: "ready",
      statement: `${car} is ready for you`,
      detail: "The studio has completed its work.",
      primaryAction: {
        label: "View visit",
        route: "booking",
        entityId: job.bookingId ?? job.id,
      },
      ...(booking ? { nextBooking: booking } : {}),
      activeJob: job,
      lastUpdatedAt: now.toISOString(),
    };
  }

  if (job && job.status !== "PENDING_VEHICLE") {
    return {
      ...(firstName ? { firstName } : {}),
      activeVehicle,
      heroState: "inService",
      statement: `${car} is in our care`,
      detail: job.status.replace(/_/g, " ").toLowerCase(),
      primaryAction: {
        label: "Follow the visit",
        route: "booking",
        entityId: job.bookingId ?? job.id,
      },
      ...(booking ? { nextBooking: booking } : {}),
      activeJob: job,
      lastUpdatedAt: now.toISOString(),
    };
  }

  if (booking) {
    return {
      ...(firstName ? { firstName } : {}),
      activeVehicle,
      heroState: "booked",
      statement: `${car} is booked in`,
      detail: `${booking.scheduledDate} at ${booking.scheduledTime}`,
      primaryAction: {
        label: "View booking",
        route: "booking",
        entityId: booking.id,
      },
      nextBooking: booking,
      ...(job ? { activeJob: job } : {}),
      lastUpdatedAt: now.toISOString(),
    };
  }

  return {
    ...(firstName ? { firstName } : {}),
    activeVehicle,
    heroState: "idle",
    statement: `${car} is ready for its next chapter`,
    detail: activeVehicle.registrationNumber,
    primaryAction: { label: "Book care", route: "catalogue" },
    lastUpdatedAt: now.toISOString(),
  };
}
