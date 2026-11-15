// Service editor draft: every number is a string while typing (so an empty
// field is distinct from 0) and money is in rupees. toServicePayload turns
// it into the stored shape (paise, integers) or explains what's wrong.
import {customerServiceName,servicePlacement,reviewedStartingPrice} from "@autodeck/core";
import type { BayType, Service, ServiceCategory, VehicleCategory, VehicleCategoryPricing, WarrantyDurationUnit } from "@autodeck/core";

export interface SizeRuleDraft { vehicleCategory: VehicleCategory; extraRupees: string; extraMinutes: string }
export interface ServiceDraft {
  catalogueEntryKind?:'enquiry';referenceKey?:string;referenceGroup?:'ppf'|'coatings';referenceSurface?:string;
  priceEstimate?:boolean;
  customerMenu?: NonNullable<Service["customerMenu"]>;
  originalPriceMode?:"fixed"|"from"|"consult";
  serviceId: string | null;
  internalRating?: "A" | "B" | "C" | "D" | null;
  ratingChanged?: boolean;
  name: string;
  category: ServiceCategory;
  brand: string;
  description: string;
  internalNotes: string;
  priceRupees: string;
  minutes: string;
  warrantyLabel: string;
  careTips: string[];
  warrantyUnit: WarrantyDurationUnit | "";
  warrantyValue: string;
  bay: BayType;
  displayOrder: string;
  washEligible: boolean;
  sizes: SizeRuleDraft[];
  imageUrl: string;
  imageChanged?: boolean;
  coverageLevel: "" | "high_impact" | "full_front" | "full_body";
  priceMode: "fixed" | "from" | "consult";
}

export const EMPTY_SERVICE: ServiceDraft = {
  serviceId: null, name: "", category: "washing", brand: "", description: "", internalNotes: "", priceRupees: "", minutes: "60",
  warrantyLabel: "", careTips: [], warrantyUnit: "", warrantyValue: "", bay: "wash", displayOrder: "0", washEligible: false, sizes: [], imageUrl: "", coverageLevel: "", priceMode: "fixed",
};

export function draftFromService(s: Service): ServiceDraft {
  return {
    serviceId: s.id,
    ...(s.priceEstimate!==undefined?{priceEstimate:s.priceEstimate}:{}),
    ...(s.catalogueEntryKind?{catalogueEntryKind:s.catalogueEntryKind,referenceKey:s.referenceKey,referenceGroup:s.referenceGroup,...(s.referenceSurface?{referenceSurface:s.referenceSurface}:{})}:{}),
    ...(servicePlacement(s)?{customerMenu:s.customerMenu??{...servicePlacement(s)!,priceMode:reviewedStartingPrice(s)?'from':s.priceOnRequest?'quote':s.priceFrom?'from':'fixed',priceNote:reviewedStartingPrice(s)?.note??'',priceCondition:reviewedStartingPrice(s)?.condition??''}}:{}),
    originalPriceMode:s.priceOnRequest?'consult':s.priceFrom?'from':'fixed',
    name: customerServiceName(s.name),
    ...(s.internalRating !== undefined ? {internalRating:s.internalRating} : {}),
    ratingChanged: false,
    category: s.category,
    brand: s.brand ?? "",
    description: s.description ?? "",
    internalNotes: s.internalNotes ?? "",
    priceRupees: String(s.basePrice / 100),
    minutes: String(s.estimatedDurationMinutes),
    warrantyLabel: s.warrantyLabel ?? "",
    careTips: s.careTips ?? [],
    warrantyUnit: s.warrantyDurationUnit ?? "",
    warrantyValue: s.warrantyDurationValue?.toString() ?? "",
    bay: s.requiredBayType,
    displayOrder: String(s.displayOrder),
    washEligible: s.membershipWashEligible,
    imageUrl: s.imageUrl ?? "",
    coverageLevel: s.coverageLevel ?? "",
    priceMode: s.priceOnRequest === true ? "consult" : s.priceFrom === true ? "from" : "fixed",
    sizes: s.vehicleCategoryPricing.map((r) => ({ vehicleCategory: r.vehicleCategory, extraRupees: String(r.additionalPricePaise / 100), extraMinutes: String(r.additionalMinutes) })),
  };
}

export interface ServicePayload {
  catalogueEntryKind?:'enquiry';referenceKey?:string;referenceGroup?:'ppf'|'coatings';referenceSurface?:string;
  priceEstimate?:boolean;
  customerMenu?:NonNullable<Service["customerMenu"]>;
  internalRating?: "A" | "B" | "C" | "D" | null;
  name: string;
  category: ServiceCategory;
  brand: string | null;
  description: string;
  basePrice: number;
  estimatedDurationMinutes: number;
  warrantyLabel: string | null;
  careTips: string[];
  warrantyDurationValue: number | null;
  warrantyDurationUnit: WarrantyDurationUnit | null;
  requiredBayType: BayType;
  displayOrder: number;
  membershipWashEligible: boolean;
  vehicleCategoryPricing: VehicleCategoryPricing[];
  // Only sent once a photo has been uploaded, so saves from before the photo feature stay unchanged.
  imageUrl?: string | null;
  coverageLevel: "high_impact" | "full_front" | "full_body" | null;
  priceFrom: boolean;
  priceOnRequest: boolean;
}

const paise = (rupees: string) => Math.round(Number(rupees) * 100);

export function toServicePayload(d: ServiceDraft): { ok: true; payload: ServicePayload } | { ok: false; problem: string } {
  if(d.customerMenu&&(!['paint','detailing','washing','garage','modifications'].includes(d.customerMenu.home)||!d.customerMenu.family.trim()))return{ok:false,problem:'Choose a Customer section and service group.'};
  if (!d.name.trim()) return { ok: false, problem: "Give the service a name." };
  if (!d.description.trim()) return { ok: false, problem: "Add a short description customers will read." };
  if(d.catalogueEntryKind==='enquiry'&&(d.priceMode!=='consult'||Number(d.priceRupees)!==0||Number(d.minutes)!==0))return{ok:false,problem:'An enquiry has no booking price or duration.'};
  const price = Number(d.priceRupees);
  if (!Number.isFinite(price) || price < 0 || (d.priceMode !== "consult" && (!d.priceRupees.trim() || price <= 0))) return { ok: false, problem: "Starting price must be more than ₹0." };
  const minutes = Number(d.minutes);
  if (!Number.isInteger(minutes) || (d.catalogueEntryKind==='enquiry'?minutes!==0:minutes<=0)) return { ok: false, problem: "Time needed must be a whole number of minutes." };
  const order = Number(d.displayOrder || "0");
  if (!Number.isInteger(order)) return { ok: false, problem: "Position must be a whole number." };

  let warrantyDurationValue: number | null = null;
  let warrantyDurationUnit: WarrantyDurationUnit | null = null;
  if (d.warrantyUnit === "lifetime") warrantyDurationUnit = "lifetime";
  else if (d.warrantyUnit) {
    const n = Number(d.warrantyValue);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, problem: "Warranty length must be a whole number, or pick Lifetime." };
    warrantyDurationValue = n;
    warrantyDurationUnit = d.warrantyUnit;
  }

  const seen = new Set<string>();
  const vehicleCategoryPricing: VehicleCategoryPricing[] = [];
  for (const r of d.sizes) {
    if (seen.has(r.vehicleCategory)) return { ok: false, problem: "Each car size can only have one price rule." };
    seen.add(r.vehicleCategory);
    const extra = Number(r.extraRupees || "0");
    const mins = Number(r.extraMinutes || "0");
    if (!Number.isFinite(extra) || extra < 0) return { ok: false, problem: "Extra price for a car size can't be negative." };
    if (!Number.isInteger(mins) || mins < 0) return { ok: false, problem: "Extra time must be a whole number of minutes." };
    vehicleCategoryPricing.push({ vehicleCategory: r.vehicleCategory, additionalPricePaise: paise(r.extraRupees || "0"), additionalMinutes: mins });
  }

  return {
    ok: true,
    payload: {
      ...(d.catalogueEntryKind?{catalogueEntryKind:d.catalogueEntryKind,referenceKey:d.referenceKey!,referenceGroup:d.referenceGroup!,...(d.referenceSurface?{referenceSurface:d.referenceSurface}:{})}:{}),
      ...(d.priceEstimate!==undefined?{priceEstimate:d.priceEstimate}:{}),
      name: customerServiceName(d.name.trim()),
      ...(d.customerMenu?{customerMenu:{...d.customerMenu,...(d.originalPriceMode!==undefined&&d.originalPriceMode===d.priceMode?{}:{priceMode:d.priceMode==='consult'?'quote':d.priceMode}),...(d.priceMode==='fixed'?{priceNote:'',priceCondition:''}:{})}}:{}),
      ...(d.ratingChanged ? {internalRating: d.internalRating ?? null} : {}),
      category: d.category,
      brand: d.brand.trim() || null,
      description: d.description.trim(),
      basePrice: paise(d.priceRupees),
      estimatedDurationMinutes: minutes,
      warrantyLabel: d.warrantyLabel.trim() || null,
      careTips: d.careTips.map((t) => t.trim()).filter(Boolean),
      warrantyDurationValue,
      warrantyDurationUnit,
      requiredBayType: d.bay,
      displayOrder: order,
      membershipWashEligible: d.washEligible,
      vehicleCategoryPricing,
      coverageLevel: d.coverageLevel || null,
      priceFrom: d.priceMode === "from",
      priceOnRequest: d.priceMode === "consult",
      ...(d.imageChanged ? { imageUrl: d.imageUrl || null } : d.imageUrl ? { imageUrl: d.imageUrl } : {}),
    },
  };
}
