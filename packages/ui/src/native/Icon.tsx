import { createElement } from "react";
import { Image, Platform } from "react-native";
import { iconDataUri, iconInner, isFillable, type IconName } from "../theme/icons.js";

export function Icon({ name, color, size = 24, filled = false }: { name: IconName; color: string; size?: number; filled?: boolean }) {
  if (Platform.OS === "web") {
    return createElement("svg", {
      "aria-hidden": true,
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: filled && isFillable(name) ? color : "none",
      stroke: color,
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { flexShrink: 0, display: "block" },
      dangerouslySetInnerHTML: { __html: iconInner(name) },
    });
  }
  return <Image accessibilityElementsHidden source={{ uri: iconDataUri(name, color, size, filled) }} style={{ width: size, height: size }} />;
}
