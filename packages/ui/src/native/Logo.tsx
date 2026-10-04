import { createElement } from "react";
import { Image, Platform } from "react-native";
import { LOGO_HORIZONTAL_RATIO, LOGO_HORIZONTAL_SVG, LOGO_MARK_RATIO, LOGO_MARK_SVG, logoDataUri } from "../theme/logo.js";

/** The AutoDeck logo (v8). `height` is the drawn height; width follows the artwork. */
export function Logo({ variant = "horizontal", height = 36 }: { variant?: "horizontal" | "mark"; height?: number }) {
  const horizontal = variant === "horizontal";
  const w = Math.round(height * (horizontal ? LOGO_HORIZONTAL_RATIO : LOGO_MARK_RATIO));
  const uri = logoDataUri(horizontal ? LOGO_HORIZONTAL_SVG : LOGO_MARK_SVG);
  if (Platform.OS === "web") {
    return createElement("img", { src: uri, alt: "AutoDeck", width: w, height, style: { display: "block", width: w, height, flexShrink: 0 } });
  }
  return <Image accessibilityLabel="AutoDeck" source={{ uri }} resizeMode="contain" style={{ width: w, height }} />;
}
