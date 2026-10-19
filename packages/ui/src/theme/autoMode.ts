// Automatic day/night. Night when the device asks for dark mode, or when
// the user's local clock is outside day hours (6 AM to 7 PM). No manual
// toggle: the device's own setting and the clock decide.
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 19;

export function isNightByClock(date: Date): boolean {
  const h = date.getHours();
  return h < DAY_START_HOUR || h >= DAY_END_HOUR;
}

export function resolveMode(date: Date, deviceDark: boolean): "light" | "night" {
  return deviceDark || isNightByClock(date) ? "night" : "light";
}

/** Reads the device preference from the browser, or false when unavailable. */
export function deviceWantsDark(): boolean {
  const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
  try {
    return g.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  } catch {
    return false;
  }
}

export type ThemePref = "auto" | "light" | "night";
const PREF_KEY = "autodeck.theme";
let memPref: ThemePref = "auto";
const prefListeners = new Set<() => void>();
export function getThemePref(): ThemePref {
  try {
    const v = (globalThis as { localStorage?: { getItem: (k: string) => string | null } }).localStorage?.getItem(PREF_KEY);
    if (v === "light" || v === "night" || v === "auto") return v;
  } catch {
    /* storage unavailable */
  }
  return memPref;
}
/** Manual override: "auto" follows the device and clock, otherwise pins day or night. */
export function setThemePref(pref: ThemePref): void {
  memPref = pref;
  try {
    (globalThis as { localStorage?: { setItem: (k: string, v: string) => void } }).localStorage?.setItem(PREF_KEY, pref);
  } catch {
    /* storage unavailable */
  }
  prefListeners.forEach((f) => f());
}

/** Studio and admin set this to "light" at build time (white theme only). The customer app leaves it unset. */
function lockedMode(): "light" | null {
  try {
    const v = process.env.EXPO_PUBLIC_THEME_LOCK || process.env.NEXT_PUBLIC_THEME_LOCK;
    return v === "light" ? "light" : null;
  } catch {
    return null;
  }
}

export function currentMode(): "light" | "night" {
  if (lockedMode()) return "light";
  // Dev only: ?theme=light or ?theme=night on web pins the mode so both can be checked at any hour.
  const q = (globalThis as { location?: { search?: string } }).location?.search ?? "";
  const m = /[?&]theme=(light|night)/.exec(q);
  if (m && (globalThis as { __DEV__?: boolean }).__DEV__ !== false) return m[1] as "light" | "night";
  const pref = getThemePref();
  if (pref !== "auto") return pref;
  return resolveMode(new Date(), deviceWantsDark());
}

/** Calls back when the mode flips (checked each minute and on media-query change). Returns an unsubscribe. */
export function watchMode(onChange: (mode: "light" | "night") => void): () => void {
  let last = currentMode();
  const check = () => {
    const next = currentMode();
    if (next !== last) {
      last = next;
      onChange(next);
    }
  };
  const timer = setInterval(check, 30_000);
  prefListeners.add(check);
  const g = globalThis as { matchMedia?: (q: string) => { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } };
  const mq = g.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", check);
  const doc = (globalThis as { document?: { addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } }).document;
  doc?.addEventListener("visibilitychange", check);
  return () => {
    clearInterval(timer);
    prefListeners.delete(check);
    mq?.removeEventListener?.("change", check);
    doc?.removeEventListener("visibilitychange", check);
  };
}
