
// Display projection mirrored from the final Customer catalogue. No persisted service changes.
import type { Service } from './types/service';
import { uniqueServices, type ServiceHomeKey } from './service-homes';
import { customerOfferingVisible } from './customer-offering-visibility';
import { customerCatalogueEligible } from './customer-catalogue-eligibility';
import sharedReferences from './brand-enquiries.json';
export type BrandEnquiry={key:string;brand:string|null;name:string;group:'ppf'|'coatings';note:string;source?:string;surface?:string;level?:'brand';customerMenu?:{home:'paint'|'detailing'|'washing'|'garage'|'modifications';family:string}};
export const BRAND_ENQUIRIES=(sharedReferences as BrandEnquiry[]).filter(customerOfferingVisible);
export const HOME_COPY: Record<ServiceHomeKey, string> = {
  paint: "Ceramic coating, paint protection film and spray",
  detailing: "Care for fabric, glass, leather, wheels and trim",
  washing: "Exterior washes and interior cleaning",
  garage: "Inspection, diagnostics and repair care",
  modifications: "Colour film, wraps, tint and accessories",
};
/** Short category summaries. Exact products, coverage and terms stay on the detail page. */
export const FAMILY_COPY: Record<string, string> = {
  Ceramic: "Ceramic paint coatings",
  PPF: "Film fitting, removal or replacement",
  PPS: "Spray-on paint protection",
  "Colour PPF": "Coloured and black protection films",
  Wraps: "Full or partial vinyl wraps",
  "Window tint": "Window films, quoted for your car",
  "Accessories & styling": "Accessories, quoted per job",
  "Exterior wash": "Exterior wash and dry",
  "Interior cleaning": "Seats, mats and interior cleaning",
  "Complete wash": "Interior and exterior cleaning",
  "Headlight restoration": "Headlight restoration and buffing",
  "Wheels & tyres": "Wheel alignment and balancing",
  "Battery & electrical": "Battery and charging checks",
  "AC care": "Cooling and leak checks",
  Repairs: "Inspect first, then quote repairs",
  Inspection: "Car checks and condition report",
  Fabric: "Coatings for seats and mats",
  Leather: "Coatings for leather seats and trim",
  Glass: "Water-repellent glass coatings",
  "Film aftercare": "Care coatings for protection film",
  "Lights & plastics": "Coatings for lights and plastics",
  "Tyres & rubber": "Care for tyres and rubber",
  "Wheels & trim": "Coatings for wheels and trim",
  "Trim restoration": "Faded trim restoration and coating",
  Maintenance: "Coating maintenance top-ups",
  "Paint sealant": "Paint sealants for shine and care",
  "Surface care": "Care for your car's surfaces",
};
export function servicePlacement(
  s: Pick<Service, "id" | "name" | "category" | "description" | "customerMenu">,
): { home: ServiceHomeKey; family: string } | null {
  if(s.customerMenu)return {home:s.customerMenu.home,family:s.customerMenu.family};
  const n = s.name.toLowerCase(),
    d = (s.description ?? "").toLowerCase();
  if (s.category === "pickup") return null;
  if (s.category === "washing")
    return {
      home: "washing",
      family: /headlight/.test(n)
        ? "Headlight restoration"
        : /interior/.test(n)
          ? "Interior cleaning"
          : /spa|full detail/.test(n)
            ? "Complete wash"
            : "Exterior wash",
    };
  if (["garage", "inspection", "other"].includes(s.category))
    return {
      home: "garage",
      family: /alignment|wheel|tyre/.test(n)
        ? "Wheels & tyres"
        : /battery/.test(n)
          ? "Battery & electrical"
          : /\bac\b|air con/.test(n)
            ? "AC care"
            : /repair/.test(n)
              ? "Repairs"
              : "Inspection",
    };
  if (s.category === "tinting") return {home:"modifications",family:"Window tint"};
  if (
    /colou?r.*ppf|colou?r.*film/.test(n) ||
    ["modifications", "tinting"].includes(s.category)
  )
    return {
      home: "modifications",
      family:
        /ppf|film/.test(n) && !/window/.test(n)
          ? "Colour PPF"
          : /wrap/.test(n)
            ? "Wraps"
            : /tint|window/.test(n)
              ? "Window tint"
              : "Accessories & styling",
    };
  if (s.category === "ppf") return { home: "paint", family: "PPF" };
  if (/\bpps\b|spray.on paint protection/.test(n))
    return { home: "paint", family: "PPS" };
  if (s.category === "ceramic") return { home: "paint", family: "Ceramic" };
  if (s.category === "coating") {
    const family = /fabric/.test(n)
      ? "Fabric"
      : /leather/.test(n)
        ? "Leather"
        : /glass|gforce/.test(n)
          ? "Glass"
          : /skin|halo|overlay/.test(n)
            ? "Film aftercare"
            : /dlight/.test(n)
              ? "Lights & plastics"
              : /blackout/.test(n)
                ? "Tyres & rubber"
                : /wheel|rims|dlux|raptor|talon/.test(n)
                  ? "Wheels & trim"
                  : /trim|restore/.test(n)
                    ? "Trim restoration"
                    : /maintenance/.test(n)
                      ? "Maintenance"
                      : /teflon|sealant/.test(n)
                        ? "Paint sealant"
                        : /wheel|rims/.test(d)
                          ? "Wheels & trim"
                          : "Surface care";
    return { home: "detailing", family };
  }
  return { home: "modifications", family: "Custom work" };
}
export function referencePlacement(r: BrandEnquiry): {
  home: ServiceHomeKey;
  family: string;
} {
  // Owner taxonomy (5 Nov): black/white/colour films live under
  // Modifications & Wraps > Colour PPF, not under Paint Protection.
  if(r.customerMenu)return r.customerMenu;
  if (r.surface === "colour-ppf")
    return { home: "modifications", family: "Colour PPF" };
  if (r.group === "ppf")
    return { home: "paint", family: r.key === "pps-spray" ? "PPS" : "PPF" };
  const surface = r.surface ?? "";
  const map: Record<string, string> = {
    fabric: "Fabric",
    glass: "Glass",
    leather: "Leather",
    "maintenance-coating": "Maintenance",
    sealant: "Paint sealant",
    trim: "Trim restoration",
    wheel: "Wheels & trim",
    "ppf-coat": "Film aftercare",
  };
  return map[surface]
    ? { home: "detailing", family: map[surface] ?? "Ceramic" }
    : { home: "paint", family: "Ceramic" };
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** A reference is not another product when the same exact named/brand range is already published. Different tiers remain distinct. */
export function referenceChoices(
  xs: Service[],
  refs: BrandEnquiry[] = BRAND_ENQUIRIES,
): BrandEnquiry[] {
  if(xs.some(row=>row.catalogueEntryKind==='enquiry'))return referenceChoices(xs.filter(row=>row.catalogueEntryKind!=='enquiry'),xs.filter(row=>row.catalogueEntryKind==='enquiry'&&row.active===true).map(row=>({key:row.referenceKey as string,brand:row.brand,name:row.name,group:row.referenceGroup as BrandEnquiry["group"],note:row.description,...(row.referenceSurface?{surface:row.referenceSurface}:{}),...(row.customerMenu?{customerMenu:{home:row.customerMenu.home,family:row.customerMenu.family}}:{})}))); 
  return refs.filter(
    (r) =>
      customerOfferingVisible(r) &&
      !(referencePlacement(r).home==='detailing'&&xs.some(s=>s.active===true&&s.brand===null&&s.customerMenu?.home==='detailing'&&s.customerMenu.family===referencePlacement(r).family)) &&
      !xs.some(
        (s) =>
          s.productKey === r.key ||
          (norm(s.brand ?? "") === norm(r.brand ?? "") &&
            norm(s.name) === norm(`${r.brand ?? ""} ${r.name}`)),
      ),
  );
}

export function alignedCustomerServices(xs:readonly Service[]):Service[]{return uniqueServices(xs).filter(s=>s.catalogueEntryKind!=='enquiry'&&s.active===true&&customerOfferingVisible(s)&&customerCatalogueEligible(s)&&servicePlacement(s)!==null).sort((a,b)=>(a.displayOrder??0)-(b.displayOrder??0)||a.name.localeCompare(b.name));}
export function isOnCustomerMenu(s:Service):boolean{return alignedCustomerServices([s]).length===1;}
