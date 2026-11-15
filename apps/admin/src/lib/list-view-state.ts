// The Bookings list view (status, day or All dates, service, search) is remembered when a booking is opened,
// and restored only when the person comes back with Back from that booking (see go-back.ts wasReturning).
// Clicking Bookings in the menu, or reloading, still starts from the default view.
import { wasReturning } from "./go-back";

export const BOOKINGS_VIEW_KEY = "ax-bookings-view";

export type SavedListView = Record<string, string>;

/** Keeps only the named string fields; anything else (wrong type, bad JSON, arrays) is dropped. */
export function parseSavedListView(raw: string | null, fields: readonly string[]): SavedListView {
  if (!raw) return {};
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return {}; }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: SavedListView = {};
  for (const f of fields) { const x = (v as Record<string, unknown>)[f]; if (typeof x === "string") out[f] = x; }
  return out;
}

/** The saved view, but only when this visit follows the in-app Back button. Does not consume it. */
export function loadReturnedListView(key: string, fields: readonly string[]): SavedListView {
  if (typeof window === "undefined") return {};
  try { return wasReturning() ? parseSavedListView(window.sessionStorage.getItem(key), fields) : {}; } catch { return {}; }
}

export function saveListView(key: string, value: SavedListView): void {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: the view just resets */ }
}

export function dropListView(key: string): void {
  try { window.sessionStorage.removeItem(key); } catch { /* nothing to drop */ }
}

/** The saved view only lives while the person stays between Bookings and a booking/job page. Anywhere else drops it. */
export function viewStillRelevant(pathname: string): boolean { return /^\/bookings(\/|$)/.test(pathname) || /^\/jobs\/[^/]+/.test(pathname); }
