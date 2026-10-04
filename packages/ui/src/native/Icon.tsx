import { createElement } from "react";
import { Image, Platform } from "react-native";
import { DUO_VIEWBOX, duotoneInner, iconDataUri, iconInner, isFillable, type IconName } from "../theme/icons.js";

export function Icon({ name, color, size = 24, filled = false }: { name: IconName; color: string; size?: number; filled?: boolean }) {
  if (Platform.OS === "web") {
    if (duotoneInner(name)) {
      return createElement("svg", { "aria-hidden": true, width: size, height: size, viewBox: DUO_VIEWBOX, style: { flexShrink: 0, display: "block", opacity: filled || color === "#FFFFFF" ? 1 : 0.92 }, dangerouslySetInnerHTML: { __html: iconInner(name) } });
    }
    return createElement("svg", {
      "aria-hidden": true,
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: filled && isFillable(name) ? color : "none",
      fillOpacity: filled && isFillable(name) ? 0.22 : 0,
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { flexShrink: 0, display: "block" },
      dangerouslySetInnerHTML: { __html: iconInner(name) },
    });
  }
  return <Image accessibilityElementsHidden source={{ uri: iconDataUri(name, color, size, filled) }} style={{ width: size, height: size }} />;
}
