// Pure checklist-template builder — no Firebase imports, fully unit-testable.
// Mirrors the pure-function pattern of pricing.ts/warranty-builder.ts.
//
// Deliberately scoped to AutoDeck's detailing/protection business: exterior,
// glass, and interior condition are checked for every job; a service-specific
// section is added only for categories where it's meaningful (PPF, ceramic,
// coating, washing). This is never a general mechanical-repair inspection —
// categories with no defined detailing-relevant checklist (inspection,
// tinting, other) get the base three sections only, nothing invented.
import type { ServiceCategory, InspectionArea, InspectionChecklistItem, InspectionRating } from "@autodeck/core";

interface ItemTemplate {
  key: string;
  label: string;
  area: InspectionArea;
}

const EXTERIOR: ItemTemplate[] = [
  { key: "paint_condition", label: "Paint condition", area: "exterior" },
  { key: "scratches", label: "Scratches", area: "exterior" },
  { key: "dents", label: "Dents", area: "exterior" },
  { key: "swirl_marks", label: "Swirl marks", area: "exterior" },
  { key: "oxidation", label: "Oxidation", area: "exterior" },
  { key: "water_spots", label: "Water spots", area: "exterior" },
  { key: "contamination", label: "Surface contamination", area: "exterior" },
];

const GLASS: ItemTemplate[] = [
  { key: "windshield_condition", label: "Windshield condition", area: "glass" },
  { key: "glass_coating_condition", label: "Glass coating condition", area: "glass" },
  { key: "chips_cracks", label: "Chips / cracks", area: "glass" },
];

const INTERIOR: ItemTemplate[] = [
  { key: "seats", label: "Seats", area: "interior" },
  { key: "dashboard", label: "Dashboard", area: "interior" },
  { key: "carpets_mats", label: "Carpets & mats", area: "interior" },
  { key: "stains_odor", label: "Stains / odor", area: "interior" },
  { key: "trim", label: "Trim", area: "interior" },
];

const SERVICE_SPECIFIC: Partial<Record<ServiceCategory, ItemTemplate[]>> = {
  ppf: [
    { key: "existing_film", label: "Existing film", area: "service_specific" },
    { key: "damaged_film", label: "Damaged film", area: "service_specific" },
    { key: "affected_panels", label: "Affected panels", area: "service_specific" },
  ],
  ceramic: [
    { key: "existing_coating", label: "Existing coating", area: "service_specific" },
    { key: "water_behavior", label: "Water behavior", area: "service_specific" },
    { key: "surface_contamination", label: "Surface contamination", area: "service_specific" },
  ],
  coating: [
    { key: "existing_coating", label: "Existing coating", area: "service_specific" },
    { key: "affected_panels", label: "Affected panels", area: "service_specific" },
  ],
  washing: [
    { key: "exterior_condition", label: "Exterior condition", area: "service_specific" },
    { key: "interior_condition", label: "Interior condition", area: "service_specific" },
    { key: "special_observations", label: "Special observations", area: "service_specific" },
  ],
};

export function buildInspectionChecklist(serviceCategory: ServiceCategory): InspectionChecklistItem[] {
  const templates = [...EXTERIOR, ...GLASS, ...INTERIOR, ...(SERVICE_SPECIFIC[serviceCategory] ?? [])];
  return templates.map((t) => ({
    key: t.key,
    label: t.label,
    area: t.area,
    rating: null as InspectionRating | null,
    notes: null,
  }));
}
