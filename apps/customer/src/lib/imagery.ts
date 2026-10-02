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

import heroHome from "../../assets/imagery/hero-home.jpg";
import heroAlt from "../../assets/imagery/hero-alt.jpg";
import membership from "../../assets/imagery/membership.jpg";
import serviceWashing from "../../assets/imagery/service-washing.jpg";
import serviceCeramic from "../../assets/imagery/service-ceramic.jpg";
import serviceCoating from "../../assets/imagery/service-coating.jpg";
import servicePpf from "../../assets/imagery/service-ppf.jpg";
import serviceTinting from "../../assets/imagery/service-tinting.jpg";
import serviceInspection from "../../assets/imagery/service-inspection.jpg";
import serviceOther from "../../assets/imagery/service-other.jpg";
import vehicleSedan from "../../assets/imagery/vehicle-sedan.jpg";

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
  suv: serviceTinting,
  luxury: serviceCoating,
  van: heroAlt,
  commercial: heroAlt,
};

/** Scene photography: home hero, membership, and other full-bleed moments. */
export const sceneImagery = {
  heroHome,
  heroAlt,
  membership,
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
const P = {
  xpel: require("../../assets/imagery/brands/xpel-hero.jpg"),
  garwarePpf: require("../../assets/imagery/brands/garware-ppf.jpg"),
  garwareSun: require("../../assets/imagery/brands/garware-suncontrol.jpg"),
  coating: require("../../assets/imagery/stock/coating-water-beading.jpg"),
  headlight: require("../../assets/imagery/stock/headlight-polish.jpg"),
  inspection: require("../../assets/imagery/stock/inspection.jpg"),
  interior: require("../../assets/imagery/stock/interior-detail.jpg"),
  polish: require("../../assets/imagery/stock/paint-polish.jpg"),
  ppfHood: require("../../assets/imagery/stock/ppf-hood-wrap.jpg"),
  ppfInstall: require("../../assets/imagery/stock/ppf-install.jpg"),
  tint: require("../../assets/imagery/stock/tint-install.jpg"),
  washFoam: require("../../assets/imagery/stock/wash-foam.jpg"),
  washSuds: require("../../assets/imagery/stock/wash-suds.jpg"),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type ServiceVisual = { photo: ImageSourcePropType; bottle?: { src: ImageSourcePropType; tint: string } };

/** Best-fit visual for one service: brand product shot, brand photo, then a topic photo, then the category photo. */
export function serviceVisual(s: { name: string; brand?: string | null; category: string }): ServiceVisual {
  const n = s.name.toLowerCase();
  const b = (s.brand ?? "").toLowerCase();
  const fallback = serviceImagery[s.category as ServiceCategory] ?? serviceImagery.other;
  if (b === "kovalent" || n.includes("kovalent") || (b === "" && (n === "borophene" || n === "graphene matrix"))) {
    const key = ["graphene matrix", "prolong light", "borophene", "graphene", "prolong", "powershield", "restore", "matte", "fabric", "glass", "revive"].find((k) => n.includes(k));
    const bottle = key ? BOTTLES[key] : undefined;
    return bottle ? { photo: P.coating, bottle } : { photo: P.coating };
  }
  if (b === "xpel" || n.includes("xpel")) return { photo: s.category === "ppf" ? P.xpel : P.coating };
  if (b === "garware" || n.includes("garware")) return { photo: n.includes("sun") || n.includes("tint") || s.category === "tinting" ? P.garwareSun : P.garwarePpf };
  if (s.category === "ppf") return { photo: n.includes("stealth") || n.includes("matte") ? P.ppfHood : P.ppfInstall };
  if (s.category === "tinting" || n.includes("tint")) return { photo: P.tint };
  if (n.includes("headlight")) return { photo: P.headlight };
  if (n.includes("roof")) return { photo: P.washFoam };
  if (n.includes("dry clean") || n.includes("spa") || n.includes("interior")) return { photo: P.interior };
  if (n.includes("polish") || n.includes("buff") || n.includes("correction")) return { photo: P.polish };
  if (n.includes("teflon") || n.includes("coat") || s.category === "ceramic" || s.category === "coating") return { photo: P.coating };
  if (n.includes("premium wash") || n.includes("foam")) return { photo: P.washFoam };
  if (n.includes("wash") || s.category === "washing") return { photo: P.washSuds };
  if (s.category === "inspection" || n.includes("inspect") || n.includes("check")) return { photo: P.inspection };
  return { photo: fallback };
}
