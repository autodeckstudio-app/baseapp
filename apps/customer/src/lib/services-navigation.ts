import {
  SERVICE_HOMES,
  customerOfferingVisible,
  uniqueServices,
  type Service,
  type ServiceHomeKey,
} from "@autodeck/core";
import { BRAND_ENQUIRIES, type BrandEnquiry } from "./brand-enquiries";
export type ServicesPath = {
  home?: ServiceHomeKey | undefined;
  family?: string | undefined;
  brand?: string | undefined;
  work?: string | undefined;
};
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
export function familySummary(family: string): string {
  return FAMILY_COPY[family] ?? `${family} for your car`;
}
/** Display grouping only. Product identity, price, eligibility and scope remain on the original record. */
export function servicePlacement(
  s: Pick<Service, "id" | "name" | "category" | "description">,
): { home: ServiceHomeKey; family: string } | null {
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
    ? { home: "detailing", family: map[surface]! }
    : { home: "paint", family: "Ceramic" };
}
export function currentServices(xs: Service[]): Service[] {
  return uniqueServices(xs)
    .filter((s) => s.active === true && customerOfferingVisible(s))
    .sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name),
    );
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** A reference is not another product when the same exact named/brand range is already published. Different tiers remain distinct. */
export function referenceChoices(
  xs: Service[],
  refs: BrandEnquiry[] = BRAND_ENQUIRIES,
): BrandEnquiry[] {
  return refs.filter(
    (r) =>
      customerOfferingVisible(r) &&
      !xs.some(
        (s) =>
          s.productKey === r.key ||
          (norm(s.brand ?? "") === norm(r.brand ?? "") &&
            norm(s.name) === norm(`${r.brand ?? ""} ${r.name}`)),
      ),
  );
}
export function familyChoices(
  home: ServiceHomeKey,
  xs: Service[],
  refs: BrandEnquiry[],
): string[] {
  return [
    ...new Set([
      ...(home === "paint"
        ? ["Ceramic", "PPF", "PPS"]
        : home === "modifications"
          ? ["Colour PPF", "Wraps", "Window tint", "Accessories & styling"]
          : []),
      ...xs
        .map(servicePlacement)
        .filter((p) => p?.home === home)
        .map((p) => p!.family),
      ...refs
        .map(referencePlacement)
        .filter((p) => p.home === home)
        .map((p) => p.family),
    ]),
  ];
}
export function routePath(
  params: Record<string, string | undefined>,
  xs: Service[],
): ServicesPath {
  const home = SERVICE_HOMES.find((h) => h.key === params.home)?.key;
  if (home)
    // Brand only narrows a family: a brand without a family would float over
    // every family card and imply offerings the brand may not have (e.g. a
    // ceramic-only brand over PPF/PPS), so it is dropped here.
    return {
      home,
      ...(params.family ? { family: params.family } : {}),
      ...(params.family && params.brand ? { brand: params.brand } : {}),
      ...(params.work ? { work: params.work } : {}),
    };
  const cat =
    params.cat ??
    (
      {
        wash: "wash",
        shine: "coatings",
        ceramic: "coatings",
        ppf: "ppf",
        tint: "mods",
        check: "garage",
      } as Record<string, string>
    )[params.need ?? ""];
  const keys = (params.p ?? "").split(",").filter(Boolean);
  const brand = params.brand ?? keys.find((k) => xs.some((s) => s.brand === k));
  const homeByCat: Record<string, ServiceHomeKey> = {
    wash: "washing",
    coatings: "paint",
    ppf: "paint",
    garage: "garage",
    mods: "modifications",
  };
  const type = keys[0];
  const detailFamily: Record<string, string> = {
    glass: "Glass",
    wheels: "Wheels & trim",
    leather: "Leather",
    fabric: "Fabric",
    trim: "Trim restoration",
    "maintenance-coating": "Maintenance",
    sealant: "Paint sealant",
    "ppf-coat": "Film aftercare",
  };
  if (cat === "coatings" && type && detailFamily[type])
    return {
      home: "detailing",
      family: detailFamily[type],
      ...(brand ? { brand } : {}),
    };
  if (cat && homeByCat[cat]) {
    const fam =
      cat === "ppf" ? "PPF" : cat === "coatings" ? "Ceramic" : undefined;
    return {
      home: homeByCat[cat],
      ...(fam ? { family: fam } : {}),
      ...(fam && brand ? { brand } : {}),
    };
  }
  return {};
}
export function pathParams(path: ServicesPath): Record<string, string> {
  return Object.fromEntries(
    Object.entries(path).filter(([, v]) => !!v),
  ) as Record<string, string>;
}
export function parentPath(path: ServicesPath): ServicesPath {
  if (path.brand) {
    const { brand, ...p } = path;
    return p;
  }
  if (path.work) {
    const { work, ...p } = path;
    return p;
  }
  if (path.family) return { home: path.home };
  return {};
}
export function serviceSearch(s: Service, q: string): boolean {
  const p = servicePlacement(s);
  return `${s.name} ${s.brand ?? ""} ${p?.home ?? ""} ${p?.family ?? ""} ${s.description ?? ""}`
    .toLowerCase()
    .includes(q.trim().toLowerCase());
}
