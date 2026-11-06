import type { ImageSourcePropType } from "react-native";
import { catalogueAsset } from "./catalogue-assets";
import { serviceHomeImages } from "./service-home-images";
import type { ServiceHomeKey } from "@autodeck/core";
const generated: Record<string, ImageSourcePropType> = {
  PPF: require("../../assets/imagery/service-types/ppf.jpg"),
  PPS: require("../../assets/imagery/service-types/pps.jpg"),
  "Colour PPF": require("../../assets/imagery/service-types/colour-ppf.jpg"),
  "Accessories & styling": require("../../assets/imagery/service-types/accessories.jpg"),
};
const serviceIds: Record<string, string> = {
  Fabric: "menu-coat-fabric",
  Glass: "menu-coat-glass",
  Leather: "menu-coat-leather",
  "Wheels & trim": "menu-coat-wheels",
  "Trim restoration": "menu-coat-trim",
  "Exterior wash": "menu-wash-exterior",
  "Interior cleaning": "menu-wash-interior",
  "Complete wash": "menu-wash-full",
  "Headlight restoration": "svc-wash-headlight-buffing",
  Inspection: "menu-garage-inspection",
  "Wheels & tyres": "menu-garage-alignment",
  "AC care": "menu-garage-ac",
  "Battery & electrical": "menu-garage-battery",
  Repairs: "menu-garage-repairs",
  "Window tint": "menu-mods-tint",
  Wraps: "menu-mods-wrap",
};
/** Type images illustrate a service. They never supply a product identity or evidence of studio stock. */
export function serviceTypeImage(
  home: ServiceHomeKey,
  family: string,
): ImageSourcePropType {
  return (
    generated[family] ??
    catalogueAsset({ id: serviceIds[family] ?? "" })?.thumbnail ??
    serviceHomeImages[home]
  );
}
