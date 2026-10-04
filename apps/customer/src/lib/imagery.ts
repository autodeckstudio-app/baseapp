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

/* eslint-disable @typescript-eslint/no-require-imports */
const X: Record<string, ImageSourcePropType> = {
  "foam-street": require("../../assets/imagery/stock/x-foam-street.jpg"),
  "vintage-soap": require("../../assets/imagery/stock/x-vintage-soap.jpg"),
  "suv-suds": require("../../assets/imagery/stock/x-suv-suds.jpg"),
  "suv-rinse": require("../../assets/imagery/stock/x-suv-rinse.jpg"),
  "white-garage": require("../../assets/imagery/stock/x-white-garage.jpg"),
  "bentley-hose": require("../../assets/imagery/stock/x-bentley-hose.jpg"),
  "vacuum-white": require("../../assets/imagery/stock/x-vacuum-white.jpg"),
  "seat-clean": require("../../assets/imagery/stock/x-seat-clean.jpg"),
  "white-seats": require("../../assets/imagery/stock/x-white-seats.jpg"),
  "tan-leather": require("../../assets/imagery/stock/x-tan-leather.jpg"),
  "vintage-interior": require("../../assets/imagery/stock/x-vintage-interior.jpg"),
  "window-clean": require("../../assets/imagery/stock/x-window-clean.jpg"),
  "buff-roof": require("../../assets/imagery/stock/x-buff-roof.jpg"),
  "buff-rear": require("../../assets/imagery/stock/x-buff-rear.jpg"),
  "polish-door": require("../../assets/imagery/stock/x-polish-door.jpg"),
  "polish-garage": require("../../assets/imagery/stock/x-polish-garage.jpg"),
  "detail-workshop": require("../../assets/imagery/stock/x-detail-workshop.jpg"),
  "polish-red": require("../../assets/imagery/stock/x-polish-red.jpg"),
  "wipe-gloss": require("../../assets/imagery/stock/x-wipe-gloss.jpg"),
  "cleaner-sponge": require("../../assets/imagery/stock/x-cleaner-sponge.jpg"),
  "spray-booth": require("../../assets/imagery/stock/x-spray-booth.jpg"),
  "black-sunlight": require("../../assets/imagery/stock/x-black-sunlight.jpg"),
  "glossy-black": require("../../assets/imagery/stock/x-glossy-black.jpg"),
  "black-reflect": require("../../assets/imagery/stock/x-black-reflect.jpg"),
  "wet-black": require("../../assets/imagery/stock/x-wet-black.jpg"),
  "showroom": require("../../assets/imagery/stock/x-showroom.jpg"),
  "foil-garage": require("../../assets/imagery/stock/x-foil-garage.jpg"),
  "film-window": require("../../assets/imagery/stock/x-film-window.jpg"),
  "car-window": require("../../assets/imagery/stock/x-car-window.jpg"),
  "headlight-black": require("../../assets/imagery/stock/x-headlight-black.jpg"),
  "headlight-grille": require("../../assets/imagery/stock/x-headlight-grille.jpg"),
  "rim-clean": require("../../assets/imagery/stock/x-rim-clean.jpg"),
  "tyre-clean": require("../../assets/imagery/stock/x-tyre-clean.jpg"),
  "wheel-spray": require("../../assets/imagery/stock/x-wheel-spray.jpg"),
  "engine-bay": require("../../assets/imagery/stock/x-engine-bay.jpg"),
  "engine-turbo": require("../../assets/imagery/stock/x-engine-turbo.jpg"),
  "engine-filter": require("../../assets/imagery/stock/x-engine-filter.jpg"),
  "engine-red": require("../../assets/imagery/stock/x-engine-red.jpg"),
  "underbody-a": require("../../assets/imagery/stock/x-underbody-a.jpg"),
  "underbody-b": require("../../assets/imagery/stock/x-underbody-b.jpg"),
  "spray-bonnet": require("../../assets/imagery/stock/x-spray-bonnet.jpg"),
  "damage-check": require("../../assets/imagery/stock/x-damage-check.jpg"),
};
/* eslint-enable @typescript-eslint/no-require-imports */
const pick = (...k: string[]) => k.map((x) => X[x]).filter(Boolean) as ImageSourcePropType[];

// Topic pools, best fit first. Each service takes the first photo nobody else has taken yet.
const POOLS: Record<string, ImageSourcePropType[]> = {
  washExt: pick("foam-street", "suv-suds", "white-garage", "vintage-soap", "suv-rinse", "bentley-hose", "wet-black"),
  roof: pick("suv-rinse", "wet-black", "white-garage"),
  interior: pick("seat-clean", "vacuum-white", "white-seats", "tan-leather", "vintage-interior", "window-clean"),
  polish: pick("buff-roof", "polish-door", "buff-rear", "polish-garage", "polish-red", "detail-workshop", "wipe-gloss"),
  headlight: pick("headlight-black", "headlight-grille", "black-reflect"),
  coating: pick("glossy-black", "black-reflect", "black-sunlight", "wet-black", "showroom", "wipe-gloss"),
  ppf: pick("foil-garage", "film-window", "showroom", "black-sunlight", "glossy-black", "black-reflect", "wet-black"),
  tint: pick("film-window", "car-window", "window-clean"),
  wheel: pick("rim-clean", "tyre-clean", "wheel-spray"),
  engine: pick("engine-bay", "engine-turbo", "engine-filter", "engine-red"),
  inspection: pick("underbody-a", "underbody-b", "damage-check", "engine-bay"),
  care: pick("spray-bonnet", "wipe-gloss", "cleaner-sponge"),
};
const ALL_POOL = Object.values(POOLS).flat();

type Svc = { name: string; brand?: string | null; category: string; imageUrl?: string | null };

function topicOf(s: Svc): string {
  const n = s.name.toLowerCase();
  if (s.category === "ppf") return "ppf";
  if (s.category === "tinting" || n.includes("tint")) return "tint";
  if (n.includes("headlight")) return "headlight";
  if (n.includes("roof")) return "roof";
  if (n.includes("engine")) return "engine";
  if (n.includes("wheel") || n.includes("tyre") || n.includes("tire") || n.includes("rim")) return "wheel";
  if (n.includes("dry clean") || n.includes("spa") || n.includes("interior") || n.includes("upholstery") || n.includes("leather")) return "interior";
  if (n.includes("polish") || n.includes("buff") || n.includes("correction")) return "polish";
  if (s.category === "inspection" || n.includes("inspect") || n.includes("check")) return "inspection";
  if (n.includes("teflon") || n.includes("coat") || s.category === "ceramic" || s.category === "coating") return "coating";
  if (n.includes("wash") || n.includes("foam") || s.category === "washing") return "washExt";
  return "care";
}

const assigned = new Map<string, ImageSourcePropType>();
const usedCount = new Map<ImageSourcePropType, number>();
const claim = (key: string, topic: string): ImageSourcePropType => {
  const got = assigned.get(key);
  if (got) return got;
  const lists = [POOLS[topic] ?? [], ALL_POOL];
  let chosen: ImageSourcePropType | undefined;
  for (const l of lists) {
    chosen = l.find((x) => !usedCount.has(x));
    if (chosen) break;
  }
  chosen ??= [...ALL_POOL].sort((a, b) => (usedCount.get(a) ?? 0) - (usedCount.get(b) ?? 0))[0]!;
  usedCount.set(chosen, (usedCount.get(chosen) ?? 0) + 1);
  assigned.set(key, chosen);
  return chosen;
};

/** Call once with the whole catalogue so every service gets its own photo, the same one on every screen. */
export function primeVisuals(list: Svc[]): void {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
  for (const s of sorted) if (!bottleOf(s)) claim(s.name, topicOf(s));
}

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
  if (bottle) return { photo: P.coating, bottle };
  return { photo: claim(s.name, topicOf(s)) };
}

/** Brand banner photo, only where the brand's own site gave a usable image. */
export function brandHero(name: string): ImageSourcePropType | null {
  if (name === "XPEL") return P.xpel;
  if (name === "Garware") return P.garwarePpf;
  return null;
}
