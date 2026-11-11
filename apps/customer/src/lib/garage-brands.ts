import type { Vehicle } from "@autodeck/core";

/** Make, never model/year/plate, defines a brand filter. Missing makes form one explicit group. */
export function garageBrand(car: Pick<Vehicle, "make">): { key: string; label: string } {
  const label = (car.make ?? "").trim().replace(/\s+/g, " ");
  return label ? { key: label.toLocaleLowerCase("en-IN"), label } : { key: "__unknown_brand__", label: "Other" };
}
export function garageBrands(cars: Vehicle[]): Array<{ key: string; label: string }> {
  const brands = new Map<string, { key: string; label: string }>();
  for (const car of cars) { const brand = garageBrand(car); if (!brands.has(brand.key)) brands.set(brand.key, brand); }
  return [...brands.values()];
}
export function garageCarsForBrand(cars: Vehicle[], key: string | null): Vehicle[] {
  return key === null ? cars : cars.filter(car => garageBrand(car).key === key);
}
