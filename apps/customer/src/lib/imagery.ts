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
