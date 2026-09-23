// People-facing names for stored status values. Stored enums never reach the
// screen raw; unknown values fall back to sentence case.
const LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  NO_SHOW: "No-show",
  PENDING_VEHICLE: "Awaiting vehicle",
  VEHICLE_RECEIVED: "Checked in",
  IN_PROGRESS: "In progress",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready for pickup",
  DELIVERED: "Delivered",
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partial: "Part paid",
  unpaid: "Unpaid",
  paid: "Paid",
  draft: "Draft",
  issued: "Issued",
  void: "Void",
  active: "Active",
  expired: "Expired",
  verified: "Verified",
  unverified: "Unverified",
  approved: "Approved",
  rejected: "Declined",
};

export function statusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const known = LABELS[value];
  if (known) return known;
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const METHODS: Record<string, string> = {
  cash: "Cash",
  upi_manual: "UPI",
  bank_transfer: "Bank transfer",
  razorpay_payment_link: "Online",
};

// How the customer paid, in counter words.
export function methodLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return METHODS[value] ?? statusLabel(value);
}
