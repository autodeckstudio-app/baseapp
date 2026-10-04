// Rounded line icon set (24x24, 2 stroke, Lucide-style geometry). Active icons get a soft tinted fill. Pure strings so web and native share it.
// `filled` variants are used for the active tab.
export type IconName =
  | "home" | "services" | "bookings" | "garage" | "profile" | "wash" | "ceramic" | "coating" | "ppf" | "tint" | "inspect"
  | "search" | "wrench" | "check" | "star" | "pin" | "club" | "bell" | "users" | "plus" | "calendar" | "car" | "tools" | "shield" | "dot" | "close"
  | "bay" | "break" | "check-in" | "check-out" | "detailing" | "invoice" | "membership" | "notifications" | "payments" | "photos" | "pickup" | "ppf-film" | "settings" | "walk-in" | "window-tint";

import { DUOTONE, DUOTONE_ALIAS } from "./glyphs.js";

const P: Partial<Record<IconName, string>> = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  services: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  bookings: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  garage: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  profile: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  wash: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  ceramic: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  coating: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  ppf: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h6M7 14h10"/>',
  tint: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 12h16M9 3l-3 9M14 3l-3 9"/>',
  inspect: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 10.5l2 2 3-3.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 4.8 5.2L10 21a2.1 2.1 0 0 1-3-3l9.3-9.3"/><path d="M14.5 6.5 17 4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
  pin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  club: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 12 9l2.5-5M12 9v11"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0 4.8 5.2L10 21a2.1 2.1 0 0 1-3-3l9.3-9.3"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
};

const FILLABLE: IconName[] = ["home", "services", "bookings", "garage", "profile", "star", "calendar", "car", "users", "bell", "club", "tools", "wrench", "shield", "pin", "check", "search"];

export const DUO_VIEWBOX = "2 2 60 60";
/** Duotone glyph markup for a name, or null when the name only has a line icon. */
export function duotoneInner(name: IconName): string | null {
  return DUOTONE[name] ?? DUOTONE[DUOTONE_ALIAS[name] ?? ""] ?? null;
}
export function iconInner(name: IconName): string { return duotoneInner(name) ?? P[name] ?? ""; }
export function iconMarkup(name: IconName, color: string, size = 24, filled = false): string {
  const duo = duotoneInner(name);
  if (duo) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${DUO_VIEWBOX}">${duo}</svg>`;
  const fill = filled && FILLABLE.includes(name) ? color : "none";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" fill-opacity="${fill === "none" ? 0 : 0.22}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] ?? ""}</svg>`;
}
export function iconDataUri(name: IconName, color: string, size = 24, filled = false): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(iconMarkup(name, color, size, filled))}`;
}
export function isFillable(name: IconName): boolean { return FILLABLE.includes(name); }
