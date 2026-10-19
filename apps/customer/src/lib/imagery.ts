// Imagery manifest - the one place every photo in the customer app is chosen.
//
// Swap path to real studio photography (no code changes beyond this file):
//   1. Drop the new files into apps/customer/assets/imagery/ using the same
//      names, or
//   2. point a key below at a different bundled asset or a remote source
//      ({ uri: "https://firebasestorage.googleapis.com/..." }) once studio
//      photos live in Firebase Storage.
// Screens never hard-code image paths; they ask for a semantic key.
// Provenance and licenses for the current placeholder set: assets/imagery/ATTRIBUTION.md.
import type { ImageSourcePropType } from "react-native";
import type { ServiceCategory, VehicleCategory } from "@autodeck/core";

import heroHome from "../../assets/imagery/stock/x-polish-red.jpg";
import loginHero from "../../assets/imagery/studio-login.jpg";
import heroAlt from "../../assets/imagery/stock/x-polish-red.jpg";
import membership from "../../assets/imagery/stock/g-styling.jpg";
import serviceWashing from "../../assets/imagery/stock/x-white-garage.jpg";
import serviceCeramic from "../../assets/imagery/curated/coating.jpg";
import serviceCoating from "../../assets/imagery/curated/coating.jpg";
import servicePpf from "../../assets/imagery/stock/ppf-install.jpg";
import serviceTinting from "../../assets/imagery/stock/tint-install.jpg";
import serviceInspection from "../../assets/imagery/stock/x-underbody-b.jpg";
import serviceOther from "../../assets/imagery/curated/care.jpg";
import catPpf from "../../assets/imagery/category/paint-protection.jpg";
import catCeramic from "../../assets/imagery/category/ceramic-coating.jpg";
import catDetailing from "../../assets/imagery/category/detailing.jpg";
import catWash from "../../assets/imagery/category/wash-and-care.jpg";
import catGarage from "../../assets/imagery/category/garage.jpg";
import catMods from "../../assets/imagery/category/modifications.jpg";
import vehicleSedan from "../../assets/imagery/stock/x-polish-red.jpg";

/** One photograph per service category, shown on catalogue cards and detail heroes. */
/** Approved category photographs. Detailing has no category of its own: it is the Complete detailing type under Wash & Care. */
export const detailingImage: ImageSourcePropType = catDetailing;

export const serviceImagery: Record<ServiceCategory, ImageSourcePropType> = {
  washing: catWash,
  ceramic: catCeramic,
  coating: catCeramic,
  ppf: catPpf,
  tinting: serviceTinting,
  inspection: serviceInspection,
  other: serviceOther,
  garage: catGarage,
  modifications: catMods,
  pickup: serviceOther,
};

/** Fallback portrait per vehicle category until customers add their own car photos. */
export const vehicleImagery: Record<VehicleCategory, ImageSourcePropType> = {
  hatchback: heroAlt,
  sedan: vehicleSedan,
  suv: heroAlt,
  luxury: heroAlt,
  van: heroAlt,
  commercial: heroAlt,
};

/** Scene photography: home hero, membership, and other full-bleed moments. */
export const sceneImagery = {
  heroHome,
  heroAlt,
  membership,
  login: loginHero,
} as const;

// ---------------------------------------------------------------------------
// Per-service imagery. Every service and brand product resolves to a photo or
// a product shot. Sources and permission status: assets/imagery/REGISTER.md.
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-require-imports */
const BOTTLES: Record<string, { src: ImageSourcePropType; tint: string }> = {
  borophene: { src: require("../../assets/imagery/brands/kovalent-borophene.png"), tint: "#F6D6D6" },
  "graphene matrix": { src: require("../../assets/imagery/brands/kovalent-graphene-matrix.png"), tint: "#D9DBF5" },
  graphene: { src: require("../../assets/imagery/brands/kovalent-graphene.png"), tint: "#DCE2E6" },
  "prolong light": { src: require("../../assets/imagery/brands/kovalent-prolong-light.png"), tint: "#D3EBDD" },
  prolong: { src: require("../../assets/imagery/brands/kovalent-prolong.png"), tint: "#E4E1EC" },
  powershield: { src: require("../../assets/imagery/brands/kovalent-powershield.png"), tint: "#E1E1EE" },
  restore: { src: require("../../assets/imagery/brands/kovalent-restore.png"), tint: "#ECECF2" },
  matte: { src: require("../../assets/imagery/brands/kovalent-matte.png"), tint: "#FFE3D0" },
  fabric: { src: require("../../assets/imagery/brands/kovalent-fabric.png"), tint: "#D0E8EA" },
  glass: { src: require("../../assets/imagery/brands/kovalent-glass.png"), tint: "#E3D7F3" },
  revive: { src: require("../../assets/imagery/brands/kovalent-revive.png"), tint: "#D3E3F5" },
};
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable @typescript-eslint/no-require-imports */
const TOPICS: Record<string, ImageSourcePropType> = {
  washExt: require("../../assets/imagery/stock/x-white-garage.jpg"), roof: require("../../assets/imagery/curated/roof.jpg"),
  interior: require("../../assets/imagery/stock/x-white-seats.jpg"), polish: require("../../assets/imagery/stock/x-polish-red.jpg"),
  headlight: require("../../assets/imagery/curated/headlight.jpg"), coating: require("../../assets/imagery/curated/coating.jpg"),
  ppf: require("../../assets/imagery/stock/ppf-install.jpg"), tint: require("../../assets/imagery/stock/tint-install.jpg"),
  wheel: require("../../assets/imagery/stock/x-rim-clean.jpg"), engine: require("../../assets/imagery/stock/x-engine-bay.jpg"),
  inspection: require("../../assets/imagery/stock/x-underbody-b.jpg"), gInspect: require("../../assets/imagery/stock/g-inspection.jpg"), align: require("../../assets/imagery/stock/g-alignment.jpg"),
  ac: require("../../assets/imagery/stock/g-ac.jpg"), battery: require("../../assets/imagery/stock/g-battery.jpg"), repair: require("../../assets/imagery/stock/g-repairs.jpg"),
  wrap: require("../../assets/imagery/stock/g-wrap.jpg"), styling: require("../../assets/imagery/stock/g-styling.jpg"), pickup: require("../../assets/imagery/stock/g-pickup.jpg"), care: require("../../assets/imagery/curated/care.jpg"),
};
/* eslint-enable @typescript-eslint/no-require-imports */
import { topicOf, GARAGE_PHOTO_TOPICS, type Svc } from "./imagery-topic";
/** Extra real photos per topic so neighbouring cards in one list never show the same picture. */
/* eslint-disable @typescript-eslint/no-require-imports */
const POOLS: Record<string, ImageSourcePropType[]> = {
  coating: [require("../../assets/imagery/curated/coating.jpg"), require("../../assets/imagery/stock/coating-water-beading.jpg"), require("../../assets/imagery/stock/x-glossy-black.jpg"), require("../../assets/imagery/stock/x-black-reflect.jpg")],
  washExt: [require("../../assets/imagery/stock/x-white-garage.jpg"), require("../../assets/imagery/stock/wash-foam.jpg"), require("../../assets/imagery/stock/wash-suds.jpg"), require("../../assets/imagery/stock/x-foam-street.jpg")],
  ppf: [require("../../assets/imagery/stock/ppf-install.jpg"), require("../../assets/imagery/stock/ppf-hood-wrap.jpg"), require("../../assets/imagery/stock/x-foil-garage.jpg")],
  tint: [require("../../assets/imagery/stock/tint-install.jpg"), require("../../assets/imagery/stock/x-film-window.jpg"), require("../../assets/imagery/stock/x-car-window.jpg")],
  polish: [require("../../assets/imagery/stock/x-polish-red.jpg"), require("../../assets/imagery/stock/paint-polish.jpg"), require("../../assets/imagery/stock/x-buff-rear.jpg"), require("../../assets/imagery/stock/x-buff-roof.jpg")],
  interior: [require("../../assets/imagery/stock/x-white-seats.jpg"), require("../../assets/imagery/stock/interior-detail.jpg"), require("../../assets/imagery/stock/x-seat-clean.jpg")],
};
/* eslint-enable @typescript-eslint/no-require-imports */
/** Pick the Nth photo of a topic (position in the list), wrapping around. */
export function pooledPhoto(topic: string, variant: number): ImageSourcePropType | undefined {
  const pool = POOLS[topic];
  return pool ? pool[((variant % pool.length) + pool.length) % pool.length] : undefined;
}

/** No order-dependent allocation or random cross-topic fallbacks. */
export function primeVisuals(_list: Svc[]): void { /* deterministic per subject */ }

function bottleOf(s: Svc) {
  const n = s.name.toLowerCase();
  const b = (s.brand ?? "").toLowerCase();
  if (b === "kovalent" || n.includes("kovalent") || (b === "" && (n === "borophene" || n === "graphene matrix"))) {
    const key = ["graphene matrix", "prolong light", "borophene", "graphene", "prolong", "powershield", "restore", "matte", "fabric", "glass", "revive"].find((k) => n.includes(k));
    return key ? BOTTLES[key] : undefined;
  }
  return undefined;
}

export type ServiceVisual = { photo: ImageSourcePropType; bottle?: { src: ImageSourcePropType; tint: string } };

/** Product shot for Kovalent items, otherwise a photo no other service in the catalogue shares. */
export function serviceVisual(s: Svc, variant = 0): ServiceVisual {
  const bottle = bottleOf(s);
  const t = topicOf(s);
  const photo = pooledPhoto(t, variant) ?? TOPICS[t] ?? TOPICS.care!;
  if (bottle) return { photo, bottle };
  return { photo };
}

/** Brand banner photo, only where the brand's own site gave a usable image. */
export function brandHero(_name: string): ImageSourcePropType | null {
  // Category tile supplies the matching subject; do not substitute brand car ads.
  return null;
}

/** True when a garage service has its own matching photo, so it shows the photo instead of the icon tile. */
export function hasGaragePhoto(name: string): boolean {
  return GARAGE_PHOTO_TOPICS.includes(topicOf({ name, category: "garage" }));
}

/**
 * Photo for a Services type tile, by type key. These are the licensed placeholder photos already in the app (see assets/imagery/REGISTER.md),
 * used only where the picture really shows that work. A type with no honest match returns null and its tile shows a plain icon panel,
 * never a stock image of something else. Swap an entry for a studio photo when one exists.
 */
const TYPE_TOPIC: Record<string, string | [string, number]> = {
  exterior: "washExt", interior: "interior", complete: "roof", polish: "polish", "leather-care": "interior", "wheel-clean": "wheel", lamps: "headlight",
  ceramic: "coating", graphene: "coating", wheels: "wheel", tyre: "wheel", leather: "interior", fabric: "interior", dashboard: "interior", "ppf-coat": "ppf",
  "brand-film": "ppf", "matte-ppf": ["ppf", 1], colour: "wrap",
  checks: "gInspect", periodic: "engine", battery: "battery", ac: "ac", tyres: "align", brakes: "wheel", suspension: "inspection", repairs: "repair",
  wraps: "wrap", styling: "styling", film: "tint", alloys: "wheel", seats: "interior",
};
export function typePhoto(key: string): ImageSourcePropType | null {
  if (key === "complete") return detailingImage;
  const t = TYPE_TOPIC[key];
  if (!t) return null;
  return Array.isArray(t) ? pooledPhoto(t[0], t[1]) ?? null : TOPICS[t] ?? null;
}
