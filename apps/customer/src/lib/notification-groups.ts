// Notification chips: All, Bookings, Papers, Club. Unknown kinds only show under All.
export type NotificationChip = "all" | "bookings" | "papers" | "club";

const GROUP: Record<string, NotificationChip> = {
  Booking: "bookings", Approval: "bookings", Invoice: "bookings", ServiceJob: "bookings",
  Vehicle: "papers", Protection: "papers", Warranty: "papers", Paper: "papers",
  Membership: "club",
};

export function notificationChip(entityType: string | null | undefined): NotificationChip | null {
  return GROUP[entityType ?? ""] ?? null;
}

export function inChip<T extends { entityType?: string | null }>(items: T[], chip: NotificationChip): T[] {
  return chip === "all" ? items : items.filter((n) => notificationChip(n.entityType) === chip);
}
