import type { VehicleCategory } from "./service.js";

export interface Customer {
  id: string;
  tenantId: string;
  authUid: string;
  name: string;
  phone: string; // E.164 format, e.g. "+919876543210"
  email?: string; // lower-case; set for walk-in registrations and from Google sign-in
  notificationPrefs: {
    push: boolean;
    quietMode: boolean;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Plain copy of a car, stamped onto bookings, jobs and invoices so history still
// reads correctly after the vehicle record is permanently deleted.
export interface VehicleSnapshot {
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  photoUrl: string | null;
}

// One tombstone per permanently deleted car (doc id == the old vehicleId).
// Keeps the snapshot and owner so history lists can still label the car.
export interface DeletedVehicle {
  id: string; // == former vehicleId
  tenantId: string;
  ownerId: string;
  snapshot: VehicleSnapshot;
  deletedAt: string;
  deletedBy: string;
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
