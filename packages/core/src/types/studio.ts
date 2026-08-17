import type { BayType } from "./service.js";

export interface Bay {
  id: string;
  tenantId: string;
  studioId: string;
  name: string; // e.g. "Bay 1", "Protection Bay A"
  bayType: BayType;
  active: boolean;
}

export interface OperatingHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  open: string; // "HH:mm" in studio timezone
  close: string;
  closed: boolean;
}

export interface StudioConfig {
  id: string;
  tenantId: string;
  studioId: string;
  timezone: string; // IANA timezone — "Asia/Kolkata" (India default)
  currency: string; // ISO 4217 — "INR" (India default)
  taxRatePercent: number; // default 18 (GST India)
  taxDescription: string; // "GST 18%"
  operatingHours: OperatingHours[];
  holidays: string[]; // ISO date strings
  vehiclePlateRegex: string; // India format default; tenant-configurable
  slotIntervalMinutes: number; // booking grid granularity
  maxAdvanceBookingDays: number;
  cancellationWindowHours: number;
  bays: Bay[];
}

export interface Employee {
  id: string;
  tenantId: string;
  studioId: string;
  authUid: string;
  name: string;
  phone: string;
  role: "studio" | "admin";
  active: boolean;
  createdAt: string;
  updatedAt: string;
  terminatedAt: string | null;
}
