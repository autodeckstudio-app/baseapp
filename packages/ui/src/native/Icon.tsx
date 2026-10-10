import { createElement } from "react";
import { Image, Platform } from "react-native";
import { DUO_VIEWBOX, duotoneInner, iconInner, iconMarkup, isFillable, type IconName } from "../theme/icons.js";
import { useExperienceTheme } from "./ThemeContext.js";

// The duotone art draws its linework in one dark ink; on a dark ground that ink flips to light.
const DARK_INK = /#2E2E33/gi;
const LIGHT_INK = "#F2F0EC";

export function Icon({ name, color, size = 24, filled = false }: { name: IconName; color: string; size?: number; filled?: boolean }) {
  const { name: theme } = useExperienceTheme();
  const flip = theme === "night";
  if (Platform.OS === "web") {
    if (duotoneInner(name)) {
      return createElement("svg", { "aria-hidden": true, width: size, height: size, viewBox: DUO_VIEWBOX, style: { flexShrink: 0, display: "block", opacity: filled || color === "#FFFFFF" ? 1 : 0.92 }, dangerouslySetInnerHTML: { __html: flip ? iconInner(name).replace(DARK_INK, LIGHT_INK) : iconInner(name) } });
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
  const svg = flip ? iconMarkup(name, color, size, filled).replace(DARK_INK, LIGHT_INK) : iconMarkup(name, color, size, filled);
  return <Image accessibilityElementsHidden source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width: size, height: size }} />;
}
