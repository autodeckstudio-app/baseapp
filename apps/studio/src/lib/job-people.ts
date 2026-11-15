import type { ServiceJob } from "@autodeck/core";

export interface VehicleLite { make: string; model: string; registrationNumber: string }

/** "Toyota Land Cruiser · GJ 01 AB 1234", or whatever part is known. */
export function carLabel(v: Partial<VehicleLite> | null | undefined): string | undefined {
  if (!v) return undefined;
  const name = [v.make, v.model].filter(Boolean).join(" ");
  const label = [name, v.registrationNumber].filter(Boolean).join(" \u00b7 ");
  return label || undefined;
}

/** The car for a job: the live vehicle record, else the copy saved on the job. */
export function jobCar(job: ServiceJob, vehicles: Record<string, VehicleLite | undefined>): string | undefined {
  return carLabel(vehicles[job.vehicleId] ?? job.vehicleSnapshot);
}
