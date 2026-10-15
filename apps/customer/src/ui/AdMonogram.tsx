// The official AutoDeck AD monogram. The two paths are copied unchanged from the studio's logo files
// (AutoDeck_stacked_light.svg / AutoDeck_stacked_dark.svg, Drive logo folder, SVG subfolder). Do not redraw.
// Only the ink fill changes with the theme, exactly as the official light (#0B0B0C) and dark (#FFFFFF) files do.
import { createElement } from "react";
import { Image, Platform } from "react-native";

const INK_PATH = "M1447,666 L1953,666 A500,500 0 0 1 1953,1666 L1600,1666 C1500,1666 1460,1610 1405,1540 L1064,930 Q1050,903 1036,918 L400,1662 L262,1662 Q244,1660 252,1636 L1006,716 Q1066,660 1141,743 L1546,1459 C1585,1512 1615,1520 1700,1520 L1950,1520 A353,353 0 0 0 1950,814 L1497,814 L1466,786 L1415,696 L1425,674 Z";
const ORANGE_PATH = "M756,1494 L995,1500 L1072,1662 L612,1662 Z";
export const MONOGRAM_INK = { light: "#0B0B0C", dark: "#FFFFFF" } as const;

export function adMonogramMarkup(ink: string, width: number): string {
  const h = Math.round((width * 1010) / 2230);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="238 660 2230 1010">` +
    `<path d="${INK_PATH}" fill="${ink}"/><path d="${ORANGE_PATH}" fill="#EC8638"/></svg>`
  );
}

export function AdMonogram({ theme, width = 30 }: { theme: "light" | "dark"; width?: number }) {
  const svg = adMonogramMarkup(MONOGRAM_INK[theme], width);
  const h = Math.round((width * 1010) / 2230);
  if (Platform.OS === "web") {
    return createElement("span", { "aria-hidden": true, style: { display: "block", width, height: h, lineHeight: 0 }, dangerouslySetInnerHTML: { __html: svg } });
  }
  return <Image accessibilityElementsHidden source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width, height: h }} />;
}
