import { createElement } from "react";
import { Image, Platform } from "react-native";
import { LOGO_HORIZONTAL_ON_DARK_SVG, LOGO_MARK_ON_DARK_SVG, LOGO_STACKED_ON_DARK_SVG, LOGO_HORIZONTAL_RATIO, LOGO_HORIZONTAL_SVG, LOGO_MARK_RATIO, LOGO_MARK_SVG, LOGO_STACKED_RATIO, LOGO_STACKED_SVG, logoDataUri } from "../theme/logo.js";

/** The AutoDeck logo (v8). `height` is the drawn height; width follows the artwork. */
export function Logo({ variant = "horizontal", height = 36, onDark = false }: { variant?: "horizontal" | "mark" | "stacked"; height?: number; onDark?: boolean }) {
  const art = (onDark
    ? { horizontal: [LOGO_HORIZONTAL_ON_DARK_SVG, LOGO_HORIZONTAL_RATIO], mark: [LOGO_MARK_ON_DARK_SVG, LOGO_MARK_RATIO], stacked: [LOGO_STACKED_ON_DARK_SVG, LOGO_STACKED_RATIO] }
    : { horizontal: [LOGO_HORIZONTAL_SVG, LOGO_HORIZONTAL_RATIO], mark: [LOGO_MARK_SVG, LOGO_MARK_RATIO], stacked: [LOGO_STACKED_SVG, LOGO_STACKED_RATIO] })[variant] as [string, number];
  const w = Math.round(height * art[1]);
  const uri = logoDataUri(art[0]);
  if (Platform.OS === "web") {
    return createElement("img", { src: uri, alt: "AutoDeck", width: w, height, style: { display: "block", width: w, height, flexShrink: 0 } });
  }
  return <Image accessibilityLabel="AutoDeck" source={{ uri }} resizeMode="contain" style={{ width: w, height }} />;
}
