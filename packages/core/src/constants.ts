export const FIRST_TENANT_ID = "automodz";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_CURRENCY = "INR";
export const DEFAULT_TAX_RATE_PERCENT = 18;
export const DEFAULT_TAX_DESCRIPTION = "GST 18%";

export const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  VEHICLE_RECEIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["QUALITY_CHECK"],
  QUALITY_CHECK: ["READY_FOR_DELIVERY", "IN_PROGRESS"],
  READY_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
} as const;

export const BOOKING_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
} as const;

export const APPROVAL_EXPIRY_HOURS = 24;
