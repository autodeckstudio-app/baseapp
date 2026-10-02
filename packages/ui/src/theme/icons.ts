// Line icon set (24x24, 1.8 stroke). Pure strings so web and native share it.
// `filled` variants are used for the active tab.
export type IconName =
  | "home" | "services" | "bookings" | "garage" | "profile" | "wash" | "ceramic" | "coating" | "ppf" | "tint" | "inspect"
  | "search" | "wrench" | "check" | "star" | "pin" | "club" | "bell" | "users" | "plus" | "calendar" | "car" | "tools" | "shield" | "dot" | "close";

const P: Record<IconName, string> = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  services: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  bookings: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 15l2 2 4-4"/>',
  garage: '<path d="M5 16V11l2-5h10l2 5v5"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="14" r=".6"/><circle cx="16.5" cy="14" r=".6"/><path d="M6 17v2M18 17v2"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-4 4-6 7.5-6s6.7 2 7.5 6"/>',
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
  calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><rect x="3" y="11" width="18" height="6" rx="2"/><path d="M6 17v2M18 17v2"/>',
  tools: '<path d="M14.5 6.5a4 4 0 0 0 4.8 5.2L10 21a2.1 2.1 0 0 1-3-3l9.3-9.3"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
};

const FILLABLE: IconName[] = ["home", "services", "bookings", "garage", "profile", "star"];

export function iconMarkup(name: IconName, color: string, size = 24, filled = false): string {
  const fill = filled && FILLABLE.includes(name) ? color : "none";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>`;
}
export function iconInner(name: IconName): string { return P[name]; }
export function iconDataUri(name: IconName, color: string, size = 24, filled = false): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(iconMarkup(name, color, size, filled))}`;
}
export function isFillable(name: IconName): boolean { return FILLABLE.includes(name); }
