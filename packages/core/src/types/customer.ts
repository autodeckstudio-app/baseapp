import type { VehicleCategory } from "./service.js";

export interface Customer {
  id: string;
  tenantId: string;
  authUid: string;
  name: string;
  phone: string; // E.164 format, e.g. "+919876543210"
  notificationPrefs: {
    push: boolean;
    quietMode: boolean;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  ownerId: string; // customerId
  registrationNumber: string; // India plate format, tenant-configurable regex
  make: string;
  model: string;
  year: number;
  color: string;
  category: VehicleCategory | null; // used for service pricing; null if not yet set
  photoUrl: string | null;
  odometer: number | null; // km
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
