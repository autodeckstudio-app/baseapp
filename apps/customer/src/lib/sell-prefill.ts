import type { Vehicle } from "@autodeck/core";
import type { SellForm } from "./sell-validation";

/** Fields a garage car can fill on the sell form. Anything the garage does not know stays as it was. */
export function sellPrefillFromVehicle(v: Pick<Vehicle, "make" | "model" | "year" | "color" | "odometer" | "registrationNumber">): Partial<SellForm> {
  return {
    make: v.make ?? "",
    model: v.model ?? "",
    year: v.year ? String(v.year) : "",
    colour: v.color ?? "",
    km: v.odometer !== null && v.odometer !== undefined ? String(v.odometer) : "",
    reg: v.registrationNumber ?? "",
  };
}

/** Chip label for a garage car. */
export function sellCarLabel(v: Pick<Vehicle, "make" | "model" | "registrationNumber">): string {
  return `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber;
}
