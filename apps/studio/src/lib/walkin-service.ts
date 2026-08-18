import { httpsCallable } from "firebase/functions";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Customer, Vehicle, VehicleCategory, PriceBreakdown, PriceSnapshot } from "@autodeck/core";

// Phone-number lookup among EXISTING customers only — doc20 V1 scope
// explicitly excludes a full customer-creation form from the studio app.
// Permitted directly under the /customers rule (isStudioOrAbove(), no
// per-document ownership check) as long as tenantId is constrained.
export async function findCustomersByPhone(tenantId: string, phone: string): Promise<Customer[]> {
  const q = query(
    collection(db, COLLECTIONS.customers()),
    where("tenantId", "==", tenantId),
    where("phone", "==", phone),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Customer);
}

export async function getVehiclesForCustomer(tenantId: string, ownerId: string): Promise<Vehicle[]> {
  const q = query(
    collection(db, COLLECTIONS.vehicles()),
    where("ownerId", "==", ownerId),
    where("tenantId", "==", tenantId),
    where("deletedAt", "==", null),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Vehicle);
}

interface CreateVehicleForCustomerInput {
  ownerId: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  category?: VehicleCategory;
}
type CreateVehicleOutput = { vehicle: Vehicle };

export async function createVehicleForCustomer(input: CreateVehicleForCustomerInput): Promise<Vehicle> {
  const fn = httpsCallable<CreateVehicleForCustomerInput, CreateVehicleOutput>(functions, "createVehicle");
  const result = await fn(input);
  return result.data.vehicle;
}

type CalculateServicePriceInput = { serviceId: string; vehicleCategory: VehicleCategory };
type CalculateServicePriceOutput = { breakdown: PriceBreakdown; snapshot: PriceSnapshot };

// Reuses the exact same pricing engine as bookings — never computed client-side.
export async function previewServicePrice(
  serviceId: string,
  vehicleCategory: VehicleCategory,
): Promise<CalculateServicePriceOutput> {
  const fn = httpsCallable<CalculateServicePriceInput, CalculateServicePriceOutput>(
    functions,
    "calculateServicePrice",
  );
  const result = await fn({ serviceId, vehicleCategory });
  return result.data;
}

// createWalkinJob already exists in studio-service.ts — reused from there,
// not duplicated here.
