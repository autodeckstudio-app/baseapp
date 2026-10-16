// Bottom-nav icons: five clearly different thin-line silhouettes (1.5px), each with a filled variant for the active tab.
import { createElement } from "react";
import { Image, Platform } from "react-native";

export type NavIconName = "home" | "services" | "bookings" | "garage" | "profile" | "club" | "gift" | "bell" | "pin" | "chat" | "wash" | "ceramic" | "tools" | "search" | "check" | "call" | "whatsapp" | "instagram" | "channel" | "directions";

// body: the main silhouette (filled when active). detail: strokes drawn on top, in the cut-out colour when filled.
const ART: Record<NavIconName, { body: string; detail: string }> = {
  home: { body: '<path d="M3.5 10.8 12 3.5l8.5 7.3V19.5a1 1 0 0 1-1 1H15v-5.8H9v5.8H4.5a1 1 0 0 1-1-1z"/>', detail: "" },
  services: { body: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>', detail: "" },
  bookings: { body: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/>', detail: '<path d="M3.5 10h17M8 3v4M16 3v4M9 15.2l2.2 2.2 4-4.2"/>' },
  garage: { body: '<path d="M4 17.5v-5l2.2-4.6A2 2 0 0 1 8 6.8h8a2 2 0 0 1 1.8 1.1L20 12.5v5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>', detail: '<path d="M4 12.5h16M7.5 14.8h.01M16.5 14.8h.01"/>' },
  profile: { body: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-3.900 3.300-6.300 7.5-6.300s7.5 2.400 7.5 6.300z"/>', detail: "" },
  club: { body: '<path d="M4 18.5 3.5 8l5 4 3.5-6 3.5 6 5-4-.5 10.5z"/>', detail: "" },
  gift: { body: '<rect x="3.5" y="9" width="17" height="11.5" rx="2"/>', detail: '<path d="M12 9v11.5M3.5 13.5h17M12 9C10.5 5.5 7 6 7.5 8s3 1 4.5 1zM12 9c1.5-3.5 5-3 4.5-1s-3 1-4.5 1z"/>' },
  bell: { body: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/>', detail: '<path d="M10 21h4"/>' },
  pin: { body: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/>', detail: '<circle cx="12" cy="10" r="2.2"/>' },
  chat: { body: '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/>', detail: "" },
  wash: { body: '<path d="M12 3.5c3.5 4.2 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 2.5-6.3 6-10.5z"/>', detail: '<path d="M9 14.5a3 3 0 0 0 3 3"/>' },
  ceramic: { body: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/>', detail: '<path d="M9 12l2.2 2.2 4-4.2"/>' },
  tools: { body: '<path d="M14.5 4a5 5 0 0 0-4.5 6.8L3.8 17a1.8 1.8 0 0 0 2.5 2.5l6.2-6.2A5 5 0 0 0 20 9.5l-3 3-2.5-.5-.5-2.5 3-3A5 5 0 0 0 14.500 4z"/>', detail: "" },
  search: { body: '<circle cx="11" cy="11" r="6.5"/>', detail: '<path d="M16 16l4.5 4.5"/>' },
  call: { body: '<path d="M6.6 3.5h2.8l1.5 4-1.9 1.3a11 11 0 0 0 5.200 5.200l1.300-1.900 4 1.500v2.800a2 2 0 0 1-2.100 2A15.500 15.500 0 0 1 4.600 5.600a2 2 0 0 1 2-2.100z"/>', detail: "" },
  whatsapp: { body: '<path d="M12 3.500a8.500 8.500 0 0 0-7.300 12.800L3.500 20.500l4.300-1.100A8.500 8.500 0 1 0 12 3.500z"/>', detail: '<path d="M9.200 8.600c.3 3 2.300 5 5.300 5.700l1-1.300-1.800-1-.9.700a4 4 0 0 1-1.800-1.800l.7-.9-1-1.800z"/>' },
  instagram: { body: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/>', detail: '<circle cx="12" cy="12" r="3.8"/><path d="M17 7h.01"/>' },
  channel: { body: '<path d="M4 10v4a1 1 0 0 0 1 1h2.500l7 4V5l-7 4H5a1 1 0 0 0-1 1z"/>', detail: '<path d="M18.500 9.500a3.500 3.500 0 0 1 0 5"/>' },
  directions: { body: '<path d="M12 3.500 20.500 12 12 20.500 3.500 12z"/>', detail: '<path d="M9 13v-2.200a1 1 0 0 1 1-1h5M13 7.500l2.500 2.500-2.500 2.500"/>' },
  check: { body: '<circle cx="12" cy="12" r="9"/>', detail: '<path d="M8 12.2l2.7 2.7 5-5.2"/>' },
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

/** Map any older icon name onto the one thin-line set, so every screen draws icons the same way. */
export function navIconFor(name: string): NavIconName {
  const known = Object.keys(ART) as NavIconName[];
  if (known.includes(name as NavIconName)) return name as NavIconName;
  if (name === "car") return "garage";
  if (name === "wrench") return "tools";
  if (name === "shield") return "ceramic";
  if (name === "calendar") return "bookings";
  if (name === "membership") return "club";
  if (name === "phone") return "call";
  if (name === "user" || name === "users") return "profile";
  return "check";
}
