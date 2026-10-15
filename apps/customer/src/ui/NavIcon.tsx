// Bottom-nav icons: five clearly different thin-line silhouettes (1.5px), each with a filled variant for the active tab.
import { createElement } from "react";
import { Image, Platform } from "react-native";

export type NavIconName = "home" | "services" | "bookings" | "garage" | "profile";

// body: the main silhouette (filled when active). detail: strokes drawn on top, in the cut-out colour when filled.
const ART: Record<NavIconName, { body: string; detail: string }> = {
  home: { body: '<path d="M3.5 10.8 12 3.5l8.5 7.3V19.5a1 1 0 0 1-1 1H15v-5.8H9v5.8H4.5a1 1 0 0 1-1-1z"/>', detail: "" },
  services: { body: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>', detail: "" },
  bookings: { body: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/>', detail: '<path d="M3.5 10h17M8 3v4M16 3v4M9 15.2l2.2 2.2 4-4.2"/>' },
  garage: { body: '<path d="M4 17.5v-5l2.2-4.6A2 2 0 0 1 8 6.8h8a2 2 0 0 1 1.8 1.1L20 12.5v5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>', detail: '<path d="M4 12.5h16M7.5 14.8h.01M16.5 14.8h.01"/>' },
  profile: { body: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-3.900 3.300-6.300 7.5-6.300s7.5 2.400 7.5 6.300z"/>', detail: "" },
};

export function navIconMarkup(name: NavIconName, color: string, size: number, filled: boolean, cut: string): string {
  const a = ART[name];
  const fill = filled ? color : "none";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g fill="${fill}" stroke="${color}" stroke-width="1.5">${a.body}</g>` +
    (a.detail ? `<g fill="none" stroke="${filled ? cut : color}" stroke-width="1.5">${a.detail}</g>` : "") +
    `</svg>`
  );
}

export function NavIcon({ name, color, size = 26, filled = false, cut }: { name: NavIconName; color: string; size?: number; filled?: boolean; cut: string }) {
  const svg = navIconMarkup(name, color, size, filled, cut);
  if (Platform.OS === "web") {
    return createElement("span", { "aria-hidden": true, style: { display: "block", width: size, height: size, lineHeight: 0 }, dangerouslySetInnerHTML: { __html: svg } });
  }
  return <Image accessibilityElementsHidden source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width: size, height: size }} />;
}
