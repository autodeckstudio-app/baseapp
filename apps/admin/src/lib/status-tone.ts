// Local copy of @autodeck/ui's status→tone map (that package's StatusBadge
// imports react-native at module scope, which cannot be pulled into the
// Next.js web bundle — see format.ts for the same rationale). Keep in sync
// with packages/ui/src/components/StatusBadge.tsx.
export type StatusTone = "neutral" | "accent" | "success" | "warning" | "error";

const STATUS_TONES: Record<string, StatusTone> = {
  PENDING: "warning",
  CONFIRMED: "accent",
  ACTIVE: "accent",
  COMPLETED: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  PENDING_VEHICLE: "warning",
  VEHICLE_RECEIVED: "accent",
  IN_PROGRESS: "accent",
  QUALITY_CHECK: "warning",
  READY_FOR_DELIVERY: "success",
  DELIVERED: "success",
  pending: "warning",
  processing: "accent",
  completed: "success",
  failed: "error",
  cancelled: "neutral",
  refunded: "neutral",
  draft: "neutral",
  issued: "accent",
  paid: "success",
  void: "neutral",
  active: "success",
  expired: "neutral",
  verified: "success",
  unverified: "warning",
  approved: "success",
  rejected: "error",
};

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}
