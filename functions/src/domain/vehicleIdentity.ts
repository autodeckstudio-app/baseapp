import type { Vehicle } from "@autodeck/core";

export const normalizeVehiclePlate = (plate: string): string => plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Plate identity only. Make, model, year and colour never imply a duplicate. */
export function matchingVehicles(rows: Vehicle[], plate: string): Vehicle[] {
  const target = normalizeVehiclePlate(plate);
  return rows.filter((v) => normalizeVehiclePlate(v.registrationNumber ?? "") === target);
}
