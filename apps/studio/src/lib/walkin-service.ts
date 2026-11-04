import { httpsCallable } from "firebase/functions";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import { searchCustomersAnyField } from "./lookup-service";
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
  );
  const snap = await getDocs(q);
  // Client-side filter: null-equality would hide legacy cars predating the field.
  return snap.docs.map((d) => d.data() as Vehicle).filter((v) => !v.deletedAt);
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

export async function findCustomersByEmail(tenantId: string, email: string): Promise<Customer[]> {
  const q = query(collection(db, COLLECTIONS.customers()), where("tenantId", "==", tenantId), where("email", "==", email.trim().toLowerCase()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Customer);
}

/** New walk-in customer by email. Returns the existing customer if that email already has a login. */
type WalkinIntakeResult =
  | { existingAccount: true }
  | { existingAccount: false; customerId: string; alreadyRegistered: boolean };

export async function registerWalkinCustomer(input: { name: string; email: string; phone?: string }): Promise<{ customer: Customer; created: boolean }> {
  const fn = httpsCallable<typeof input, WalkinIntakeResult>(functions, "createWalkinCustomer");
  const result = (await fn(input)).data;
  if (result.existingAccount) {
    // Flat by design: the counter learns only that this email already has an app account.
    throw new Error("This email already has an AutoDeck account. Find them by name, phone or plate instead.");
  }
  const snap = await getDoc(doc(db, COLLECTIONS.customers(), result.customerId));
  if (!snap.exists()) throw new Error("Registration did not complete. Please try again.");
  return { customer: snap.data() as Customer, created: !result.alreadyRegistered };
}

/**
 * Issues the one-time counter claim code for an UNCLAIMED staged record.
 * The code is returned ONCE here and never stored client-side; show it to
 * the customer in person. Reissues revoke the previous code and are capped.
 */
export async function issueClaimCode(customerId: string): Promise<{ code: string; expiresAt: string }> {
  const fn = httpsCallable<{ customerId: string }, { code: string; expiresAt: string }>(functions, "issueClaimCode");
  return (await fn({ customerId })).data;
}

export const findCustomersBySearch = searchCustomersAnyField;
