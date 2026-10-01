"use client";

import { httpsCallable } from "firebase/functions";
import type {
  Service,
  ServiceCategory,
  VehicleCategory,
  VehicleCategoryPricing,
  BayType,
  PriceBreakdown,
  PriceSnapshot,
  WarrantyDurationUnit,
} from "@autodeck/core";
import { collection, getDocs, query, where } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

export async function getServiceCatalogue(category?: ServiceCategory): Promise<Service[]> {
  const fn = httpsCallable<{ category?: ServiceCategory }, { services: Service[] }>(
    functions,
    "getServiceCatalogue",
  );
  const result = await fn(category !== undefined ? { category } : {});
  return result.data.services;
}

// The callable returns active services only. Hidden ones are read directly so the
// owner can bring them back (Firestore rules allow tenant-scoped reads).
export async function getServicesIncludingHidden(): Promise<Service[]> {
  const active = await getServiceCatalogue();
  const tenantId = active[0]?.tenantId;
  if (!tenantId) return active;
  const snap = await getDocs(query(collection(db, COLLECTIONS.services()), where("tenantId", "==", tenantId), where("active", "==", false)));
  const hidden = snap.docs.map((d) => d.data() as Service);
  return [...active, ...hidden];
}

// Reuses the server-side pricing engine - the admin app never computes prices itself.
export async function calculateServicePrice(
  serviceId: string,
  vehicleCategory: VehicleCategory,
): Promise<{ breakdown: PriceBreakdown; snapshot: PriceSnapshot }> {
  const fn = httpsCallable<
    { serviceId: string; vehicleCategory: VehicleCategory },
    { breakdown: PriceBreakdown; snapshot: PriceSnapshot }
  >(functions, "calculateServicePrice");
  const result = await fn({ serviceId, vehicleCategory });
  return result.data;
}

export interface CreateServiceInput {
  name: string;
  category: ServiceCategory;
  brand: string | null;
  description: string;
  basePrice: number; // paise
  currency?: string;
  estimatedDurationMinutes: number;
  warrantyLabel: string | null;
  warrantyDurationValue: number | null;
  warrantyDurationUnit: WarrantyDurationUnit | null;
  vehicleCategoryPricing?: VehicleCategoryPricing[];
  requiredBayType?: BayType;
  membershipWashEligible?: boolean;
  displayOrder?: number;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const fn = httpsCallable<CreateServiceInput, { service: Service }>(functions, "createService");
  const result = await fn(input);
  return result.data.service;
}

export type UpdateServiceInput = Partial<CreateServiceInput> & { serviceId: string };

export async function updateService(input: UpdateServiceInput): Promise<void> {
  const fn = httpsCallable(functions, "updateService");
  await fn(input);
}

export async function setServiceActive(serviceId: string, active: boolean): Promise<void> {
  const fn = httpsCallable(functions, "setServiceActive");
  await fn({ serviceId, active });
}
