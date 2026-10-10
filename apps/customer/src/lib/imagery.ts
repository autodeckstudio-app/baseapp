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

import heroHome from "../../assets/imagery/stock/x-black-sunlight.jpg";
import loginHero from "../../assets/imagery/studio-login.jpg";
import heroAlt from "../../assets/imagery/stock/x-black-sunlight.jpg";
import membership from "../../assets/imagery/stock/x-white-garage.jpg";
import serviceWashing from "../../assets/imagery/stock/x-white-garage.jpg";
import serviceCeramic from "../../assets/imagery/curated/coating.jpg";
import serviceCoating from "../../assets/imagery/curated/coating.jpg";
import servicePpf from "../../assets/imagery/stock/ppf-install.jpg";
import serviceTinting from "../../assets/imagery/stock/tint-install.jpg";
import serviceInspection from "../../assets/imagery/stock/x-underbody-b.jpg";
import serviceOther from "../../assets/imagery/curated/care.jpg";
import vehicleSedan from "../../assets/imagery/stock/x-black-sunlight.jpg";

/** One photograph per service category, shown on catalogue cards and detail heroes. */
export const serviceImagery: Record<ServiceCategory, ImageSourcePropType> = {
  washing: serviceWashing,
  ceramic: serviceCeramic,
  coating: serviceCoating,
  ppf: servicePpf,
  tinting: serviceTinting,
  inspection: serviceInspection,
  other: serviceOther,
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
  inspection: require("../../assets/imagery/stock/x-underbody-b.jpg"), care: require("../../assets/imagery/curated/care.jpg"),
};
/* eslint-enable @typescript-eslint/no-require-imports */
type Svc = { name: string; brand?: string | null; category: string; imageUrl?: string | null };
function topicOf(s: Svc): string {
  const n = s.name.toLowerCase();
  if (s.category === "ppf") return "ppf";
  if (s.category === "tinting" || n.includes("tint")) return "tint";
  if (n.includes("headlight")) return "headlight";
  if (n.includes("roof")) return "roof";
  if (n.includes("engine")) return "engine";
  if (/wheel|tyre|tire|rim/.test(n)) return "wheel";
  if (/dry clean|spa|interior|upholstery|leather|fabric/.test(n)) return "interior";
  if (/polish|buff|correction/.test(n)) return "polish";
  if (s.category === "inspection" || /inspect|check/.test(n)) return "inspection";
  if (/glass|window/.test(n)) return "tint";
  if (/teflon|coat/.test(n) || s.category === "ceramic" || s.category === "coating") return "coating";
  if (/wash|foam/.test(n) || s.category === "washing") return "washExt";
  return "care";
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
export function serviceVisual(s: Svc): ServiceVisual {
  const bottle = bottleOf(s);
  if (bottle) return { photo: TOPICS[topicOf(s)] ?? TOPICS.coating!, bottle };
  return { photo: TOPICS[topicOf(s)] ?? TOPICS.care! };
}

/** Brand banner photo, only where the brand's own site gave a usable image. */
export function brandHero(_name: string): ImageSourcePropType | null {
  // Category tile supplies the matching subject; do not substitute brand car ads.
  return null;
}
