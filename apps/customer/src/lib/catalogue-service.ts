import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Service, ServiceCategory, VehicleCategory, PriceBreakdown, PriceSnapshot } from "@autodeck/core";

export async function getServiceCatalogue(category?: ServiceCategory): Promise<Service[]> {
  const fn = httpsCallable<{ category?: ServiceCategory }, { services: Service[] }>(
    functions,
    "getServiceCatalogue",
  );
  const result = await fn(category !== undefined ? { category } : {});
  return result.data.services;
}

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
