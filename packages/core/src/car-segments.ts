import type { VehicleCategory } from "./types/index.js";

/**
 * Market segments a customer can pick for a car. The stored value is the server's
 * pricing category, so no server change is needed: MUV / XUV is stored as "van".
 * "luxury" is not a segment. Old cars saved as "luxury" read as SUV everywhere.
 */
export const CAR_SEGMENTS: Array<{ value: VehicleCategory; label: string }> = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "van", label: "MUV / XUV" },
];

/** Staff can also book commercial vehicles. */
export const STAFF_SEGMENTS: Array<{ value: VehicleCategory; label: string }> = [
  ...CAR_SEGMENTS,
  { value: "commercial", label: "Commercial" },
];

/** Map any stored category onto a segment. Legacy "luxury" becomes "suv". */
export function normalizeSegment(value: unknown): VehicleCategory | null {
  if (value === "luxury") return "suv";
  return STAFF_SEGMENTS.some((s) => s.value === value) ? (value as VehicleCategory) : null;
}

export function segmentLabel(value: unknown): string | null {
  const seg = normalizeSegment(value);
  return seg ? (STAFF_SEGMENTS.find((s) => s.value === seg)?.label ?? null) : null;
}
