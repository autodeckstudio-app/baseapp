// The service menu: ONE source of truth for how AutoDeck's services are grouped,
// branded, tiered and priced. Every app (customer, admin, studio, site) and the
// seed script read this. Change the structure here, not in a screen.
//
// Structure and anchor prices come from the market study approved by the owner:
// price what can be judged from a photo, quote what has to be touched.
import type { CoverageLevel, ServiceCategory, VehicleCategory } from "./types/service.js";

export type MenuGroupKey = "wash" | "coatings" | "ppf" | "garage" | "mods" | "pickup";

export interface MenuGroup {
  key: MenuGroupKey;
  label: string;
  blurb: string;
  /** Stored service categories that belong to this group. */
  categories: ServiceCategory[];
  /** priced = published prices, consult = quote only, mixed = published menu plus consult items. */
  pricing: "priced" | "consult" | "mixed";
  /** Grouped by brand inside the group. */
  byBrand: boolean;
}

export const MENU_GROUPS: MenuGroup[] = [
  { key: "wash", label: "Wash & Care", blurb: "Hand washes and interior cleaning, priced by car size.", categories: ["washing"], pricing: "priced", byBrand: false },
  { key: "coatings", label: "Coatings", blurb: "Ceramic and graphene coatings by brand, with add-ons for glass, wheels and interior.", categories: ["ceramic", "coating"], pricing: "priced", byBrand: true },
  { key: "ppf", label: "PPF", blurb: "Paint protection film by brand and coverage.", categories: ["ppf"], pricing: "mixed", byBrand: true },
  { key: "garage", label: "Garage", blurb: "Health checks with published prices. Repairs start with an inspection.", categories: ["garage", "inspection", "other"], pricing: "mixed", byBrand: false },
  { key: "mods", label: "Modifications & wraps", blurb: "Tint, wraps and styling. We quote after seeing the car.", categories: ["modifications", "tinting"], pricing: "consult", byBrand: false },
  { key: "pickup", label: "Pickup & drop", blurb: "Flat-rate pickup and drop for your car.", categories: ["pickup"], pricing: "priced", byBrand: false },
];

export function menuGroupOf(category: ServiceCategory): MenuGroup {
  return MENU_GROUPS.find((g) => g.categories.includes(category)) ?? (MENU_GROUPS[3] as MenuGroup);
}

/** Garage sections, in display order. Services are placed by id so no stored data changes. */
export const GARAGE_SECTIONS = ["Health checks", "Wheels and tyres", "Repairs"] as const;
const GARAGE_SECTION_BY_ID: Record<string, (typeof GARAGE_SECTIONS)[number]> = {
  "menu-garage-inspection": "Health checks",
  "menu-garage-ac": "Health checks",
  "menu-garage-battery": "Health checks",
  "menu-garage-alignment": "Wheels and tyres",
  "menu-garage-repairs": "Repairs",
};
/** Repairs is quote only: inspection first, quote after. Unknown garage services land in Health checks. */
export function garageSectionOf(serviceId: string): (typeof GARAGE_SECTIONS)[number] {
  return GARAGE_SECTION_BY_ID[serviceId] ?? "Health checks";
}

/** Popular-services chips: the six menu groups except pickup. */
export const MENU_CHIPS: MenuGroupKey[] = ["wash", "coatings", "ppf", "garage", "mods"];

export const COATING_BRANDS = ["Fireball", "Kovalent", "3M", "AutoDeck Care"] as const;
export const PPF_BRANDS = ["Garware", "XPEL", "LLumar", "3M"] as const;

export const COVERAGE_LEVELS: Array<{ key: CoverageLevel; label: string; blurb: string }> = [
  { key: "high_impact", label: "High-impact kit", blurb: "Bonnet, bumper, mirrors and the panels that take stone chips." },
  { key: "full_front", label: "Full front", blurb: "Bonnet, bumper, fenders, mirrors and headlights." },
  { key: "full_body", label: "Full body", blurb: "Every painted panel." },
];

// Size tiers shown to customers. A car's stored category maps onto one of them.
export type SizeTierKey = "hatch" | "sedan_suv" | "luxury";
export const SIZE_TIERS: Array<{ key: SizeTierKey; label: string; vehicles: VehicleCategory[]; /** Added to the hatchback price, as a fraction. */ uplift: number }> = [
  { key: "hatch", label: "Hatchback", vehicles: ["hatchback"], uplift: 0 },
  { key: "sedan_suv", label: "Sedan / SUV", vehicles: ["sedan", "suv", "commercial", "van"], uplift: 0.25 },
  { key: "luxury", label: "Luxury", vehicles: ["luxury"], uplift: 0.6 },
];

export function sizeTierOf(vehicle: VehicleCategory | null | undefined): SizeTierKey {
  return SIZE_TIERS.find((t) => vehicle && t.vehicles.includes(vehicle))?.key ?? "hatch";
}

/** Paise surcharge per vehicle category for a hatchback base price, per the size tiers above. */
export function sizePricingFor(basePaise: number) {
  return (["hatchback", "sedan", "suv", "luxury", "commercial", "van"] as VehicleCategory[]).map((v) => {
    const tier = SIZE_TIERS.find((t) => t.vehicles.includes(v)) ?? (SIZE_TIERS[0] as (typeof SIZE_TIERS)[number]);
    return { vehicleCategory: v, additionalPricePaise: Math.round((basePaise * tier.uplift) / 100) * 100, additionalMinutes: 0 };
  });
}

/** Shown under every coating and PPF price. */
export const PAINT_INSPECTION_NOTE = "Final price confirmed after paint inspection.";

/** Does a service carry the inspection note? Coatings and PPF do; consult items are quoted anyway. */
export function needsInspectionNote(category: ServiceCategory): boolean {
  return category === "ceramic" || category === "coating" || category === "ppf";
}

/** Menu price line for a service, given the viewer's size tier (null = unknown, show the hatchback entry price). */
export function menuPriceText(
  s: { category: ServiceCategory; basePrice: number; priceOnRequest?: boolean | undefined; priceFrom?: boolean | undefined; vehicleCategoryPricing?: Array<{ vehicleCategory: VehicleCategory; additionalPricePaise: number }> | undefined },
  vehicle: VehicleCategory | null | undefined,
  rupees: (paise: number) => string,
): { text: string; consult: boolean; note: string | null } {
  if (s.priceOnRequest === true) return { text: "Consult", consult: true, note: null };
  const extra = vehicle ? (s.vehicleCategoryPricing?.find((p) => p.vehicleCategory === vehicle)?.additionalPricePaise ?? 0) : 0;
  const amount = rupees(s.basePrice + extra);
  const from = s.priceFrom === true || !vehicle;
  return { text: from ? `From ${amount}` : amount, consult: false, note: needsInspectionNote(s.category) ? PAINT_INSPECTION_NOTE : null };
}

// ---------------------------------------------------------------------------
// Seeded menu. Anchor prices (hatchback, rupees) are the study's ranges; the owner
// tunes them in admin. Sedan/SUV and luxury scale by SIZE_TIERS. Items marked
// `placeholder` had no anchor in the study and carry an editable starting price.
// ---------------------------------------------------------------------------
export interface MenuSeed {
  id: string;
  name: string;
  group: MenuGroupKey;
  category: ServiceCategory;
  brand: string | null;
  description: string;
  /** Hatchback price in rupees. 0 with consult = quote only. */
  rupees: number;
  consult?: boolean;
  priceFrom?: boolean;
  coverageLevel?: CoverageLevel;
  minutes: number;
  warrantyLabel?: string;
  warrantyYears?: number;
  bay: "wash" | "protection" | "general";
  placeholder?: boolean;
  order: number;
}

const wash = (id: string, name: string, rupees: number, minutes: number, description: string, order: number): MenuSeed => ({ id: `menu-wash-${id}`, name, group: "wash", category: "washing", brand: null, description, rupees, minutes, bay: "wash", order });
const coat = (id: string, name: string, brand: string, rupees: number, years: number | null, description: string, order: number, placeholder = false): MenuSeed => ({
  id: `menu-coat-${id}`, name, group: "coatings", category: "ceramic", brand, description, rupees, minutes: 480, bay: "protection", order, placeholder,
  ...(years ? { warrantyLabel: `${years}-year coating warranty`, warrantyYears: years } : {}),
});
const addon = (id: string, name: string, rupees: number, description: string, order: number): MenuSeed => ({ id: `menu-coat-${id}`, name, group: "coatings", category: "coating", brand: "Add-ons", description, rupees, minutes: 120, bay: "protection", order, placeholder: true });
const ppf = (brand: string, level: CoverageLevel, rupees: number, minutes: number, years: number, order: number): MenuSeed => {
  const label = COVERAGE_LEVELS.find((c) => c.key === level)?.label ?? level;
  return {
    id: `menu-ppf-${brand.toLowerCase()}-${level.replace("_", "-")}`, name: `${brand} ${label}`, group: "ppf", category: "ppf", brand, description: `${brand} paint protection film, ${label.toLowerCase()} coverage.`,
    rupees, minutes, bay: "protection", coverageLevel: level, priceFrom: level === "full_body", warrantyLabel: `${years}-year film warranty`, warrantyYears: years, order,
  };
};

export const MENU_SEED: MenuSeed[] = [
  // Wash & Care
  wash("foam", "Foam wash", 900, 60, "Foam wash, rinse and dry.", 10),
  wash("exterior", "Exterior detail wash", 1500, 90, "Detailed exterior wash with wheels, tyres and door shuts.", 20),
  wash("interior", "Interior deep clean", 4500, 180, "Vacuum, steam clean and conditioning of seats, mats and trim.", 30),
  wash("full", "Full detail wash", 6500, 300, "Interior deep clean and exterior detail wash together.", 40),
  // Coatings by brand
  coat("autodeck-1", "AutoDeck Care Ceramic 1-year", "AutoDeck Care", 10000, 1, "Entry ceramic coating for daily cars.", 100, true),
  coat("autodeck-2", "AutoDeck Care Ceramic 2-year", "AutoDeck Care", 14000, 2, "Entry ceramic coating, two-year protection.", 110, true),
  coat("fireball-1", "Fireball 1-year", "Fireball", 12000, 1, "Fireball ceramic coating, one-year tier.", 120),
  coat("fireball-2", "Fireball 2-year", "Fireball", 16000, 2, "Fireball ceramic coating, two-year tier.", 130),
  coat("fireball-3", "Fireball 3-year", "Fireball", 20000, 3, "Fireball ceramic coating, three-year tier.", 140),
  coat("kovalent-prolong", "Kovalent Prolong", "Kovalent", 22000, null, "Kovalent Prolong ceramic coating.", 150, true),
  coat("kovalent-graphene", "Kovalent Graphene 7-year", "Kovalent", 32000, 7, "Kovalent graphene coating, seven-year tier.", 160),
  coat("kovalent-borophene", "Kovalent Borophene", "Kovalent", 50000, null, "Kovalent flagship coating.", 170),
  coat("3m-ceramic", "3M Ceramic Coating", "3M", 45000, null, "3M ceramic coating, flagship tier.", 180, true),
  // Surface add-ons (pre-quoted, editable)
  addon("glass", "Glass coating", 4000, "Hydrophobic coating for all glass.", 200),
  addon("wheels", "Wheel coating", 5000, "Ceramic coating for wheel faces and barrels.", 210),
  addon("leather", "Leather coating", 6000, "Protective coating for leather seats and trim.", 220),
  addon("fabric", "Fabric coating", 5000, "Stain-repellent coating for fabric seats and mats.", 230),
  addon("trim", "Trim restore and coat", 3500, "Restores faded plastic trim and seals it.", 240),
  // PPF by brand then coverage (Garware 8-year, XPEL and LLumar 10-year, 3M 10-year per brand pages already in the app)
  ppf("Garware", "high_impact", 15000, 1440, 8, 300), ppf("Garware", "full_front", 40000, 1440, 8, 310), ppf("Garware", "full_body", 75000, 2880, 8, 320),
  ppf("XPEL", "high_impact", 25000, 1440, 10, 330), ppf("XPEL", "full_front", 80000, 1440, 10, 340), ppf("XPEL", "full_body", 130000, 2880, 10, 350),
  ppf("LLumar", "high_impact", 22000, 1440, 10, 360), ppf("LLumar", "full_front", 70000, 1440, 10, 370), ppf("LLumar", "full_body", 110000, 2880, 10, 380),
  ppf("3M", "high_impact", 22000, 1440, 10, 390), ppf("3M", "full_front", 65000, 1440, 10, 400), ppf("3M", "full_body", 100000, 2880, 10, 410),
  { id: "menu-ppf-colour", name: "Colour and black PPF", group: "ppf", category: "ppf", brand: "Colour films", description: "Coloured, black and satin films. Priced after we see the car.", rupees: 0, consult: true, minutes: 2880, bay: "protection", order: 420 },
  // Garage: published health checks, rest by inspection
  { id: "menu-garage-inspection", name: "Multi-point inspection", group: "garage", category: "garage", brand: null, description: "Paint, body, underbody, tyres, brakes and fluids checked and reported.", rupees: 1000, minutes: 60, bay: "general", placeholder: true, order: 500 },
  { id: "menu-garage-alignment", name: "Wheel alignment and balancing", group: "garage", category: "garage", brand: null, description: "Four-wheel alignment and balancing.", rupees: 1500, minutes: 90, bay: "general", placeholder: true, order: 510 },
  { id: "menu-garage-ac", name: "AC check", group: "garage", category: "garage", brand: null, description: "Cooling performance, gas level and leak check.", rupees: 800, minutes: 45, bay: "general", placeholder: true, order: 520 },
  { id: "menu-garage-battery", name: "Battery check", group: "garage", category: "garage", brand: null, description: "Battery health, terminals and charging system test.", rupees: 500, minutes: 30, bay: "general", placeholder: true, order: 530 },
  { id: "menu-garage-repairs", name: "Repairs and other work (book an inspection)", group: "garage", category: "garage", brand: null, description: "Tell us what is wrong. We inspect the car and quote the work.", rupees: 0, consult: true, minutes: 60, bay: "general", order: 540 },
  // Modifications and wraps: consult only
  { id: "menu-mods-tint", name: "Window tint", group: "mods", category: "modifications", brand: null, description: "Heat-rejecting window films. Quoted by car and film.", rupees: 0, consult: true, minutes: 180, bay: "general", order: 600 },
  { id: "menu-mods-wrap", name: "Vinyl wraps and colour change", group: "mods", category: "modifications", brand: null, description: "Full and partial wraps. Quoted after seeing the car.", rupees: 0, consult: true, minutes: 2880, bay: "general", order: 610 },
  { id: "menu-mods-styling", name: "Accessories and styling", group: "mods", category: "modifications", brand: null, description: "Accessories and styling work, quoted per job.", rupees: 0, consult: true, minutes: 120, bay: "general", order: 620 },
  // Pickup and drop
  { id: "menu-pickup", name: "Pickup and drop", group: "pickup", category: "pickup", brand: null, description: "We collect your car and bring it back. Flat rate within the city.", rupees: 500, minutes: 60, bay: "general", placeholder: true, order: 700 },
];
